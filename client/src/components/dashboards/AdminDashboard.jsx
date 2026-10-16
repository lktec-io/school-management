import { Award, FileText, GraduationCap, Layers, MessageSquareText, Percent, Settings, TriangleAlert, Users, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { SERIES, monthEnd, monthLabel } from '../../utils/charts.js';
import { formatMoney, formatNumber, formatPercent } from '../../utils/format.js';
import { StatusBadge } from '../ui/StatusBadge.jsx';
import { BarChartCard, ChartCard, DonutChart, DotChart } from './charts.jsx';
import { PerformanceCard, Progress, StatTile } from './widgets.jsx';

/** Headmaster portal: KPIs first, then interactive enrolment, finance and staffing charts. */
export default function AdminDashboard({ data }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    metrics, performance, studentsByClass, statusBreakdown, fees, classFinance = [], staffByRole = {}, monthly = [], paymentModes = [],
  } = data;
  const sms = useApi('/sms/balance');

  const financeByClass = new Map(classFinance.map((row) => [row.classId, row]));
  const performanceByClass = new Map((performance?.byClass ?? []).map((row) => [row.classId, row]));
  const rows = studentsByClass.map((cls) => ({
    ...cls,
    finance: financeByClass.get(cls.classId),
    results: performanceByClass.get(cls.classId),
  }));

  const smsValue = sms.loading ? '…'
    : sms.data?.creditBalance !== null && sms.data?.creditBalance !== undefined ? formatNumber(sms.data.creditBalance, 0) : '—';

  const genderData = [
    { key: 'male', name: t('gender.male'), value: Number(metrics.maleStudents) || 0, color: SERIES.primary },
    { key: 'female', name: t('gender.female'), value: Number(metrics.femaleStudents) || 0, color: SERIES.accent },
  ];
  const staffData = ['admin', 'accountant', 'teacher'].map((role, index) => ({
    key: role,
    name: t(`roles.${role}`),
    value: Number(staffByRole[role]) || 0,
    color: [SERIES.accent, SERIES.sky, SERIES.primary][index],
  }));
  const modeData = paymentModes.map((row) => ({ key: row.mode, name: t(`paymentModes.${row.mode}`, { defaultValue: row.mode }), value: row.amount }));

  return (
    <>
      <div className="kpi-grid">
        <StatTile label={t('dash.activeStudents')} value={formatNumber(metrics.activeStudents, 0)} icon={GraduationCap} mono to="/students"
          meta={<span className="mono">{metrics.maleStudents} {t('gender.maleShort')} · {metrics.femaleStudents} {t('gender.femaleShort')} · {metrics.activeClasses} {t('dash.classes')}</span>} />
        <StatTile label={t('dash.collectionRate')}
          value={fees?.collectionRate !== null && fees?.collectionRate !== undefined ? formatPercent(fees.collectionRate) : '—'}
          icon={Percent} mono tone={fees?.collectionRate >= 75 ? 'success' : 'warning'} to="/finance"
          meta={fees ? <>{fees.termName} · <span className="mono">TZS {formatMoney(fees.collected)}</span></> : t('dash.noTerm')} />
        <StatTile label={t('dash.arrears')} value={fees ? formatMoney(fees.outstanding) : '—'} icon={TriangleAlert} mono tone="danger"
          to="/finance/defaulters" meta={fees ? t('dash.viewDefaulters') : null} />
        <StatTile label={t('dash.passRate')}
          value={performance?.passRate !== null && performance?.passRate !== undefined ? formatPercent(performance.passRate) : '—'}
          icon={Award} mono tone={performance?.passRate >= 50 ? 'success' : 'warning'} to="/marks?view=results"
          meta={performance ? performance.exam.name : t('dash.noResults')} />
        <StatTile label={t('dash.smsBalance')} value={smsValue} icon={MessageSquareText} mono to="/sms"
          meta={sms.data && !sms.data.configured ? t('dash.smsNotConfigured') : t('nav.items.sms')} />
      </div>

      <div className="chart-grid">
        <ChartCard className="chart-card--wide" title={t('dash.studentsByClass')} caption={t('charts.clickBar')}>
          <BarChartCard
            data={studentsByClass}
            xKey="className"
            stacked
            bars={[
              { key: 'male', name: t('gender.male'), color: SERIES.primary },
              { key: 'female', name: t('gender.female'), color: SERIES.accent },
            ]}
            onSelect={(row) => navigate(`/students?classId=${row.classId}`)}
          />
        </ChartCard>
        <ChartCard title={t('dash.demographics')} caption={t('charts.clickSlice')}>
          <DonutChart data={genderData} centerLabel={t('dash.students')}
            onSelect={(row) => navigate(`/students?gender=${row.key}`)} />
        </ChartCard>

        <ChartCard className="chart-card--wide" title={t('dash.feesByClass')} caption={fees?.termName ?? t('dash.noTerm')}>
          <BarChartCard
            data={classFinance}
            xKey="className"
            stacked
            money
            bars={[
              { key: 'collected', name: t('dash.collected'), color: SERIES.success },
              { key: 'outstanding', name: t('dash.outstanding'), color: SERIES.danger },
            ]}
            onSelect={(row) => navigate(`/finance/defaulters?classId=${row.classId}`)}
          />
        </ChartCard>
        <ChartCard title={t('dash.paymentModes')} caption={t('charts.clickSlice')}>
          <DonutChart data={modeData} money centerLabel="TZS"
            onSelect={(row) => navigate(`/finance/payments?paymentMode=${row.key}`)} />
        </ChartCard>

        <ChartCard className="chart-card--wide" title={t('dash.incomeVsExpenses')} caption={t('charts.clickPoint')}>
          <DotChart
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
        </ChartCard>
        <ChartCard title={t('dash.staff')} caption={t('charts.clickSlice')}>
          <DonutChart data={staffData} centerLabel={t('dash.staffShort')}
            onSelect={(row) => navigate(`/users?role=${row.key}`)} />
        </ChartCard>
      </div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">{t('dash.classMatrix')}</h2>
          <span className="text-xs text-muted">{fees?.termName ?? t('dash.currentTerm')}{performance ? ` · ${performance.exam.name}` : ''}</span>
        </div>
        <div className="table-wrapper density-compact">
          <table className="data-table class-matrix">
            <thead>
              <tr>
                <th>{t('common.class')}</th>
                <th className="numeric">{t('dash.students')}</th>
                <th style={{ width: '24%' }}>{t('dash.feeCollection')}</th>
                <th className="numeric">{t('dash.arrears')}</th>
                <th style={{ width: '24%' }}>{t('dash.passRate')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="data-table__empty">{t('dash.noClasses')}</td></tr>}
              {rows.map((row) => (
                <tr key={row.classId}>
                  <td className="data-table__primary"><Link to={`/students?classId=${row.classId}`}>{row.className}</Link></td>
                  <td className="numeric">{row.students}</td>
                  <td>
                    {row.finance ? (
                      <div className="class-matrix__bar">
                        <Progress value={row.finance.collectionRate} label={`${row.className} ${t('dash.feeCollection')}`} />
                        <span className="mono text-sm">{formatPercent(row.finance.collectionRate)}</span>
                      </div>
                    ) : <span className="text-muted text-sm">{t('dash.noFeesSet')}</span>}
                  </td>
                  <td className="numeric">{row.finance ? formatMoney(row.finance.outstanding) : '—'}</td>
                  <td>
                    {row.results ? (
                      <div className="class-matrix__bar">
                        <Progress value={row.results.passRate} label={`${row.className} ${t('dash.passRate')}`} />
                        <span className="mono text-sm">{formatPercent(row.results.passRate)}</span>
                      </div>
                    ) : <span className="text-muted text-sm">{t('dash.noResultsShort')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="dashboard-grid">
        <PerformanceCard performance={performance} />
        <section className="card">
          <div className="card__header"><h2 className="card__title">{t('dash.glance')}</h2></div>
          <div className="card__body stack">
            <ul className="status-list">
              {Object.entries(statusBreakdown).length === 0 && <li className="text-muted">{t('dash.noStudents')}</li>}
              {Object.entries(statusBreakdown).map(([status, total]) => (
                <li key={status}>
                  <Link to={`/students?status=${status}`} className="status-list__link"><StatusBadge status={status} /> <span className="mono">{total}</span></Link>
                </li>
              ))}
            </ul>
            <dl className="kv-grid">
              <div><dt>{t('dash.teachingStaff')}</dt><dd className="mono">{metrics.activeTeachers}</dd></div>
              <div><dt>{t('dash.subjects')}</dt><dd className="mono">{metrics.activeSubjects}</dd></div>
              <div><dt>{t('dash.streams')}</dt><dd className="mono">{metrics.activeStreams}</dd></div>
              <div><dt>{t('dash.admissions')}</dt><dd className="mono">{metrics.admissionsThisYear}</dd></div>
            </dl>
            <div className="quick-links">
              <Link to="/academics" className="btn btn--outline btn--sm"><Layers size={14} aria-hidden="true" /> {t('nav.items.academics')}</Link>
              <Link to="/reports" className="btn btn--outline btn--sm"><FileText size={14} aria-hidden="true" /> {t('nav.items.reports')}</Link>
              <Link to="/finance" className="btn btn--outline btn--sm"><Wallet size={14} aria-hidden="true" /> {t('nav.sections.finance')}</Link>
              <Link to="/users" className="btn btn--outline btn--sm"><Users size={14} aria-hidden="true" /> {t('nav.items.users')}</Link>
              <Link to="/settings" className="btn btn--outline btn--sm"><Settings size={14} aria-hidden="true" /> {t('nav.items.settings')}</Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
