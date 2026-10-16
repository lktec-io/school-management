import { CircleCheck, Download, FileText, GraduationCap, Receipt, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api, saveBlob } from '../../api/client.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { downloadReceipt } from '../../utils/finance.js';
import { classLabel, formatDate, formatMoney } from '../../utils/format.js';
import { EmptyState } from '../ui/Feedback.jsx';
import { StatusBadge } from '../ui/StatusBadge.jsx';
import StudentAvatar from '../ui/StudentAvatar.jsx';

/** Parent portal: mobile-first cards with balance banner, report cards and receipts per child. */
export default function ParentDashboard({ data }) {
  const { t } = useTranslation();
  const { run, pending } = useAsyncAction();
  const { children, metrics } = data;

  if (children.length === 0) {
    return <EmptyState icon={GraduationCap} title={t('dash.noChildren')} message={t('dash.noChildrenHint')} />;
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
          <div className="balance-banner__eyebrow">{owing ? t('dash.outstandingFees') : t('dash.schoolFees')}</div>
          <div className="balance-banner__amount">{owing ? `TZS ${formatMoney(metrics.totalBalance)}` : t('dash.fullyPaid')}</div>
          <div className="text-sm">{owing ? t('dash.owingHint') : t('dash.paidHint')}</div>
        </div>
        {owing ? <Wallet size={36} aria-hidden="true" /> : <CircleCheck size={36} aria-hidden="true" />}
      </div>

      <div className="child-grid">
        {children.map((child) => (
          <article key={child.id} className="card child-portal">
            <div className="card__body stack">
              <div className="child-portal__head">
                <StudentAvatar name={child.fullName} photoUrl={child.photoUrl} size="lg" />
                <div>
                  <h2 className="child-card__name">{child.fullName}</h2>
                  <span className="reg-no">{child.registrationNumber}</span>
                  <span className="text-sm text-muted"> · {classLabel(child.className, child.streamName)}</span>
                  <div><StatusBadge status={child.status} /></div>
                </div>
              </div>

              {child.fees && (
                <div className="child-portal__balance">
                  <span className="text-sm">{t('dash.termBalance', { term: child.fees.termName })}</span>
                  <strong className={`amount ${child.fees.balance > 0 ? 'amount--negative' : 'amount--positive'}`}>{formatMoney(Math.max(0, child.fees.balance))}</strong>
                  <span className="text-xs text-muted" style={{ width: '100%' }}>
                    {t('dash.bill')} <span className="mono">{formatMoney(child.fees.expected)}</span> · {t('dash.paid')} <span className="mono">{formatMoney(child.fees.paid)}</span>
                    {child.fees.discount > 0 && <> · {t('dash.discount')} <span className="mono">{formatMoney(child.fees.discount)}</span></>}
                  </span>
                </div>
              )}

              <div>
                <div className="eyebrow"><FileText size={12} aria-hidden="true" className="inline-icon" />{t('nav.items.reports')}</div>
                <ul className="doc-list">
                  {child.reports.length === 0 && <li className="text-muted">{t('dash.noReports')}</li>}
                  {child.reports.map((report) => (
                    <li key={report.examId}>
                      <span>{report.examName} <span className="text-xs text-muted">{report.termName} <span className="mono">{report.yearLabel}</span></span></span>
                      <span className="button-row">
                        <Link to={`/reports?studentId=${child.id}&examId=${report.examId}`} className="btn btn--ghost btn--sm">{t('common.view')}</Link>
                        <button type="button" className="btn btn--outline btn--sm" aria-label={`${t('common.download')} ${report.examName}`}
                          disabled={pending === `report-${child.id}-${report.examId}`} onClick={() => downloadReport(child, report)}>
                          <Download size={14} aria-hidden="true" /> PDF
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="eyebrow"><Receipt size={12} aria-hidden="true" className="inline-icon" />{t('dash.receipts')}</div>
                <ul className="doc-list">
                  {child.payments.length === 0 && <li className="text-muted">{t('dash.noPayments')}</li>}
                  {child.payments.map((payment) => (
                    <li key={payment.id}>
                      <span>
                        <span className="receipt-no">{payment.receiptNo}</span>{' '}
                        <span className="text-xs text-muted mono">{formatDate(payment.paymentDate)}</span>
                        {payment.status === 'reversed' && <> <StatusBadge status="reversed" /></>}
                      </span>
                      <span className="button-row">
                        <span className="amount">{formatMoney(payment.amountPaid)}</span>
                        <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`${t('common.download')} ${payment.receiptNo}`}
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
              <Link to={`/students/${child.id}`} className="btn btn--outline btn--sm">{t('dash.fullProfile')}</Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
