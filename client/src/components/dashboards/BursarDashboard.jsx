import { Download, GraduationCap, MessageSquareWarning, Percent, Plus, Receipt, TriangleAlert, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import RecordPaymentModal from '../../pages/finance/RecordPaymentModal.jsx';
import { useAsyncAction } from '../../hooks/useAsyncAction.js';
import { SERIES, monthEnd, monthLabel } from '../../utils/charts.js';
import { downloadReceipt } from '../../utils/finance.js';
import { formatDate, formatMoney, formatNumber, formatPercent } from '../../utils/format.js';
import { FEE_REMINDER_TEMPLATE } from '../../utils/sms.js';
import SmsComposeModal from '../sms/SmsComposeModal.jsx';
import { InlineAlert } from '../ui/Feedback.jsx';
import PaymentModeBadge from '../ui/PaymentModeBadge.jsx';
import { ChartCard, TrendChart } from './charts.jsx';
import { Progress, StatTile } from './widgets.jsx';

/** Bursar portal: cash inflow KPIs, collection charts, defaulters and recent receipts. */
export default function BursarDashboard({ data, onChanged }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { metrics, fees, monthly = [], thisMonth, unpaid, recentPayments = [], paymentModes = [], classFinance = [] } = data;
  const [modal, setModal] = useState(null);
  const { run, pending } = useAsyncAction();

  const modesTotal = paymentModes.reduce((sum, row) => sum + row.amount, 0);

  return (
    <>
      {!fees && (
        <InlineAlert tone="warning" title={t('dash.noTerm')} icon={TriangleAlert}>
          <p>{t('dash.noTermBursar')}</p>
        </InlineAlert>
      )}
      <div className="kpi-grid kpi-grid--three">
        <StatTile label={t('dash.earnings')} value={fees ? formatMoney(fees.collected) : '—'} icon={Wallet} mono tone="success" to="/finance/payments"
          meta={fees ? <>{t('dash.todayShort')} <span className="mono">TZS {formatMoney(fees.todayAmount)}</span> · {t('dash.paymentsToday', { count: fees.todayPayments })}</> : null} />
        <StatTile label={t('dash.totalStudents')} value={formatNumber(metrics?.activeStudents ?? 0, 0)} icon={GraduationCap} mono tone="info" to="/students"
          meta={t('dash.studentsOwing', { count: unpaid?.students ?? 0 })} />
        <StatTile label={t('dash.collectionRate')} value={fees ? formatPercent(fees.collectionRate) : '—'} icon={Percent} mono tone="warning" to="/finance/defaulters"
          meta={<>{t('dash.unpaidBills')}: <span className="mono">TZS {formatMoney(unpaid?.amount ?? 0)}</span></>} />
      </div>

      <div className="chart-grid">
        <ChartCard className="chart-card--wide" title={t('dash.collectionTrend')} caption={t('charts.clickPoint')}>
          <TrendChart
            data={monthly}
            xKey="month"
            money
            labelFormatter={monthLabel}
            lines={[
              { key: 'income', name: t('dash.income'), color: SERIES.success },
              { key: 'expenses', name: t('dash.expenses'), color: SERIES.danger },
            ]}
            onSelect={(row) => navigate(`/finance/payments?dateFrom=${row.month}-01&dateTo=${monthEnd(row.month)}`)}
          />
          <p className="text-xs text-muted">{t('dash.expensesMonth')}: <span className="mono">TZS {formatMoney(thisMonth?.expenses ?? 0)}</span></p>
        </ChartCard>
        <ChartCard title={t('dash.paymentModes')} caption={fees?.termName}>
          <div className="table-wrapper">
            <table className="data-table breakdown-table">
              <thead><tr><th>{t('dash.method')}</th><th className="numeric">{t('dash.count')}</th><th className="numeric">TZS</th><th className="numeric">%</th></tr></thead>
              <tbody>
                {paymentModes.length === 0 && <tr><td colSpan={4} className="data-table__empty">{t('dash.noPayments')}</td></tr>}
                {paymentModes.map((row) => (
                  <tr key={row.mode} className="row-link" onClick={() => navigate(`/finance/payments?paymentMode=${row.mode}`)}>
                    <td><PaymentModeBadge mode={row.mode} /></td>
                    <td className="numeric mono">{row.payments}</td>
                    <td className="numeric mono">{formatMoney(row.amount)}</td>
                    <td className="numeric mono text-muted">{modesTotal ? formatPercent((row.amount / modesTotal) * 100) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              {paymentModes.length > 0 && (
                <tfoot><tr><td>{t('dash.breakdown.total')}</td><td className="numeric mono">{paymentModes.reduce((sum, row) => sum + row.payments, 0)}</td><td className="numeric mono">{formatMoney(modesTotal)}</td><td className="numeric mono">100%</td></tr></tfoot>
              )}
            </table>
          </div>
        </ChartCard>

        <ChartCard className="chart-card--wide" title={t('dash.feesByClass')} caption={fees?.termName}>
          <div className="table-wrapper">
            <table className="data-table data-table--cards breakdown-table">
              <thead>
                <tr>
                  <th>{t('common.class')}</th><th className="numeric">{t('dash.students')}</th>
                  <th className="numeric">{t('dash.collected')}</th><th className="numeric">{t('dash.outstanding')}</th><th style={{ width: '26%' }}>{t('dash.collectionRate')}</th>
                </tr>
              </thead>
              <tbody>
                {classFinance.length === 0 && <tr><td colSpan={5} className="data-table__empty">{t('dash.noFeesSet')}</td></tr>}
                {classFinance.map((row) => (
                  <tr key={row.classId} className="row-link" onClick={() => navigate(`/finance/defaulters?classId=${row.classId}`)}>
                    <td className="data-table__primary" data-label={t('common.class')}>{row.className}</td>
                    <td className="numeric mono" data-label={t('dash.students')}>{row.students}</td>
                    <td className="numeric mono" data-label={t('dash.collected')}>{formatMoney(row.collected)}</td>
                    <td className="numeric mono text-danger" data-label={t('dash.outstanding')}>{formatMoney(row.outstanding)}</td>
                    <td data-label={t('dash.collectionRate')}>
                      <div className="class-matrix__bar">
                        <Progress value={row.collectionRate} label={`${row.className} ${t('dash.collectionRate')}`} />
                        <span className="mono text-sm">{formatPercent(row.collectionRate)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <section className="card">
          <div className="card__header">
            <h2 className="card__title">{t('nav.items.defaulters')}</h2>
            <Link to="/finance/defaulters" className="btn btn--ghost btn--sm">{t('common.viewAll')}</Link>
          </div>
          <div className="card__body stack">
            {fees && (
              <div className="stack">
                <div className="split-row text-sm"><span>{t('dash.termProgress')}</span><span className="mono">{formatPercent(fees.collectionRate)}</span></div>
                <Progress value={fees.collectionRate} label={t('dash.termProgress')} />
              </div>
            )}
            <ul className="doc-list">
              {(unpaid?.topDebtors ?? []).length === 0 && <li className="text-muted">{t('dash.allPaid')}</li>}
              {(unpaid?.topDebtors ?? []).map((row) => (
                <li key={row.studentId}>
                  <span><Link to={`/students/${row.studentId}`}>{row.fullName}</Link> <span className="text-xs text-muted">{row.className}</span></span>
                  <strong className="mono text-danger">{formatMoney(row.balance)}</strong>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn--primary" disabled={!fees || !unpaid?.students} onClick={() => setModal('sms')}>
              <MessageSquareWarning size={16} aria-hidden="true" /> {t('dash.sendReminders', { count: unpaid?.students ?? 0 })}
            </button>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">{t('dash.recentPayments')}</h2>
          <div className="button-row">
            <Link to="/finance/payments" className="btn btn--ghost btn--sm"><Receipt size={14} aria-hidden="true" /> {t('nav.items.payments')}</Link>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setModal('payment')}><Plus size={14} aria-hidden="true" /> {t('dash.recordPayment')}</button>
          </div>
        </div>
        <div className="table-wrapper density-compact">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('dash.receipt')}</th><th>{t('common.date')}</th><th>{t('common.student')}</th><th>{t('dash.method')}</th>
                <th className="numeric">{t('dash.amountTzs')}</th><th className="actions"><span className="sr-only">{t('dash.receipt')}</span></th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.length === 0 && <tr><td colSpan={6} className="data-table__empty">{t('dash.noPayments')}</td></tr>}
              {recentPayments.map((payment) => (
                <tr key={payment.id} className={payment.status === 'reversed' ? 'is-muted' : undefined}>
                  <td><span className="receipt-no">{payment.receiptNo}</span></td>
                  <td className="mono">{formatDate(payment.paymentDate)}</td>
                  <td>{payment.fullName}</td>
                  <td><PaymentModeBadge mode={payment.paymentMode} /></td>
                  <td className="numeric"><strong>{formatMoney(payment.amountPaid)}</strong></td>
                  <td className="actions">
                    <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label={`${t('common.download')} ${payment.receiptNo}`}
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
          title={t('dash.reminderTitle')}
          description={t('dash.reminderDescription', { term: fees?.termName ?? t('dash.currentTerm') })}
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
