import { CalendarCheck, CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { formatDate } from '../../utils/format.js';

function YearModal({ year, onClose, onSaved }) {
  const toast = useToast();
  const form = useForm({
    yearLabel: year?.yearLabel ?? String(new Date().getFullYear()),
    startDate: year?.startDate ?? '',
    endDate: year?.endDate ?? '',
  });
  return (
    <FormModal
      title={year ? `Edit academic year ${year.yearLabel}` : 'New academic year'}
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        if (year) await api.put(`/academics/years/${year.id}`, values);
        else await api.post('/academics/years', values);
        toast.success(`Academic year ${values.yearLabel} saved.`);
        onSaved();
      }}
    >
      <FormField label="Year label" required error={form.errors.yearLabel} hint="e.g. 2026 or 2026/2027">
        <input className="form-control mono" {...form.bind('yearLabel')} />
      </FormField>
      <div className="form-grid form-grid--2">
        <FormField label="Start date" required error={form.errors.startDate}>
          <input type="date" className="form-control mono" {...form.bind('startDate')} />
        </FormField>
        <FormField label="End date" required error={form.errors.endDate}>
          <input type="date" className="form-control mono" {...form.bind('endDate')} />
        </FormField>
      </div>
    </FormModal>
  );
}

function TermModal({ year, term, onClose, onSaved }) {
  const toast = useToast();
  const nextNumber = (year.terms.reduce((max, t) => Math.max(max, t.termNumber), 0) || 0) + 1;
  const romans = ['I', 'II', 'III', 'IV'];
  const form = useForm({
    termName: term?.termName ?? `Term ${romans[Math.min(nextNumber, 4) - 1]}`,
    termNumber: term?.termNumber ?? Math.min(nextNumber, 4),
    startDate: term?.startDate ?? '',
    endDate: term?.endDate ?? '',
  });
  return (
    <FormModal
      title={term ? `Edit ${term.termName} — ${year.yearLabel}` : `New term — ${year.yearLabel}`}
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        if (term) await api.put(`/academics/terms/${term.id}`, values);
        else await api.post('/academics/terms', { ...values, academicYearId: year.id });
        toast.success(`${values.termName} saved.`);
        onSaved();
      }}
    >
      <div className="form-grid form-grid--2">
        <FormField label="Term name" required error={form.errors.termName}>
          <input className="form-control" {...form.bind('termName')} />
        </FormField>
        <FormField label="Term number" required error={form.errors.termNumber}>
          <select className="form-control mono" {...form.bind('termNumber')}>
            {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </FormField>
        <FormField label="Start date" required error={form.errors.startDate} hint={`Year starts ${formatDate(year.startDate)}`}>
          <input type="date" className="form-control mono" min={year.startDate} max={year.endDate} {...form.bind('startDate')} />
        </FormField>
        <FormField label="End date" required error={form.errors.endDate} hint={`Year ends ${formatDate(year.endDate)}`}>
          <input type="date" className="form-control mono" min={year.startDate} max={year.endDate} {...form.bind('endDate')} />
        </FormField>
      </div>
    </FormModal>
  );
}

export default function CalendarPanel() {
  const academic = useAcademicPeriod();
  const { data: years, error, loading, reload } = useApi('/academics/years');
  const { run, pending } = useAsyncAction();
  const [modal, setModal] = useState(null);

  const afterChange = () => {
    reload();
    academic.refresh();
  };

  const closeAndReload = () => {
    setModal(null);
    afterChange();
  };

  return (
    <div className="stack">
      <div className="panel-toolbar">
        <p className="text-sm text-muted">
          The current term drives exams, fee balances and the term badge shown to all users.
        </p>
        <button type="button" className="btn btn--primary" onClick={() => setModal({ type: 'year' })}>
          <Plus size={16} aria-hidden="true" /> New academic year
        </button>
      </div>

      {loading && !years && <LoadingBlock />}
      <ErrorBlock error={error} onRetry={reload} />
      {years && years.length === 0 && (
        <EmptyState icon={CalendarDays} title="No academic years yet" message="Create the academic year, then add its terms." />
      )}

      {years?.map((year) => (
        <section key={year.id} className={`card${year.isCurrent ? ' card--highlight' : ''}`}>
          <div className="card__header">
            <div className="card__title-group">
              <h3 className="card__title">Academic year <span className="mono">{year.yearLabel}</span></h3>
              <span className="text-sm text-muted mono">{formatDate(year.startDate)} – {formatDate(year.endDate)}</span>
              {year.isCurrent && <StatusBadge status="active" label="Current year" />}
            </div>
            <div className="button-row">
              {!year.isCurrent && (
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  disabled={pending === `year-${year.id}`}
                  onClick={() => run(`year-${year.id}`, () => api.post(`/academics/years/${year.id}/set-current`), `${year.yearLabel} is now the current academic year.`).then(afterChange)}
                >
                  <CalendarCheck size={14} aria-hidden="true" /> Set as current
                </button>
              )}
              <button type="button" className="btn btn--outline btn--sm" onClick={() => setModal({ type: 'term', year })}>
                <Plus size={14} aria-hidden="true" /> Add term
              </button>
              <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Edit ${year.yearLabel}`} onClick={() => setModal({ type: 'year', year })}>
                <Pencil size={15} />
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--icon btn--sm"
                aria-label={`Delete ${year.yearLabel}`}
                disabled={year.isCurrent || pending === `del-year-${year.id}`}
                onClick={() => window.confirm(`Delete academic year ${year.yearLabel}?`)
                  && run(`del-year-${year.id}`, () => api.delete(`/academics/years/${year.id}`), 'Academic year deleted.').then(afterChange)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="numeric">No.</th><th>Term</th><th>Start</th><th>End</th><th>Status</th>
                  <th className="actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {year.terms.length === 0 && (
                  <tr><td colSpan={6} className="data-table__empty">No terms added yet.</td></tr>
                )}
                {year.terms.map((term) => (
                  <tr key={term.id} aria-selected={term.isCurrent}>
                    <td className="numeric">{term.termNumber}</td>
                    <td className="data-table__primary">{term.termName}</td>
                    <td className="mono">{formatDate(term.startDate)}</td>
                    <td className="mono">{formatDate(term.endDate)}</td>
                    <td>{term.isCurrent ? <StatusBadge status="active" label="Current term" /> : <span className="text-muted">—</span>}</td>
                    <td className="actions">
                      {!term.isCurrent && (
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          disabled={pending === `term-${term.id}`}
                          onClick={() => run(`term-${term.id}`, () => api.post(`/academics/terms/${term.id}/set-current`), `${term.termName} ${year.yearLabel} is now the current term.`).then(afterChange)}
                        >
                          Set current
                        </button>
                      )}
                      <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Edit ${term.termName}`} onClick={() => setModal({ type: 'term', year, term })}>
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon btn--sm"
                        aria-label={`Delete ${term.termName}`}
                        disabled={term.isCurrent || pending === `del-term-${term.id}`}
                        onClick={() => window.confirm(`Delete ${term.termName} (${year.yearLabel})?`)
                          && run(`del-term-${term.id}`, () => api.delete(`/academics/terms/${term.id}`), 'Term deleted.').then(afterChange)}
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
      ))}

      {modal?.type === 'year' && <YearModal year={modal.year} onClose={() => setModal(null)} onSaved={closeAndReload} />}
      {modal?.type === 'term' && <TermModal year={modal.year} term={modal.term} onClose={() => setModal(null)} onSaved={closeAndReload} />}
    </div>
  );
}
