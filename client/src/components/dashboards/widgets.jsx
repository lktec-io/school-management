import { ArrowUpRight, ChartColumn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatNumber, formatPercent } from '../../utils/format.js';
import { EmptyState } from '../ui/Feedback.jsx';
import { StatusBadge } from '../ui/StatusBadge.jsx';

/** KPI card. With `to`, the whole card is a link to the detailed view. */
export function StatTile({ label, value, meta, icon: Icon, tone, mono = false, to }) {
  const body = (
    <>
      <div className="stat-tile__top">
        <span className="stat-tile__label">{label}</span>
        {Icon && <span className={`stat-tile__icon${tone ? ` stat-tile__icon--${tone}` : ''}`} aria-hidden="true"><Icon size={18} /></span>}
      </div>
      <div className={`stat-tile__value${mono ? ' mono' : ''}`}>{value}</div>
      {meta && <div className="stat-tile__meta">{meta}</div>}
      {to && <ArrowUpRight size={14} className="stat-tile__go" aria-hidden="true" />}
    </>
  );
  // Soft tinted card per tone: green = money in, red = expenses/arrears, blue = totals, amber = pending.
  const className = `stat-tile stat-tile--${tone || 'info'}`;
  return to
    ? <Link to={to} className={`${className} stat-tile--link`}>{body}</Link>
    : <div className={className}>{body}</div>;
}

/** Horizontal progress bar; tone defaults by value (≥75 good, ≥50 warning, else danger). */
export function Progress({ value, tone, label }) {
  const pct = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, Number(value)));
  const resolved = tone || (value === null || value === undefined ? 'neutral' : pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'danger');
  return (
    <span className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span className={`progress__fill progress__fill--${resolved}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

export function PerformanceCard({ performance, title }) {
  const { t } = useTranslation();
  const heading = title ?? t('dash.latestPerformance');
  if (!performance) {
    return (
      <section className="card">
        <div className="card__header"><h2 className="card__title">{heading}</h2></div>
        <div className="card__body">
          <EmptyState icon={ChartColumn} title={t('dash.noResults')} message={t('dash.noResultsHint')} />
        </div>
      </section>
    );
  }
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">{heading}</h2>
        <span className="text-sm text-muted">
          {performance.exam.name} · {performance.exam.termName} <span className="mono">{performance.exam.yearLabel}</span>{' '}
          <StatusBadge status={performance.exam.status} />
        </span>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('common.class')}</th>
              <th className="numeric">{t('dash.candidates')}</th>
              <th className="numeric">{t('dash.meanPercent')}</th>
              <th style={{ width: '35%' }}>{t('dash.passRate')}</th>
            </tr>
          </thead>
          <tbody>
            {performance.byClass.map((row) => (
              <tr key={row.classId}>
                <td className="data-table__primary">{row.className}</td>
                <td className="numeric">{row.candidates}</td>
                <td className="numeric">{formatNumber(row.meanAverage)}</td>
                <td>
                  <div className="class-matrix__bar">
                    <Progress value={row.passRate} label={`${row.className} ${t('dash.passRate')}`} />
                    <span className="mono text-sm">{formatPercent(row.passRate)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Results summary by division (secondary, NECTA style) or overall grade (primary/nursery),
 * split ME (male) / KE (female) — as on official results sheets.
 */
export function BreakdownTable({ performance }) {
  const { t } = useTranslation();
  const divisions = performance?.divisions;
  const grades = performance?.grades;
  const useDivisions = divisions?.totals.total > 0;
  const table = useDivisions ? divisions : grades;
  if (!table || table.totals.total === 0) {
    return <p className="chart-empty">{t('dash.noResultsHint')}</p>;
  }
  const label = (value) => (useDivisions ? (value === 'INC' ? t('dash.breakdown.incomplete') : `DIV ${value}`) : `${t('dash.breakdown.grade')} ${value}`);
  const pct = (count) => `${formatNumber((count / table.totals.total) * 100, 1)}%`;
  return (
    <div className="table-wrapper">
      <table className="data-table breakdown-table">
        <thead>
          <tr>
            <th>{useDivisions ? t('dash.breakdown.division') : t('dash.breakdown.grade')}</th>
            <th className="numeric">{t('dash.breakdown.me')}</th>
            <th className="numeric">{t('dash.breakdown.ke')}</th>
            <th className="numeric">{t('dash.breakdown.total')}</th>
            <th className="numeric">%</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.label}>
              <td><span className={`breakdown-label breakdown-label--${String(row.label).toLowerCase()}`}>{label(row.label)}</span></td>
              <td className="numeric mono">{row.male}</td>
              <td className="numeric mono">{row.female}</td>
              <td className="numeric mono"><strong>{row.total}</strong></td>
              <td className="numeric mono text-muted">{pct(row.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{t('dash.breakdown.total')}</td>
            <td className="numeric mono">{table.totals.male}</td>
            <td className="numeric mono">{table.totals.female}</td>
            <td className="numeric mono">{table.totals.total}</td>
            <td className="numeric mono">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
