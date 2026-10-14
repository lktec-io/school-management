import { Banknote, Download, MessageSquareWarning, Plus, Receipt, TrendingDown, TriangleAlert, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import RecordPaymentModal from '../../pages/finance/RecordPaymentModal.jsx';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { downloadReceipt } from '../../utils/finance.js';
import { formatDate, formatMoney, formatPercent } from '../../utils/format.js';
import { FEE_REMINDER_TEMPLATE } from '../../utils/sms.js';
import SmsComposeModal from '../sms/SmsComposeModal.jsx';
import { InlineAlert } from '../ui/Feedback.jsx';
import PaymentModeBadge from '../ui/PaymentModeBadge.jsx';
import { DualBarChart, Progress, StatTile } from './widgets.jsx';

/** Bursar portal: cash inflow, unpaid bills, income vs expenses, quick defaulter reminders. */
export default function BursarDashboard({ data, onChanged }) {
  const { fees, monthly = [], thisMonth, unpaid, recentPayments = [] } = data;
  const [modal, setModal] = useState(null);
  const { run, pending } = useAsyncAction();

  return (
    <>
      {!fees && (
        <InlineAlert tone="warning" title="No current term" icon={TriangleAlert}>
          <p>Term balances appear once the Headmaster sets the current term.</p>
        </InlineAlert>
      )}
      <div className="kpi-grid">
        <StatTile label="Today's cash inflow (TZS)" value={fees ? formatMoney(fees.todayAmount) : '—'} icon={Banknote} mono tone="success"
          meta={fees ? <span className="mono">{fees.todayPayments} payment(s) today</span> : null} />
        <StatTile label="Collected this term (TZS)" value={fees ? formatMoney(fees.collected) : '—'} icon={Wallet} mono
          meta={fees ? <><span className="mono">{formatPercent(fees.collectionRate)}</span> of bills collected</> : null} />
        <StatTile label="Unpaid bills (TZS)" value={formatMoney(unpaid?.amount ?? 0)} icon={TriangleAlert} mono tone="danger"
          meta={<><span className="mono">{unpaid?.students ?? 0}</span> students owing</>} />
        <StatTile label="Expenses this month (TZS)" value={formatMoney(thisMonth?.expenses ?? 0)} icon={TrendingDown} mono tone="warning"
          meta={<>Income <span className="mono">TZS {formatMoney(thisMonth?.income ?? 0)}</span></>} />
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Income vs expenses — last 6 months</h2>
            <Link to="/finance" className="btn btn--ghost btn--sm">Finance overview</Link>
          </div>
          <div className="card__body"><DualBarChart series={monthly} /></div>
        </section>

        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Fee defaulters</h2>
            <Link to="/finance/defaulters" className="btn btn--ghost btn--sm">Open list</Link>
          </div>
          <div className="card__body stack">
            {fees && (
              <div className="stack">
                <div className="split-row text-sm"><span>Term collection progress</span><span className="mono">{formatPercent(fees.collectionRate)}</span></div>
                <Progress value={fees.collectionRate} label="Term fee collection" />
              </div>
            )}
            <ul className="doc-list">
              {(unpaid?.topDebtors ?? []).length === 0 && <li className="text-muted">Everyone is fully paid.</li>}
              {(unpaid?.topDebtors ?? []).map((row) => (
                <li key={row.studentId}>
                  <span><Link to={`/students/${row.studentId}`}>{row.fullName}</Link> <span className="text-xs text-muted">{row.className}</span></span>
                  <strong className="mono text-danger">{formatMoney(row.balance)}</strong>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn--primary" disabled={!fees || !unpaid?.students} onClick={() => setModal('sms')}>
              <MessageSquareWarning size={16} aria-hidden="true" /> Send fee reminder SMS to all {unpaid?.students ?? 0} defaulters
            </button>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Recent payments</h2>
          <div className="button-row">
            <Link to="/finance/payments" className="btn btn--ghost btn--sm"><Receipt size={14} aria-hidden="true" /> All payments</Link>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setModal('payment')}><Plus size={14} aria-hidden="true" /> Record payment</button>
          </div>
        </div>
        <div className="table-wrapper density-compact">
          <table className="data-table">
            <thead><tr><th>Receipt</th><th>Date</th><th>Student</th><th>Method</th><th className="numeric">Amount (TZS)</th><th className="actions"><span className="sr-only">Receipt</span></th></tr></thead>
            <tbody>
              {recentPayments.length === 0 && <tr><td colSpan={6} className="data-table__empty">No payments recorded yet.</td></tr>}
              {recentPayments.map((payment) => (
                <tr key={payment.id} className={payment.status === 'reversed' ? 'is-muted' : undefined}>
                  <td><span className="receipt-no">{payment.receiptNo}</span></td>
                  <td className="mono">{formatDate(payment.paymentDate)}</td>
                  <td>{payment.fullName}</td>
                  <td><PaymentModeBadge mode={payment.paymentMode} /></td>
                  <td className="numeric"><strong>{formatMoney(payment.amountPaid)}</strong></td>
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

      {modal === 'sms' && (
        <SmsComposeModal
          title="Send fee reminder SMS"
          description={`Personalised reminders to the guardians of every student with an unpaid balance for ${fees?.termName ?? 'the current term'}.`}
          target={{ type: 'defaulters' }}
          defaultMessage={FEE_REMINDER_TEMPLATE}
          category="fee_reminder"
          onClose={() => setModal(null)}
          onSent={() => setModal(null)}
        />
      )}
      {modal === 'payment' && <RecordPaymentModal onClose={() => setModal(null)} onRecorded={onChanged} />}
    </>
  );
}
