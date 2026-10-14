import { ArrowLeft, Download, FileText, Pencil, Receipt, RefreshCw, UserRound, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import FormField from '../../components/ui/FormField.jsx';
import { EmptyState, ErrorBlock, InlineAlert, LoadingBlock } from '../../components/ui/Feedback.jsx';
import Modal from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PaymentModeBadge from '../../components/ui/PaymentModeBadge.jsx';
import { GradeChip, StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { useForm } from '../../hooks/useForm.js';
import { downloadReceipt } from '../../utils/finance.js';
import {
  EXAM_TYPE_LABELS, LEVEL_LABELS, classLabel, formatDate, formatMoney, formatNumber, formatPhone, titleCase,
} from '../../utils/format.js';
import RecordPaymentModal from '../finance/RecordPaymentModal.jsx';
import StudentRegisterModal from './StudentRegisterModal.jsx';

function StatusChangeModal({ student, transitions, onClose, onSaved }) {
  const toast = useToast();
  const { bind, errors, formError, submitting, submit } = useForm({ status: transitions[0] ?? '', statusReason: '' });

  const handleSubmit = submit(async (form) => {
    const saved = await api.put(`/students/${student.id}`, form);
    toast.success(`${saved.fullName} is now ${saved.status}.`);
    onSaved();
  });

  return (
    <Modal
      title="Change student status"
      size="sm"
      onClose={onClose}
      closeDisabled={submitting}
      footer={(
        <>
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" form="status-form" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Confirm change'}
          </button>
        </>
      )}
    >
      <form id="status-form" className="stack" onSubmit={handleSubmit} noValidate>
        {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
        <p className="text-sm">
          Current status: <StatusBadge status={student.status} />
        </p>
        <FormField label="New status" required error={errors.status}>
          <select className="form-control" {...bind('status')}>
            {transitions.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}
          </select>
        </FormField>
        <FormField label="Reason" error={errors.statusReason} hint="Recorded in the audit log">
          <textarea className="form-control" rows={3} maxLength={255} {...bind('statusReason')} />
        </FormField>
      </form>
    </Modal>
  );
}

export default function StudentProfile() {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isParent = hasRole('parent');
  const { data, error, loading, reload } = useApi(`/students/${id}`);
  const canRecordPayments = hasRole('admin', 'accountant');
  const classes = useApi(isAdmin ? '/academics/classes' : null);
  const [modal, setModal] = useState(null);
  const { run, pending } = useAsyncAction();

  if (loading && !data) return <LoadingBlock label="Loading student profile…" />;
  if (error && !data) return <ErrorBlock error={error} onRetry={reload} />;
  if (!data) return null;

  const { student, performance, fees, allowedStatusTransitions } = data;

  return (
    <div className="stack-lg">
      <Link to="/students" className="back-link"><ArrowLeft size={14} aria-hidden="true" /> {isParent ? 'My children' : 'All students'}</Link>
      <PageHeader
        eyebrow={<span className="reg-no">{student.registrationNumber}</span>}
        title={student.fullName}
        subtitle={<>{classLabel(student.className, student.streamName)} · {LEVEL_LABELS[student.level]} · <StatusBadge status={student.status} /></>}
        actions={(
          <>
            {performance.length > 0 && (
              <Link to={`/reports?studentId=${student.id}&examId=${performance[0].examId}`} className="btn btn--outline">
                <FileText size={16} aria-hidden="true" /> Latest report card
              </Link>
            )}
            {isAdmin && allowedStatusTransitions.length > 0 && (
              <button type="button" className="btn btn--outline" onClick={() => setModal('status')}>
                <RefreshCw size={16} aria-hidden="true" /> Change status
              </button>
            )}
            {isAdmin && (
              <button type="button" className="btn btn--primary" onClick={() => setModal('edit')} disabled={!classes.data}>
                <Pencil size={16} aria-hidden="true" /> Edit details
              </button>
            )}
          </>
        )}
      />

      <div className="profile-grid">
        <section className="card">
          <div className="card__header"><h2 className="card__title">Bio-data</h2><UserRound size={16} aria-hidden="true" /></div>
          <dl className="definition-list card__body">
            <dt>Full name</dt><dd>{student.fullName}</dd>
            <dt>Gender</dt><dd>{student.gender === 'male' ? 'Male' : 'Female'}</dd>
            <dt>Date of birth</dt><dd className="mono">{formatDate(student.dob)}</dd>
            <dt>Home address</dt><dd>{student.address || '—'}</dd>
          </dl>
        </section>
        <section className="card">
          <div className="card__header"><h2 className="card__title">Placement</h2></div>
          <dl className="definition-list card__body">
            <dt>Registration no.</dt><dd className="reg-no">{student.registrationNumber}</dd>
            <dt>Class</dt><dd>{student.className}</dd>
            <dt>Stream</dt><dd>{student.streamName || '—'}</dd>
            <dt>Admission date</dt><dd className="mono">{formatDate(student.admissionDate)}</dd>
          </dl>
        </section>
        <section className="card">
          <div className="card__header"><h2 className="card__title">Parent / guardian</h2></div>
          <dl className="definition-list card__body">
            <dt>Name</dt><dd>{student.parentName}</dd>
            <dt>Phone (SMS)</dt><dd className="mono">{formatPhone(student.parentPhone)}</dd>
            <dt>Portal account</dt><dd>{student.parentAccountName || <span className="text-muted">Not linked</span>}</dd>
          </dl>
        </section>
      </div>

      {fees && (
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Fee history</h2>
            {canRecordPayments ? (
              <button type="button" className="btn btn--primary btn--sm" onClick={() => setModal('payment')}>
                <Receipt size={14} aria-hidden="true" /> Record payment
              </button>
            ) : <Wallet size={16} aria-hidden="true" />}
          </div>
          {fees.currentTerm ? (
            <div className="card__body">
              <dl className="kv-grid">
                <div><dt>{fees.currentTerm.termName} — bill</dt><dd className="amount">{formatMoney(fees.currentTerm.gross)}</dd></div>
                {fees.currentTerm.discount > 0 && (
                  <div>
                    <dt>Discounts</dt>
                    <dd className="amount amount--positive" title={fees.currentTerm.discounts.map((d) => d.reason).join(', ')}>−{formatMoney(fees.currentTerm.discount)}</dd>
                  </div>
                )}
                <div><dt>Expected</dt><dd className="amount">{formatMoney(fees.currentTerm.expected)}</dd></div>
                <div><dt>Paid this term</dt><dd className="amount amount--positive">{formatMoney(fees.currentTerm.paid)}</dd></div>
                <div>
                  <dt>Balance</dt>
                  <dd className={`amount ${fees.currentTerm.balance > 0 ? 'amount--negative' : 'amount--positive'}`}>
                    {formatMoney(fees.currentTerm.balance)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="card__body text-sm text-muted">No current term is set, so the term balance cannot be calculated.</div>
          )}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt No.</th><th>Date</th><th>Term</th><th>Fee type</th><th>Mode</th><th>Reference</th>
                  <th className="numeric">Amount (TZS)</th><th>Status</th>
                  <th className="actions"><span className="sr-only">Receipt</span></th>
                </tr>
              </thead>
              <tbody>
                {fees.payments.length === 0 && (
                  <tr><td colSpan={9} className="data-table__empty">No payments recorded yet.</td></tr>
                )}
                {fees.payments.map((payment) => (
                  <tr key={payment.id} className={payment.status === 'reversed' ? 'is-muted' : undefined}>
                    <td><span className="receipt-no">{payment.receiptNo}</span></td>
                    <td className="mono">{formatDate(payment.paymentDate)}</td>
                    <td>{payment.termName} <span className="mono text-muted">{payment.yearLabel}</span></td>
                    <td>{payment.feeTypeName || 'General'}</td>
                    <td><PaymentModeBadge mode={payment.paymentMode} /></td>
                    <td className="mono">{payment.referenceNo || '—'}</td>
                    <td className="numeric">{formatMoney(payment.amountPaid)}</td>
                    <td><StatusBadge status={payment.status} /></td>
                    <td className="actions">
                      <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Download receipt ${payment.receiptNo}`}
                        disabled={pending === payment.id} onClick={() => run(payment.id, () => downloadReceipt(payment))}>
                        <Download size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!hasRole('accountant') && (
        <section className="card">
          <div className="card__header"><h2 className="card__title">Examination performance</h2></div>
          {performance.length === 0 ? (
            <div className="card__body">
              <EmptyState icon={FileText} title="No results yet" message={isParent ? 'Results appear here once the school publishes them.' : 'No marks have been recorded for this student.'} />
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Examination</th><th>Term</th><th>Class</th>
                    <th className="numeric">Subjects</th><th className="numeric">Total</th><th className="numeric">Average %</th>
                    <th className="center">Grade</th><th className="numeric">Position</th>
                    <th className="actions"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map((row) => (
                    <tr key={`${row.examId}-${row.classId}`}>
                      <td>
                        <span className="data-table__primary">{row.examName}</span>
                        <span className="data-table__secondary">{EXAM_TYPE_LABELS[row.examType]} · <StatusBadge status={row.examStatus} /></span>
                      </td>
                      <td>{row.termName} <span className="mono text-muted">{row.yearLabel}</span></td>
                      <td>{row.className}</td>
                      <td className="numeric">{row.subjectsSat}</td>
                      <td className="numeric">{formatNumber(row.totalScore)}</td>
                      <td className="numeric">{formatNumber(row.averagePct)}</td>
                      <td className="center"><GradeChip grade={row.grade} /></td>
                      <td className="numeric">{row.classPosition} / {row.classSize}</td>
                      <td className="actions">
                        <Link to={`/reports?studentId=${student.id}&examId=${row.examId}`} className="btn btn--ghost btn--sm">
                          <FileText size={14} aria-hidden="true" /> Report
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {modal === 'edit' && (
        <StudentRegisterModal
          student={student}
          classes={classes.data ?? []}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal === 'status' && (
        <StatusChangeModal
          student={student}
          transitions={allowedStatusTransitions}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal === 'payment' && (
        <RecordPaymentModal student={student} onClose={() => setModal(null)} onRecorded={reload} />
      )}
    </div>
  );
}
