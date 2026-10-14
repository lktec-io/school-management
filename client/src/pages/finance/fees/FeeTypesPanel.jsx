import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../../api/client.js';
import FormField from '../../../components/ui/FormField.jsx';
import FormModal from '../../../components/ui/FormModal.jsx';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../../components/ui/Feedback.jsx';
import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';
import { useToast } from '../../../context/ToastContext.jsx';
import { useApi } from '../../../hooks/useApi.js';
import { useAsyncAction } from '../../../hooks/useAsyncAction.js';
import { useForm } from '../../../hooks/useForm.js';

function FeeTypeModal({ feeType, onClose, onSaved }) {
  const toast = useToast();
  const form = useForm({
    name: feeType?.name ?? '',
    code: feeType?.code ?? '',
    description: feeType?.description ?? '',
    isActive: feeType?.isActive ?? true,
  });
  return (
    <FormModal
      title={feeType ? `Edit ${feeType.name}` : 'New fee type'}
      form={form}
      onClose={onClose}
      onSubmit={async (values) => {
        if (feeType) await api.put(`/finance/fee-types/${feeType.id}`, values);
        else await api.post('/finance/fee-types', values);
        toast.success(`${values.name} saved.`);
        onSaved();
      }}
    >
      <div className="form-grid form-grid--2">
        <FormField label="Name" required error={form.errors.name} hint="e.g. Tuition Fee, Transport, Uniform">
          <input className="form-control" {...form.bind('name')} />
        </FormField>
        <FormField label="Code" required error={form.errors.code} hint="e.g. TUITION">
          <input className="form-control mono" {...form.bind('code')} />
        </FormField>
        <FormField label="Description" error={form.errors.description} className="span-2">
          <input className="form-control" maxLength={255} {...form.bind('description')} />
        </FormField>
      </div>
      {feeType && <label className="form-check"><input {...form.bindCheckbox('isActive')} /> Active</label>}
    </FormModal>
  );
}

export default function FeeTypesPanel() {
  const { data, error, loading, reload } = useApi('/finance/fee-types', { includeInactive: true });
  const { run, pending } = useAsyncAction();
  const [modal, setModal] = useState(null);

  return (
    <div className="stack">
      <div className="panel-toolbar">
        <p className="text-sm text-muted">Fee types are the items that appear on bills and receipts.</p>
        <button type="button" className="btn btn--primary" onClick={() => setModal({})}><Plus size={16} aria-hidden="true" /> New fee type</button>
      </div>
      {loading && !data && <LoadingBlock />}
      <ErrorBlock error={error} onRetry={reload} />
      {data?.length === 0 && <EmptyState icon={Tags} title="No fee types yet" message="Start with Tuition Fee, then add Transport, Examination, Uniform and others." />}
      {data?.length > 0 && (
        <section className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Name</th><th>Description</th><th className="numeric">Structures</th><th>Status</th><th className="actions"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.map((type) => (
                  <tr key={type.id}>
                    <td className="mono">{type.code}</td>
                    <td className="data-table__primary">{type.name}</td>
                    <td>{type.description || <span className="text-muted">—</span>}</td>
                    <td className="numeric">{type.structures}</td>
                    <td><StatusBadge status={type.isActive ? 'active' : 'inactive'} /></td>
                    <td className="actions">
                      <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Edit ${type.name}`} onClick={() => setModal({ feeType: type })}><Pencil size={15} /></button>
                      <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Delete ${type.name}`}
                        disabled={type.structures > 0 || pending === type.id}
                        title={type.structures > 0 ? 'In use — deactivate instead' : undefined}
                        onClick={() => window.confirm(`Delete ${type.name}?`) && run(type.id, () => api.delete(`/finance/fee-types/${type.id}`), 'Fee type deleted.').then(reload)}>
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
      {modal && <FeeTypeModal feeType={modal.feeType} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
    </div>
  );
}
