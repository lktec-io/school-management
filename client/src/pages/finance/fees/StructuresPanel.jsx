import { Copy, Layers, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../../api/client.js';
import FormField from '../../../components/ui/FormField.jsx';
import FormModal from '../../../components/ui/FormModal.jsx';
import { EmptyState, ErrorBlock, InlineAlert, LoadingBlock } from '../../../components/ui/Feedback.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';
import { useAcademicPeriod } from '../../../context/AcademicContext.jsx';
import { useToast } from '../../../context/ToastContext.jsx';
import { useApi } from '../../../hooks/useApi.js';
import { useAsyncAction } from '../../../hooks/useAsyncAction.js';
import { useForm } from '../../../hooks/useForm.js';
import { formatMoney } from '../../../utils/format.js';
import { useConfirm } from '../../../context/ConfirmContext.jsx';

function TermOptions({ years }) {
  return years.map((year) => (
    <optgroup key={year.id} label={year.yearLabel}>
      {year.terms.map((t) => <option key={t.id} value={t.id}>{t.termName} {year.yearLabel}</option>)}
    </optgroup>
  ));
}

function CreateStructureModal({ termId, years, classes, feeTypes, onClose, onSaved }) {
  const toast = useToast();
  const form = useForm({ feeTypeId: '', termId, amount: '', isMandatory: true });
  const [classIds, setClassIds] = useState([]);
  const toggle = (id) => setClassIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  return (
    <FormModal
      title="Add fee to classes"
      form={form}
      size="lg"
      onClose={onClose}
      submitLabel={`Add to ${classIds.length || 0} class${classIds.length === 1 ? '' : 'es'}`}
      onSubmit={async (values) => {
        const created = await api.post('/finance/fee-structures', { ...values, classIds });
        toast.success(`Fee added to ${created.length} class(es).`);
        onSaved();
      }}
    >
      <div className="form-grid form-grid--3">
        <FormField label="Fee type" required error={form.errors.feeTypeId}>
          <select className="form-control" {...form.bind('feeTypeId')}>
            <option value="">Select…</option>
            {feeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </FormField>
        <FormField label="Term" required error={form.errors.termId}>
          <select className="form-control" {...form.bind('termId')}><TermOptions years={years} /></select>
        </FormField>
        <FormField label="Amount per student (TZS)" required error={form.errors.amount}>
          <input className="form-control mono amount-input" inputMode="decimal" {...form.bind('amount')} />
        </FormField>
      </div>
      <label className="form-check">
        <input {...form.bindCheckbox('isMandatory')} /> Mandatory for every student in the class
      </label>
      {!form.values.isMandatory && <p className="text-xs text-muted">Optional fees (e.g. transport, meals) are billed only to students you allocate afterwards.</p>}
      <fieldset className="checkbox-grid">
        <legend className="form-label">Classes {form.errors.classIds && <span className="form-error">— {form.errors.classIds}</span>}</legend>
        <label className="form-check">
          <input type="checkbox" checked={classIds.length === classes.length && classes.length > 0}
            onChange={(event) => setClassIds(event.target.checked ? classes.map((c) => c.id) : [])} /> <strong>All classes</strong>
        </label>
        {classes.map((cls) => (
          <label key={cls.id} className="form-check">
            <input type="checkbox" checked={classIds.includes(cls.id)} onChange={() => toggle(cls.id)} /> {cls.className}
          </label>
        ))}
      </fieldset>
    </FormModal>
  );
}

function EditStructureModal({ structure, onClose, onSaved }) {
  const toast = useToast();
  const form = useForm({ amount: structure.amount, isMandatory: structure.isMandatory });
  return (
    <FormModal
      title={`${structure.feeTypeName} — ${structure.className}`}
      form={form}
      size="sm"
      onClose={onClose}
      onSubmit={async (values) => {
        await api.put(`/finance/fee-structures/${structure.id}`, values);
        toast.success('Fee updated. Balances recalculate automatically.');
        onSaved();
      }}
    >
      <FormField label="Amount per student (TZS)" required error={form.errors.amount}>
        <input className="form-control mono amount-input" inputMode="decimal" {...form.bind('amount')} />
      </FormField>
      <label className="form-check"><input {...form.bindCheckbox('isMandatory')} /> Mandatory for every student</label>
    </FormModal>
  );
}

function AllocationModal({ structure, onClose, onSaved }) {
  const toast = useToast();
  const { data, loading, error } = useApi(`/finance/fee-structures/${structure.id}/allocations`);
  const [picked, setPicked] = useState(null);
  const [saving, setSaving] = useState(false);
  const selected = picked ?? new Set((data?.students ?? []).filter((s) => s.allocated).map((s) => s.studentId));
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.put(`/finance/fee-structures/${structure.id}/allocations`, { studentIds: [...selected] });
      toast.success(`${structure.feeTypeName}: ${result.total} student(s) allocated (+${result.added} / −${result.removed}).`);
      onSaved();
    } catch (failure) {
      toast.error(failure.message);
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`${structure.feeTypeName} — ${structure.className}`}
      onClose={onClose}
      closeDisabled={saving}
      footer={(
        <>
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={saving || !data}>
            {saving ? 'Saving…' : `Save (${selected.size} students)`}
          </button>
        </>
      )}
    >
      <p className="text-sm text-muted">Tick the students who take this optional item at <span className="amount">{formatMoney(structure.amount)}</span> each.</p>
      {loading && <LoadingBlock />}
      {error && <InlineAlert tone="danger">{error.message}</InlineAlert>}
      {data && (
        <div className="checklist">
          <label className="form-check checklist__all">
            <input type="checkbox" checked={selected.size === data.students.length && data.students.length > 0}
              onChange={(event) => setPicked(new Set(event.target.checked ? data.students.map((s) => s.studentId) : []))} /> Select all
          </label>
          {data.students.map((student) => (
            <label key={student.studentId} className="form-check">
              <input type="checkbox" checked={selected.has(student.studentId)} onChange={() => toggle(student.studentId)} />
              <span>{student.fullName}</span>
              <span className="reg-no">{student.registrationNumber}</span>
              {student.streamName && <span className="text-xs text-muted">Stream {student.streamName}</span>}
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

function CopyModal({ years, defaultTo, onClose, onSaved }) {
  const toast = useToast();
  const form = useForm({ fromTermId: '', toTermId: defaultTo });
  return (
    <FormModal
      title="Copy fees from another term"
      form={form}
      size="sm"
      submitLabel="Copy fees"
      onClose={onClose}
      onSubmit={async (values) => {
        const result = await api.post('/finance/fee-structures/copy', values);
        toast.success(`${result.copied} fee item(s) copied. Existing items were left unchanged.`);
        onSaved();
      }}
    >
      <FormField label="Copy from" required error={form.errors.fromTermId}>
        <select className="form-control" {...form.bind('fromTermId')}><option value="">Select…</option><TermOptions years={years} /></select>
      </FormField>
      <FormField label="Copy to" required error={form.errors.toTermId}>
        <select className="form-control" {...form.bind('toTermId')}><TermOptions years={years} /></select>
      </FormField>
    </FormModal>
  );
}

export default function StructuresPanel() {
  const confirm = useConfirm();
  const { term } = useAcademicPeriod();
  const [termId, setTermId] = useState(term ? String(term.id) : '');
  const [classId, setClassId] = useState('');
  const [modal, setModal] = useState(null);
  const { run, pending } = useAsyncAction();
  const years = useApi('/academics/years');
  const classes = useApi('/academics/classes');
  const feeTypes = useApi('/finance/fee-types');
  const { data, error, loading, reload } = useApi(termId ? '/finance/fee-structures' : null, { termId, classId });

  const items = data?.items ?? [];
  const perClass = new Map();
  for (const item of items) {
    const entry = perClass.get(item.classId) ?? { className: item.className, mandatory: 0, optional: 0 };
    if (item.isMandatory) entry.mandatory += item.amount;
    else entry.optional += item.amount;
    perClass.set(item.classId, entry);
  }
  const close = () => {
    setModal(null);
    reload();
  };

  return (
    <div className="stack">
      <div className="panel-toolbar">
        <div className="button-row">
          <select className="form-control form-control--inline" aria-label="Term" value={termId} onChange={(event) => setTermId(event.target.value)}>
            <option value="">Select term…</option>
            <TermOptions years={years.data ?? []} />
          </select>
          <select className="form-control form-control--inline" aria-label="Class" value={classId} onChange={(event) => setClassId(event.target.value)}>
            <option value="">All classes</option>
            {(classes.data ?? []).map((cls) => <option key={cls.id} value={cls.id}>{cls.className}</option>)}
          </select>
        </div>
        <div className="button-row">
          <button type="button" className="btn btn--outline" onClick={() => setModal({ type: 'copy' })} disabled={!termId}>
            <Copy size={16} aria-hidden="true" /> Copy from term
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setModal({ type: 'create' })} disabled={!termId || !feeTypes.data?.length}>
            <Plus size={16} aria-hidden="true" /> Add fee
          </button>
        </div>
      </div>
      {feeTypes.data?.length === 0 && <InlineAlert tone="info"><p>Create fee types first (Fee types tab).</p></InlineAlert>}
      {loading && !data && <LoadingBlock />}
      <ErrorBlock error={error} onRetry={reload} />
      {data && items.length === 0 && <EmptyState icon={Layers} title="No fees for this term" message="Add fees per class, or copy last term's structure." />}

      {items.length > 0 && (
        <div className="finance-split">
          <section className="card">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Class</th><th>Fee item</th><th>Billed to</th><th className="numeric">Amount (TZS)</th><th className="actions"><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="data-table__primary">{item.className}</td>
                      <td>{item.feeTypeName} <span className="mono text-xs text-muted">{item.feeTypeCode}</span></td>
                      <td>
                        {item.isMandatory ? (
                          <StatusBadge status="mandatory" tone="info" label="All students" />
                        ) : (
                          <button type="button" className="chip" onClick={() => setModal({ type: 'allocate', structure: item })} title="Choose students">
                            <Users size={12} aria-hidden="true" /> Optional · <span className="mono">{item.allocatedStudents}</span> student{item.allocatedStudents === 1 ? '' : 's'}
                          </button>
                        )}
                      </td>
                      <td className="numeric"><strong>{formatMoney(item.amount)}</strong></td>
                      <td className="actions">
                        <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label="Edit fee" onClick={() => setModal({ type: 'edit', structure: item })}><Pencil size={15} /></button>
                        <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label="Delete fee" disabled={pending === item.id}
                          onClick={async () => (await confirm(`Remove ${item.feeTypeName} from ${item.className}?`))
                            && run(item.id, () => api.delete(`/finance/fee-structures/${item.id}`), 'Fee removed.').then(reload)}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <div className="card__header"><h2 className="card__title">Bill per student</h2></div>
            <div className="table-wrapper density-compact">
              <table className="data-table">
                <thead><tr><th>Class</th><th className="numeric">Mandatory</th><th className="numeric">Optional</th></tr></thead>
                <tbody>
                  {[...perClass.entries()].map(([id, row]) => (
                    <tr key={id}>
                      <td>{row.className}</td>
                      <td className="numeric"><strong>{formatMoney(row.mandatory)}</strong></td>
                      <td className="numeric">{row.optional ? formatMoney(row.optional) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {modal?.type === 'create' && (
        <CreateStructureModal termId={termId} years={years.data ?? []} classes={classes.data ?? []} feeTypes={feeTypes.data ?? []} onClose={() => setModal(null)} onSaved={close} />
      )}
      {modal?.type === 'edit' && <EditStructureModal structure={modal.structure} onClose={() => setModal(null)} onSaved={close} />}
      {modal?.type === 'allocate' && <AllocationModal structure={modal.structure} onClose={() => setModal(null)} onSaved={close} />}
      {modal?.type === 'copy' && <CopyModal years={years.data ?? []} defaultTo={termId} onClose={() => setModal(null)} onSaved={close} />}
    </div>
  );
}
