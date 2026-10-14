import { CircleCheck, Download, FileText, GraduationCap, Receipt, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, saveBlob } from '../../api/client.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { downloadReceipt } from '../../utils/finance.js';
import { classLabel, formatDate, formatMoney } from '../../utils/format.js';
import { EmptyState } from '../ui/Feedback.jsx';
import { StatusBadge } from '../ui/StatusBadge.jsx';

function initialsOf(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

/** Parent portal: mobile-first cards with balance banner, report cards and receipts per child. */
export default function ParentDashboard({ data }) {
  const { run, pending } = useAsyncAction();
  const { children, metrics } = data;

  if (children.length === 0) {
    return (
      <EmptyState icon={GraduationCap} title="No students linked to your account"
        message="Please contact the school office to link your children to this parent account." />
    );
  }

  const downloadReport = (child, report) => run(`report-${child.id}-${report.examId}`, async () => {
    const blob = await api.blob(`/reports/students/${child.id}/report-card.pdf`, { examId: report.examId });
    saveBlob(blob, `report-card-${child.registrationNumber.replace(/\//g, '-')}-${report.examName}.pdf`.replace(/\s+/g, '-').toLowerCase());
  });

  const owing = metrics.totalBalance > 0;
  return (
    <div className="stack-lg">
      <div className={`balance-banner${owing ? '' : ' balance-banner--clear'}`} role="status">
        <div>
          <div className="eyebrow" style={{ color: 'inherit' }}>{owing ? 'Outstanding school fees' : 'School fees'}</div>
          <div className="balance-banner__amount">{owing ? `TZS ${formatMoney(metrics.totalBalance)}` : 'Fully paid'}</div>
          <div className="text-sm">{owing ? 'Total for the current term across your children' : 'Thank you — no balance for the current term'}</div>
        </div>
        {owing ? <Wallet size={36} aria-hidden="true" /> : <CircleCheck size={36} aria-hidden="true" />}
      </div>

      <div className="child-grid">
        {children.map((child) => (
          <article key={child.id} className="card child-portal">
            <div className="card__body stack">
              <div className="child-portal__head">
                <span className="child-portal__avatar" aria-hidden="true">{initialsOf(child.fullName)}</span>
                <div>
                  <h2 className="child-card__name">{child.fullName}</h2>
                  <span className="reg-no">{child.registrationNumber}</span>
                  <span className="text-sm text-muted"> · {classLabel(child.className, child.streamName)}</span>
                </div>
              </div>
              <StatusBadge status={child.status} />

              {child.fees && (
                <div className="child-portal__balance">
                  <span className="text-sm">{child.fees.termName} balance</span>
                  <strong className={`amount ${child.fees.balance > 0 ? 'amount--negative' : 'amount--positive'}`}>{formatMoney(Math.max(0, child.fees.balance))}</strong>
                  <span className="text-xs text-muted" style={{ width: '100%' }}>
                    Bill <span className="mono">{formatMoney(child.fees.expected)}</span> · Paid <span className="mono">{formatMoney(child.fees.paid)}</span>
                    {child.fees.discount > 0 && <> · Discount <span className="mono">{formatMoney(child.fees.discount)}</span></>}
                  </span>
                </div>
              )}

              <div>
                <div className="eyebrow"><FileText size={12} aria-hidden="true" className="inline-icon" />Report cards</div>
                <ul className="doc-list">
                  {child.reports.length === 0 && <li className="text-muted">No published report cards yet.</li>}
                  {child.reports.map((report) => (
                    <li key={report.examId}>
                      <span>{report.examName} <span className="text-xs text-muted">{report.termName} <span className="mono">{report.yearLabel}</span></span></span>
                      <span className="button-row">
                        <Link to={`/reports?studentId=${child.id}&examId=${report.examId}`} className="btn btn--ghost btn--sm">View</Link>
                        <button type="button" className="btn btn--outline btn--sm" aria-label={`Download ${report.examName} report card`}
                          disabled={pending === `report-${child.id}-${report.examId}`} onClick={() => downloadReport(child, report)}>
                          <Download size={14} aria-hidden="true" /> PDF
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="eyebrow"><Receipt size={12} aria-hidden="true" className="inline-icon" />Payment receipts</div>
                <ul className="doc-list">
                  {child.payments.length === 0 && <li className="text-muted">No payments recorded yet.</li>}
                  {child.payments.map((payment) => (
                    <li key={payment.id}>
                      <span>
                        <span className="receipt-no">{payment.receiptNo}</span>{' '}
                        <span className="text-xs text-muted mono">{formatDate(payment.paymentDate)}</span>
                        {payment.status === 'reversed' && <> <StatusBadge status="reversed" /></>}
                      </span>
                      <span className="button-row">
                        <span className="amount">{formatMoney(payment.amountPaid)}</span>
                        <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`Download receipt ${payment.receiptNo}`}
                          disabled={pending === `receipt-${payment.id}`} onClick={() => run(`receipt-${payment.id}`, () => downloadReceipt(payment))}>
                          <Download size={15} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="card__footer child-card__actions">
              <Link to={`/students/${child.id}`} className="btn btn--outline btn--sm">Full profile</Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
