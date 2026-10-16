import { Banknote, Download, MessageSquareText, Plus, Receipt, TrendingDown, TriangleAlert, Users, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBlock, InlineAlert, LoadingBlock } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import PaymentModeBadge from '../../components/ui/PaymentModeBadge.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { downloadReceipt } from '../../utils/finance.js';
import { EXPENSE_CATEGORY_LABELS, PAYMENT_MODE_LABELS, formatDate, formatMoney, formatNumber, formatPercent } from '../../utils/format.js';
import RecordPaymentModal from './RecordPaymentModal.jsx';
import { useTranslation } from 'react-i18next';

function MoneyTile({ label, value, meta, icon: Icon, tone }) {
  return (
    <div className={`stat-tile${tone ? ` stat-tile--${tone}` : ''}`}>
      <Icon size={22} className="stat-tile__icon" aria-hidden="true" />
      <div className="stat-tile__label">{label}</div>
      <div className="stat-tile__value mono">{value}</div>
      {meta && <div className="stat-tile__meta">{meta}</div>}
    </div>
  );
}

function DailyChart({ days }) {
  const max = Math.max(1, ...days.map((day) => day.amount));
  return (
    <div className="day-chart" role="img" aria-label="Fee collections over the last 14 days">
      {days.map((day) => {
        const date = new Date(`${day.date}T12:00:00`);
        return (
          <div key={day.date} className="day-chart__col" title={`${formatDate(day.date)}: TZS ${formatMoney(day.amount)} (${day.payments} payments)`}>
            <span className="day-chart__bar" style={{ height: `${Math.max(day.amount ? 4 : 0, (day.amount / max) * 100)}%` }} />
            <span className="day-chart__label mono">{date.getDate()}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function FinanceOverview() {
  const { t } = useTranslation();
  const { data, error, loading, reload } = useApi('/finance/overview');
  const summary = useApi('/finance/summary');
  const smsBalance = useApi('/sms/balance');
  const [recording, setRecording] = useState(false);
  const { run, pending } = useAsyncAction();

  const smsValue = smsBalance.loading
    ? '…'
    : smsBalance.data?.creditBalance !== null && smsBalance.data?.creditBalance !== undefined
      ? formatNumber(smsBalance.data.creditBalance, 0)
      : '—';

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={data?.term ? `${data.term.termName} · ${data.term.yearLabel}` : t('nav.sections.finance')}
        title={t('pages.finance.title')}
        subtitle={t('pages.finance.subtitle')}
        actions={(
          <>
            <Link to="/finance/defaulters" className="btn btn--outline"><Users size={16} aria-hidden="true" /> Defaulters</Link>
            <button type="button" className="btn btn--primary" onClick={() => setRecording(true)}>
              <Plus size={16} aria-hidden="true" /> Record payment
            </button>
          </>
        )}
      />

      {loading && !data && <LoadingBlock label="Loading finance figures…" />}
      <ErrorBlock error={error} onRetry={reload} />
      {data && !data.term && (
        <InlineAlert tone="warning" title="No current term" icon={TriangleAlert}>
          <p>Term figures appear once the Headmaster sets the current term in Academic Setup.</p>
        </InlineAlert>
      )}

      {data && (
        <>
          <div className="stat-grid">
            <MoneyTile label="Revenue collected (TZS)" value={data.term ? formatMoney(data.collected) : '—'} icon={Banknote} tone="success"
              meta={data.term ? <><span className="mono">{formatPercent(data.collectionRate)}</span> of <span className="mono">{formatMoney(data.expected)}</span> billed</> : null} />
            <MoneyTile label="Outstanding arrears (TZS)" value={data.term ? formatMoney(data.outstanding) : '—'} icon={TriangleAlert} tone="danger"
              meta={data.term ? <><span className="mono">{data.defaulters}</span> students owing · <Link to="/finance/defaulters">view</Link></> : null} />
            <MoneyTile label="Expenses this term (TZS)" value={data.term ? formatMoney(data.expenses) : '—'} icon={TrendingDown} tone="warning"
              meta={data.term ? <>Net position <span className={`mono ${data.net < 0 ? 'text-danger' : ''}`}>{formatMoney(data.net)}</span></> : null} />
            <MoneyTile label="Beem SMS balance" value={smsValue} icon={MessageSquareText}
              meta={smsBalance.data && !smsBalance.data.configured ? 'Gateway not configured' : smsBalance.data?.error ? 'Balance unavailable' : 'credits'} />
          </div>

          <div className="dashboard-grid">
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Collections — last 14 days</h2>
                <span className="text-sm text-muted">Today <strong className="amount">{formatMoney(data.today.amount)}</strong> <span className="mono">({data.today.payments})</span></span>
              </div>
              <div className="card__body">
                <DailyChart days={data.last14Days} />
              </div>
            </section>
            <section className="card">
              <div className="card__header"><h2 className="card__title">This term by payment method</h2></div>
              <div className="card__body stack">
                {(data.byMode ?? []).length === 0 && <p className="text-sm text-muted">No payments recorded this term yet.</p>}
                {(data.byMode ?? []).map((row) => (
                  <div key={row.paymentMode} className="breakdown-row">
                    <div className="split-row">
                      <span>{PAYMENT_MODE_LABELS[row.paymentMode]} <span className="text-xs text-muted mono">({row.payments})</span></span>
                      <span className="amount">{formatMoney(row.amount)}</span>
                    </div>
                    <span className="bar" aria-hidden="true"><span className="bar__fill bar__fill--success" style={{ width: `${Math.max(2, (row.amount / Math.max(1, data.collected)) * 100)}%` }} /></span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="dashboard-grid">
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Recent payments</h2>
                <Link to="/finance/payments" className="btn btn--ghost btn--sm">All payments</Link>
              </div>
              <div className="table-wrapper density-compact">
                <table className="data-table">
                  <thead>
                    <tr><th>Receipt</th><th>Student</th><th>Method</th><th className="numeric">Amount (TZS)</th><th className="actions"><span className="sr-only">Receipt</span></th></tr>
                  </thead>
                  <tbody>
                    {data.recentPayments.length === 0 && <tr><td colSpan={5} className="data-table__empty">No payments yet.</td></tr>}
                    {data.recentPayments.map((payment) => (
                      <tr key={payment.id} className={payment.status === 'reversed' ? 'is-muted' : undefined}>
                        <td><span className="receipt-no">{payment.receiptNo}</span><span className="data-table__secondary mono">{formatDate(payment.paymentDate)}</span></td>
                        <td>{payment.fullName}{payment.status === 'reversed' && <> <StatusBadge status="reversed" /></>}</td>
                        <td><PaymentModeBadge mode={payment.paymentMode} /></td>
                        <td className="numeric">{formatMoney(payment.amountPaid)}</td>
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

            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Income vs expenditure</h2>
                {summary.data && <span className="text-xs text-muted mono">{formatDate(summary.data.dateFrom)} – {formatDate(summary.data.dateTo)}</span>}
              </div>
              {summary.data ? (
                <div className="card__body stack">
                  <dl className="kv-grid">
                    <div><dt>Income</dt><dd className="amount amount--positive">{formatMoney(summary.data.income.total)}</dd></div>
                    <div><dt>Expenditure</dt><dd className="amount amount--negative">{formatMoney(summary.data.expenses.total)}</dd></div>
                    <div><dt>Net</dt><dd className={`amount ${summary.data.net < 0 ? 'amount--negative' : ''}`}>{formatMoney(summary.data.net)}</dd></div>
                  </dl>
                  <table className="data-table density-compact">
                    <thead><tr><th>Month</th><th className="numeric">Income</th><th className="numeric">Expenses</th><th className="numeric">Net</th></tr></thead>
                    <tbody>
                      {summary.data.monthly.length === 0 && <tr><td colSpan={4} className="data-table__empty">No transactions in this period.</td></tr>}
                      {summary.data.monthly.map((row) => (
                        <tr key={row.month}>
                          <td className="mono">{row.month}</td>
                          <td className="numeric">{formatMoney(row.income)}</td>
                          <td className="numeric">{formatMoney(row.expenses)}</td>
                          <td className={`numeric ${row.net < 0 ? 'text-danger' : ''}`}>{formatMoney(row.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {summary.data.expenses.byCategory.length > 0 && (
                    <p className="text-xs text-muted">
                      Largest expense: {EXPENSE_CATEGORY_LABELS[summary.data.expenses.byCategory[0].category]}{' '}
                      (<span className="mono">TZS {formatMoney(summary.data.expenses.byCategory[0].amount)}</span>) · <Link to="/finance/expenses">Expenses</Link>
                    </p>
                  )}
                </div>
              ) : <LoadingBlock />}
            </section>
          </div>

          <div className="quick-links">
            <Link to="/finance/fees" className="btn btn--outline btn--sm"><Wallet size={14} aria-hidden="true" /> Fee setup</Link>
            <Link to="/finance/payments" className="btn btn--outline btn--sm"><Receipt size={14} aria-hidden="true" /> Payments</Link>
            <Link to="/sms" className="btn btn--outline btn--sm"><MessageSquareText size={14} aria-hidden="true" /> SMS Center</Link>
          </div>
        </>
      )}

      {recording && (
        <RecordPaymentModal
          onClose={() => setRecording(false)}
          onRecorded={() => {
            reload();
            summary.reload();
          }}
        />
      )}
    </div>
  );
}
