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
  return to
    ? <Link to={to} className="stat-tile stat-tile--link">{body}</Link>
    : <div className="stat-tile">{body}</div>;
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
