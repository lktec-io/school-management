import { Award, FileText, GraduationCap, Layers, Percent, Settings, Users, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { SERIES } from '../../utils/charts.js';
import { formatMoney, formatNumber, formatPercent } from '../../utils/format.js';
import { StatusBadge } from '../ui/StatusBadge.jsx';
import { ChartCard, TrendChart } from './charts.jsx';
import { BreakdownTable, Progress, StatTile } from './widgets.jsx';

/** Headmaster portal: three headline cards, results trend, division summary and class-by-class table. */
export default function AdminDashboard({ data }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { metrics, performance, studentsByClass, statusBreakdown, fees, classFinance = [], trend = [] } = data;

  const financeByClass = new Map(classFinance.map((row) => [row.classId, row]));
  const performanceByClass = new Map((performance?.byClass ?? []).map((row) => [row.classId, row]));
  const rows = studentsByClass.map((cls) => ({
    ...cls,
    finance: financeByClass.get(cls.classId),
    results: performanceByClass.get(cls.classId),
  }));
  const hasValue = (value) => value !== null && value !== undefined;

  return (
    <>
      <div className="kpi-grid kpi-grid--three">
        <StatTile label={t('dash.passRate')} value={hasValue(performance?.passRate) ? formatPercent(performance.passRate) : '—'}
          icon={Award} mono tone="success" to="/marks?view=results"
          meta={performance ? performance.exam.name : t('dash.noResults')} />
        <StatTile label={t('dash.totalStudents')} value={formatNumber(metrics.activeStudents, 0)} icon={GraduationCap} mono tone="info" to="/students"
          meta={<span className="mono">{metrics.maleStudents} {t('dash.breakdown.me')} · {metrics.femaleStudents} {t('dash.breakdown.ke')} · {metrics.activeClasses} {t('dash.classes')}</span>} />
        <StatTile label={t('dash.averageScore')} value={hasValue(performance?.meanAverage) ? formatPercent(performance.meanAverage) : '—'}
          icon={Percent} mono tone="warning"
          meta={performance ? t('dash.candidatesCount', { count: performance.candidates }) : t('dash.noResults')} />
      </div>

      <div className="chart-grid">
        <ChartCard className="chart-card--wide" title={t('dash.trendTitle')} caption={trend.length ? t('dash.trendCaption') : null}>
          <TrendChart
            data={trend}
            xKey="label"
            percent
            emptyText={t('dash.noResultsHint')}
            lines={[
              { key: 'meanAverage', name: t('dash.averageScore'), color: SERIES.primary },
              { key: 'passRate', name: t('dash.passRate'), color: SERIES.success },
            ]}
            onSelect={(row) => navigate(`/marks?view=results&examId=${row.examId}`)}
          />
        </ChartCard>
        <ChartCard title={t('dash.breakdownTitle')} caption={performance ? performance.exam.name : null}>
          <BreakdownTable performance={performance} />
        </ChartCard>
      </div>

      <section className="card">
        <div className="card__header">
          <h2 className="card__title">{t('dash.classMatrix')}</h2>
          <span className="text-xs text-muted">{fees?.termName ?? t('dash.currentTerm')}{performance ? ` · ${performance.exam.name}` : ''}</span>
        </div>
        <div className="table-wrapper density-compact">
          <table className="data-table data-table--cards class-matrix">
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
                  <td className="data-table__primary" data-label={t('common.class')}><Link to={`/students?classId=${row.classId}`}>{row.className}</Link></td>
                  <td className="numeric" data-label={t('dash.students')}>{row.students}</td>
                  <td data-label={t('dash.feeCollection')}>
                    {row.finance ? (
                      <div className="class-matrix__bar">
                        <Progress value={row.finance.collectionRate} label={`${row.className} ${t('dash.feeCollection')}`} />
                        <span className="mono text-sm">{formatPercent(row.finance.collectionRate)}</span>
                      </div>
                    ) : <span className="text-muted text-sm">{t('dash.noFeesSet')}</span>}
                  </td>
                  <td className="numeric" data-label={t('dash.arrears')}>{row.finance ? formatMoney(row.finance.outstanding) : '—'}</td>
                  <td data-label={t('dash.passRate')}>
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
            <div><dt>{t('dash.collectedTerm')}</dt><dd className="mono">{fees ? formatMoney(fees.collected) : '—'}</dd></div>
            <div><dt>{t('dash.arrears')}</dt><dd className="mono">{fees ? formatMoney(fees.outstanding) : '—'}</dd></div>
            <div><dt>{t('dash.teachingStaff')}</dt><dd className="mono">{metrics.activeTeachers}</dd></div>
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
    </>
  );
}
