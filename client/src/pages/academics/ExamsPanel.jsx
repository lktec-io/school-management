import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import FormModal from '../../components/ui/FormModal.jsx';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useAcademicPeriod } from '../../context/AcademicContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useForm } from '../../hooks/useForm.js';
import { EXAM_TYPE_LABELS, formatDate, formatNumber } from '../../utils/format.js';
import { useConfirm } from '../../context/ConfirmContext.jsx';

/** Mirrors the server's exam lifecycle. */
const TRANSITIONS = {
  draft: [{ to: 'open', label: 'Open for marks', tone: 'success' }],
  open: [{ to: 'closed', label: 'Close marks entry', tone: 'outline' }, { to: 'draft', label: 'Back to draft', tone: 'ghost' }],
  closed: [{ to: 'published', label: 'Publish results', tone: 'primary' }, { to: 'open', label: 'Reopen', tone: 'ghost' }],
  published: [{ to: 'closed', label: 'Unpublish', tone: 'ghost' }],
};

function ExamModal({ exam, years, defaultTermId, onClose, onSaved }) {
  const toast = useToast();
  const form = useForm({
    name: exam?.name ?? '',
    examType: exam?.examType ?? 'midterm',
    termId: exam?.termId ?? defaultTermId ?? '',
    startDate: exam?.startDate ?? '',
    endDate: exam?.endDate ?? '',
    maxScore: exam?.maxScore ?? 100,
  });
  const term = years.flatMap((year) => year.terms).find((t) => String(t.id) === String(form.values.termId));
  const locked = exam?.marksCount > 0;

  return (
    <FormModal
      title={exam ? `Edit ${exam.name}` : 'New examination'}
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        const payload = { ...values };
        if (locked) {
          delete payload.maxScore;
          delete payload.termId;
        }
        if (exam) await api.put(`/exams/${exam.id}`, payload);
        else await api.post('/exams', payload);
        toast.success(`${values.name} saved.`);
        onSaved();
      }}
    >
      <FormField label="Examination name" required error={form.errors.name} hint="e.g. Midterm Examination, March Monthly Test">
        <input className="form-control" {...form.bind('name')} />
      </FormField>
      <div className="form-grid form-grid--2">
        <FormField label="Type" required error={form.errors.examType}>
          <select className="form-control" {...form.bind('examType')}>
            {Object.entries(EXAM_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>
        <FormField label="Term" required error={form.errors.termId} hint={locked ? 'Locked — marks already entered' : null}>
          <select className="form-control" {...form.bind('termId')} disabled={locked}>
            <option value="">Select term…</option>
            {years.map((year) => (
              <optgroup key={year.id} label={year.yearLabel}>
                {year.terms.map((t) => <option key={t.id} value={t.id}>{t.termName} {year.yearLabel}</option>)}
              </optgroup>
            ))}
          </select>
        </FormField>
        <FormField label="Start date" error={form.errors.startDate}>
          <input type="date" className="form-control mono" min={term?.startDate} max={term?.endDate} {...form.bind('startDate')} />
        </FormField>
        <FormField label="End date" error={form.errors.endDate}>
          <input type="date" className="form-control mono" min={term?.startDate} max={term?.endDate} {...form.bind('endDate')} />
        </FormField>
        <FormField label="Maximum score" required error={form.errors.maxScore} hint={locked ? 'Locked — marks already entered' : 'Marks are entered out of this value'}>
          <input type="number" min={1} max={100} step="0.5" className="form-control mono" {...form.bind('maxScore')} disabled={locked} />
        </FormField>
      </div>
    </FormModal>
  );
}

export default function ExamsPanel() {
  const confirm = useConfirm();
  const { term } = useAcademicPeriod();
  const [termId, setTermId] = useState(term ? String(term.id) : '');
  const years = useApi('/academics/years');
  const { data: exams, error, loading, reload } = useApi('/exams', { termId });
  const { run, pending } = useAsyncAction();
  const [modal, setModal] = useState(null);
  const yearList = years.data ?? [];

  const changeStatus = async (exam, transition) => {
    if (transition.to === 'published' && !(await confirm(`Publish ${exam.name}? Parents will be able to view and download report cards.`))) return;
    run(`${exam.id}-${transition.to}`, () => api.put(`/exams/${exam.id}`, { status: transition.to }), `${exam.name}: ${transition.label.toLowerCase()} — done.`)
      .then(reload);
  };

  return (
    <div className="stack">
      <div className="panel-toolbar">
        <div className="button-row">
          <select className="form-control form-control--inline" aria-label="Filter by term" value={termId} onChange={(event) => setTermId(event.target.value)}>
            <option value="">All terms</option>
            {yearList.map((year) => (
              <optgroup key={year.id} label={year.yearLabel}>
                {year.terms.map((t) => <option key={t.id} value={t.id}>{t.termName} {year.yearLabel}</option>)}
              </optgroup>
            ))}
          </select>
          <span className="text-sm text-muted">Draft → Open (marks entry) → Closed → Published (visible to parents)</span>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setModal({})} disabled={!yearList.some((y) => y.terms.length)}>
          <Plus size={16} aria-hidden="true" /> New examination
        </button>
      </div>
      {loading && !exams && <LoadingBlock />}
      <ErrorBlock error={error} onRetry={reload} />
      {exams && exams.length === 0 && (
        <EmptyState icon={ClipboardList} title="No examinations" message="Create an examination, then open it so teachers can enter marks." />
      )}
      {exams && exams.length > 0 && (
        <section className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Examination</th><th>Term</th><th>Dates</th><th className="numeric">Max</th>
                  <th className="numeric">Marks</th><th>Status</th><th>Lifecycle</th>
                  <th className="actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.id}>
                    <td>
                      <span className="data-table__primary">{exam.name}</span>
                      <span className="data-table__secondary">{EXAM_TYPE_LABELS[exam.examType]}</span>
                    </td>
                    <td>{exam.termName} <span className="mono text-muted">{exam.yearLabel}</span></td>
                    <td className="mono text-nowrap">{exam.startDate ? `${formatDate(exam.startDate)} – ${formatDate(exam.endDate)}` : '—'}</td>
                    <td className="numeric">{formatNumber(exam.maxScore)}</td>
                    <td className="numeric">{exam.marksCount}</td>
                    <td><StatusBadge status={exam.status} /></td>
                    <td>
                      <div className="button-row">
                        {TRANSITIONS[exam.status].map((transition) => (
                          <button
                            key={transition.to}
                            type="button"
                            className={`btn btn--${transition.tone} btn--sm`}
                            disabled={pending === `${exam.id}-${transition.to}` || (transition.to === 'draft' && exam.marksCount > 0)}
                            onClick={() => changeStatus(exam, transition)}
                          >
                            {transition.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="actions">
                      <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Edit ${exam.name}`} onClick={() => setModal({ exam })}>
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon btn--sm"
                        aria-label={`Delete ${exam.name}`}
                        disabled={exam.marksCount > 0 || pending === `del-${exam.id}`}
                        onClick={async () => (await confirm(`Delete ${exam.name}?`))
                          && run(`del-${exam.id}`, () => api.delete(`/exams/${exam.id}`), 'Examination deleted.').then(reload)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {modal && (
        <ExamModal
          exam={modal.exam}
          years={yearList}
          defaultTermId={termId || term?.id}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
