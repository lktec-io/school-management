import { BadgePercent, Plus, XCircle } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../../api/client.js';
import FormField from '../../../components/ui/FormField.jsx';
import FormModal from '../../../components/ui/FormModal.jsx';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../../components/ui/Feedback.jsx';
import ReasonModal from '../../../components/ui/ReasonModal.jsx';
import { StatusBadge } from '../../../components/ui/StatusBadge.jsx';
import StudentSearch from '../../../components/ui/StudentSearch.jsx';
import { useAcademicPeriod } from '../../../context/AcademicContext.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { useToast } from '../../../context/ToastContext.jsx';
import { useApi } from '../../../hooks/useApi.js';
import { useForm } from '../../../hooks/useForm.js';
import { classLabel, formatDate, formatMoney } from '../../../utils/format.js';

function DiscountModal({ years, feeTypes, defaultTermId, onClose, onSaved }) {
  const toast = useToast();
  const [student, setStudent] = useState(null);
  const form = useForm({ termId: defaultTermId, feeTypeId: '', discountType: 'percentage', value: '', reason: '' });
  return (
    <FormModal
      title="Grant discount / waiver"
      form={form}
      onClose={onClose}
      submitLabel="Grant discount"
      onSubmit={async (values) => {
        if (!student) {
          form.setErrors({ studentId: 'Select a student' });
          throw new Error('Select a student');
        }
        await api.post('/finance/discounts', { ...values, studentId: student.id });
        toast.success(`Discount granted to ${student.fullName}.`);
        onSaved();
      }}
    >
      {student ? (
        <div className="selected-student">
          <strong>{student.fullName}</strong>
          <span className="reg-no">{student.registrationNumber}</span>
          <span className="text-muted">{classLabel(student.className, student.streamName)}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStudent(null)}>Change</button>
        </div>
      ) : (
        <FormField label="Student" required error={form.errors.studentId}>
          <StudentSearch onSelect={setStudent} />
        </FormField>
      )}
      <div className="form-grid form-grid--2">
        <FormField label="Term" required error={form.errors.termId}>
          <select className="form-control" {...form.bind('termId')}>
            {years.map((year) => (
              <optgroup key={year.id} label={year.yearLabel}>
                {year.terms.map((t) => <option key={t.id} value={t.id}>{t.termName} {year.yearLabel}</option>)}
              </optgroup>
            ))}
          </select>
        </FormField>
        <FormField label="Applies to" error={form.errors.feeTypeId}>
          <select className="form-control" {...form.bind('feeTypeId')}>
            <option value="">Whole term bill</option>
            {feeTypes.map((type) => <option key={type.id} value={type.id}>{type.name} only</option>)}
          </select>
        </FormField>
        <FormField label="Discount type" required error={form.errors.discountType}>
          <select className="form-control" {...form.bind('discountType')}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed amount (TZS)</option>
          </select>
        </FormField>
        <FormField label={form.values.discountType === 'percentage' ? 'Percentage' : 'Amount (TZS)'} required error={form.errors.value}>
          <input className="form-control mono" inputMode="decimal" {...form.bind('value')} />
        </FormField>
        <FormField label="Reason" required error={form.errors.reason} className="span-2" hint="e.g. Sibling discount, Staff child, Scholarship (min. 5 characters)">
          <input className="form-control" maxLength={255} {...form.bind('reason')} />
        </FormField>
      </div>
    </FormModal>
  );
}

export default function DiscountsPanel() {
  const { hasRole } = useAuth();
  const isHeadmaster = hasRole('admin');
  const toast = useToast();
  const { term } = useAcademicPeriod();
  const [termId, setTermId] = useState(term ? String(term.id) : '');
  const [status, setStatus] = useState('active');
  const [modal, setModal] = useState(null);
  const years = useApi('/academics/years');
  const feeTypes = useApi('/finance/fee-types');
  const { data, error, loading, reload } = useApi('/finance/discounts', { termId, status });

  return (
    <div className="stack">
      <div className="panel-toolbar">
        <div className="button-row">
          <select className="form-control form-control--inline" aria-label="Term" value={termId} onChange={(event) => setTermId(event.target.value)}>
            <option value="">All terms</option>
            {(years.data ?? []).map((year) => (
              <optgroup key={year.id} label={year.yearLabel}>
                {year.terms.map((t) => <option key={t.id} value={t.id}>{t.termName} {year.yearLabel}</option>)}
              </optgroup>
            ))}
          </select>
          <select className="form-control form-control--inline" aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
            <option value="">All</option>
          </select>
        </div>
        {isHeadmaster ? (
          <button type="button" className="btn btn--primary" onClick={() => setModal({ type: 'create' })}><Plus size={16} aria-hidden="true" /> Grant discount</button>
        ) : (
          <span className="text-sm text-muted">Only the Headmaster can grant or revoke discounts.</span>
        )}
      </div>
      {loading && !data && <LoadingBlock />}
      <ErrorBlock error={error} onRetry={reload} />
      {data?.length === 0 && <EmptyState icon={BadgePercent} title="No discounts" message="Sibling, staff and scholarship waivers appear here." />}
      {data?.length > 0 && (
        <section className="card">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr><th>Student</th><th>Term</th><th>Applies to</th><th className="numeric">Discount</th><th>Reason</th><th>Granted</th><th>Status</th><th className="actions"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {data.map((discount) => (
                  <tr key={discount.id} className={discount.status === 'revoked' ? 'is-muted' : undefined}>
                    <td>
                      <span className="data-table__primary">{discount.fullName}</span>
                      <span className="data-table__secondary"><span className="mono">{discount.registrationNumber}</span> · {discount.className}</span>
                    </td>
                    <td>{discount.termName} <span className="mono text-muted">{discount.yearLabel}</span></td>
                    <td>{discount.feeTypeName || 'Whole bill'}</td>
                    <td className="numeric"><strong>{discount.discountType === 'percentage' ? `${discount.value}%` : `TZS ${formatMoney(discount.value)}`}</strong></td>
                    <td>{discount.reason}</td>
                    <td><span className="text-sm">{discount.grantedByName}</span><span className="data-table__secondary mono">{formatDate(discount.createdAt)}</span></td>
                    <td>
                      <StatusBadge status={discount.status} />
                      {discount.revokeReason && <span className="data-table__secondary">{discount.revokeReason}</span>}
                    </td>
                    <td className="actions">
                      {isHeadmaster && discount.status === 'active' && (
                        <button type="button" className="btn btn--ghost btn--icon btn--sm text-danger" aria-label="Revoke discount" onClick={() => setModal({ type: 'revoke', discount })}>
                          <XCircle size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {modal?.type === 'create' && (
        <DiscountModal years={years.data ?? []} feeTypes={feeTypes.data ?? []} defaultTermId={termId || (term ? String(term.id) : '')}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />
      )}
      {modal?.type === 'revoke' && (
        <ReasonModal
          title="Revoke discount"
          confirmLabel="Revoke"
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            await api.post(`/finance/discounts/${modal.discount.id}/revoke`, { reason });
            toast.success('Discount revoked. The student\'s balance has been recalculated.');
            setModal(null);
            reload();
          }}
        >
          <p className="text-sm">{modal.discount.fullName} — {modal.discount.reason}</p>
        </ReasonModal>
      )}
    </div>
  );
}
