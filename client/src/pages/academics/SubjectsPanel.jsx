import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import FormModal from '../../components/ui/FormModal.jsx';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/Feedback.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useForm } from '../../hooks/useForm.js';
import { LEVEL_LABELS } from '../../utils/format.js';
import { useConfirm } from '../../context/ConfirmContext.jsx';

function SubjectModal({ subject, defaultLevel, onClose, onSaved }) {
  const toast = useToast();
  const form = useForm({
    name: subject?.name ?? '',
    code: subject?.code ?? '',
    level: subject?.level ?? defaultLevel ?? '',
    displayOrder: subject?.displayOrder ?? 0,
    isCore: subject?.isCore ?? true,
    isActive: subject?.isActive ?? true,
  });
  return (
    <FormModal
      title={subject ? `Edit ${subject.name}` : 'New subject'}
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        if (subject) await api.put(`/academics/subjects/${subject.id}`, values);
        else await api.post('/academics/subjects', values);
        toast.success(`${values.name} saved.`);
        onSaved();
      }}
    >
      <div className="form-grid form-grid--2">
        <FormField label="Subject name" required error={form.errors.name} className="span-2">
          <input className="form-control" {...form.bind('name')} />
        </FormField>
        <FormField label="Code" required error={form.errors.code} hint="e.g. MATH, KISW, CIV">
          <input className="form-control mono" {...form.bind('code')} />
        </FormField>
        <FormField label="Level" required error={form.errors.level}>
          <select className="form-control" {...form.bind('level')}>
            <option value="">Select level…</option>
            {Object.entries(LEVEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>
        <FormField label="Display order" error={form.errors.displayOrder} hint="Order on mark sheets and report cards (lower first)">
          <input type="number" min={0} max={999} className="form-control mono" {...form.bind('displayOrder')} />
        </FormField>
      </div>
      <div className="button-row">
        <label className="form-check"><input {...form.bindCheckbox('isCore')} /> Core (compulsory) subject</label>
        {subject && <label className="form-check"><input {...form.bindCheckbox('isActive')} /> Active</label>}
      </div>
    </FormModal>
  );
}

export default function SubjectsPanel() {
  const confirm = useConfirm();
  const [level, setLevel] = useState('');
  const { data: subjects, error, loading, reload } = useApi('/academics/subjects', { level, includeInactive: true });
  const { run, pending } = useAsyncAction();
  const [modal, setModal] = useState(null);

  return (
    <div className="stack">
      <div className="panel-toolbar">
        <select className="form-control form-control--inline" aria-label="Filter by level" value={level} onChange={(event) => setLevel(event.target.value)}>
          <option value="">All levels</option>
          {Object.entries(LEVEL_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" className="btn btn--primary" onClick={() => setModal({})}>
          <Plus size={16} aria-hidden="true" /> New subject
        </button>
      </div>
      {loading && !subjects && <LoadingBlock />}
      <ErrorBlock error={error} onRetry={reload} />
      {subjects && subjects.length === 0 && (
        <EmptyState icon={BookOpen} title="No subjects" message="Add the subjects taught at each level." />
      )}
      {subjects && subjects.length > 0 && (
        <section className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="numeric">Order</th><th>Code</th><th>Subject</th><th>Level</th><th>Type</th><th>Status</th>
                  <th className="actions"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.id}>
                    <td className="numeric">{subject.displayOrder}</td>
                    <td className="mono">{subject.code}</td>
                    <td className="data-table__primary">{subject.name}</td>
                    <td>{LEVEL_LABELS[subject.level]}</td>
                    <td><StatusBadge status={subject.isCore ? 'core' : 'optional'} tone={subject.isCore ? 'info' : 'neutral'} label={subject.isCore ? 'Core' : 'Optional'} /></td>
                    <td><StatusBadge status={subject.isActive ? 'active' : 'inactive'} /></td>
                    <td className="actions">
                      <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Edit ${subject.name}`} onClick={() => setModal({ subject })}>
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon btn--sm"
                        aria-label={`Delete ${subject.name}`}
                        disabled={pending === subject.id}
                        onClick={async () => (await confirm(`Delete ${subject.name}? Subjects with marks or assignments cannot be deleted — deactivate them instead.`))
                          && run(subject.id, () => api.delete(`/academics/subjects/${subject.id}`), 'Subject deleted.').then(reload)}
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
        <SubjectModal
          subject={modal.subject}
          defaultLevel={level}
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
