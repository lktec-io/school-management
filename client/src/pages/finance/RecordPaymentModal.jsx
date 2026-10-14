import { CircleCheck, Download, Receipt, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import { InlineAlert, LoadingBlock } from '../../components/ui/Feedback.jsx';
import Modal from '../../components/ui/Modal.jsx';
import StudentSearch from '../../components/ui/StudentSearch.jsx';
import { useAcademicPeriod } from '../../context/AcademicContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useForm } from '../../hooks/useForm.js';
import { downloadReceipt } from '../../utils/finance.js';
import { PAYMENT_MODE_LABELS, classLabel, formatMoney, todayIso } from '../../utils/format.js';

function StatementPanel({ studentId, termId }) {
  const { data, loading, error } = useApi(studentId && termId ? `/finance/students/${studentId}/statement` : null, { termId });
  if (loading && !data) return <LoadingBlock label="Loading account…" />;
  if (error) return <InlineAlert tone="danger">{error.message}</InlineAlert>;
  if (!data) return null;
  const { balance } = data;
  return (
    <div className="statement">
      <table className="statement__items">
        <tbody>
          {balance.items.length === 0 && <tr><td colSpan={2} className="text-muted">No fees configured for this class and term.</td></tr>}
          {balance.items.map((item) => (
            <tr key={item.feeStructureId}>
              <td>{item.feeTypeName}{!item.isMandatory && <span className="text-xs text-muted"> (optional)</span>}</td>
              <td className="amount">{formatMoney(item.amount)}</td>
            </tr>
          ))}
          {balance.discounts.map((discount) => (
            <tr key={`d-${discount.id}`} className="statement__discount">
              <td>Less: {discount.reason}{discount.discountType === 'percentage' ? ` (${discount.value}%)` : ''}</td>
              <td className="amount">−{formatMoney(discount.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td>Term bill</td><td className="amount">{formatMoney(balance.expected)}</td></tr>
          <tr><td>Paid to date</td><td className="amount amount--positive">{formatMoney(balance.paid)}</td></tr>
          <tr className="statement__balance">
            <td>{balance.balance < 0 ? 'Credit' : 'Outstanding'}</td>
            <td className={`amount ${balance.balance > 0 ? 'amount--negative' : 'amount--positive'}`}>{formatMoney(Math.abs(balance.balance))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Record a fee payment. Pass `student` to pre-select (e.g. from a profile or the defaulters list). */
export default function RecordPaymentModal({ student: initialStudent = null, onClose, onRecorded }) {
  const toast = useToast();
  const { term } = useAcademicPeriod();
  const [student, setStudent] = useState(initialStudent);
  const [result, setResult] = useState(null);
  const years = useApi('/academics/years');
  const feeTypes = useApi('/finance/fee-types');
  const form = useForm({
    termId: term ? String(term.id) : '',
    feeTypeId: '',
    amountPaid: '',
    paymentMode: 'cash',
    referenceNo: '',
    paymentDate: todayIso(),
    notes: '',
    sendSms: true,
  });
  const { values, bind, bindCheckbox, errors, formError, submitting, submit } = form;

  const handleSubmit = submit(async (form) => {
    const recorded = await api.post('/finance/payments', { ...form, studentId: student.id });
    setResult(recorded);
    toast.success(`Payment recorded — receipt ${recorded.payment.receiptNo}.`);
    onRecorded?.(recorded);
  });

  if (result) {
    const { payment, balance, sms } = result;
    return (
      <Modal
        title="Payment recorded"
        size="sm"
        onClose={onClose}
        footer={(
          <>
            <button type="button" className="btn btn--outline" onClick={onClose}><X size={16} aria-hidden="true" /> Close</button>
            <button type="button" className="btn btn--primary" onClick={() => downloadReceipt(payment).catch((e) => toast.error(e.message))}>
              <Download size={16} aria-hidden="true" /> Download receipt
            </button>
          </>
        )}
      >
        <div className="payment-success">
          <CircleCheck size={40} aria-hidden="true" />
          <span className="receipt-no payment-success__no">{payment.receiptNo}</span>
          <span className="amount payment-success__amount">{formatMoney(payment.amountPaid)}</span>
          <span className="text-sm">{payment.fullName} · {PAYMENT_MODE_LABELS[payment.paymentMode]}</span>
          <dl className="definition-list">
            <dt>Remaining balance</dt>
            <dd className={`amount ${balance.balance > 0 ? 'amount--negative' : 'amount--positive'}`}>{formatMoney(balance.balance)}</dd>
            <dt>Guardian SMS</dt>
            <dd>{sms.queued ? 'Confirmation queued' : sms.reason}</dd>
          </dl>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Record fee payment"
      size="lg"
      onClose={onClose}
      closeDisabled={submitting}
      footer={(
        <>
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" form="payment-form" className="btn btn--primary" disabled={submitting || !student}>
            {submitting ? <span className="spinner spinner--light" aria-hidden="true" /> : <Receipt size={16} aria-hidden="true" />}
            {submitting ? 'Recording…' : 'Record payment'}
          </button>
        </>
      )}
    >
      <form id="payment-form" className="payment-form" onSubmit={handleSubmit} noValidate>
        <div className="stack">
          {formError && !Object.values(errors).some(Boolean) && <InlineAlert tone="danger">{formError}</InlineAlert>}
          {student ? (
            <div className="selected-student">
              <strong>{student.fullName}</strong>
              <span className="reg-no">{student.registrationNumber}</span>
              <span className="text-muted">{classLabel(student.className, student.streamName)}</span>
              {!initialStudent && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setStudent(null)}>Change</button>
              )}
            </div>
          ) : (
            <FormField label="Student" required error={errors.studentId}>
              <StudentSearch onSelect={setStudent} autoFocus />
            </FormField>
          )}

          <div className="form-grid form-grid--2">
            <FormField label="Term" required error={errors.termId}>
              <select className="form-control" {...bind('termId')}>
                <option value="">Select term…</option>
                {(years.data ?? []).map((year) => (
                  <optgroup key={year.id} label={year.yearLabel}>
                    {year.terms.map((t) => <option key={t.id} value={t.id}>{t.termName} {year.yearLabel}</option>)}
                  </optgroup>
                ))}
              </select>
            </FormField>
            <FormField label="Fee item" error={errors.feeTypeId} hint="Leave as general to pay against the whole bill">
              <select className="form-control" {...bind('feeTypeId')}>
                <option value="">General school fees</option>
                {(feeTypes.data ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
            </FormField>
            <FormField label="Amount (TZS)" required error={errors.amountPaid}>
              <input className="form-control mono amount-input" inputMode="decimal" placeholder="0" {...bind('amountPaid')} />
            </FormField>
            <FormField label="Payment date" required error={errors.paymentDate}>
              <input type="date" className="form-control mono" max={todayIso()} {...bind('paymentDate')} />
            </FormField>
            <FormField label="Payment method" required error={errors.paymentMode}>
              <select className="form-control" {...bind('paymentMode')}>
                {Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </FormField>
            <FormField
              label="Transaction reference"
              required={values.paymentMode !== 'cash'}
              error={errors.referenceNo}
              hint={values.paymentMode === 'mobile_money' ? 'M-Pesa / Tigo Pesa / HaloPesa transaction ID' : values.paymentMode === 'cash' ? 'Optional for cash' : 'Bank slip or transfer reference'}
            >
              <input className="form-control mono" {...bind('referenceNo')} />
            </FormField>
            <FormField label="Notes" error={errors.notes} className="span-2">
              <input className="form-control" maxLength={255} {...bind('notes')} />
            </FormField>
          </div>
          <label className="form-check">
            <input {...bindCheckbox('sendSms')} /> Send SMS confirmation with remaining balance to the guardian
          </label>
        </div>
        <aside className="payment-form__aside">
          <div className="eyebrow">Student account</div>
          {student && values.termId
            ? <StatementPanel studentId={student.id} termId={values.termId} />
            : <p className="text-sm text-muted">Select a student and term to see the bill and balance.</p>}
        </aside>
      </form>
    </Modal>
  );
}
