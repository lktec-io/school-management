import { Activity, ChartColumn } from 'lucide-react';
import { useEffect } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { actionTone, describeAction } from '../../utils/auditLabels.js';
import { formatDateTime, formatMoney, formatNumber, formatPercent } from '../../utils/format.js';
import { EmptyState } from '../ui/Feedback.jsx';
import { StatusBadge } from '../ui/StatusBadge.jsx';

export function StatTile({ label, value, meta, icon: Icon, tone, mono = false }) {
  return (
    <div className={`stat-tile${tone ? ` stat-tile--${tone}` : ''}`}>
      {Icon && <Icon size={22} className="stat-tile__icon" aria-hidden="true" />}
      <div className="stat-tile__label">{label}</div>
      <div className={`stat-tile__value${mono ? ' mono' : ''}`}>{value}</div>
      {meta && <div className="stat-tile__meta">{meta}</div>}
    </div>
  );
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

/** Paired income/expense columns per month. */
export function DualBarChart({ series }) {
  const max = Math.max(1, ...series.flatMap((row) => [row.income, row.expenses]));
  return (
    <div className="stack">
      <div className="dual-bars" role="img" aria-label="Monthly income compared with expenses">
        {series.map((row) => {
          const label = new Date(`${row.month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'short' });
          return (
            <div key={row.month} className="dual-bars__group" title={`${row.month}: income TZS ${formatMoney(row.income)}, expenses TZS ${formatMoney(row.expenses)}`}>
              <div className="dual-bars__pair">
                <span className="dual-bars__bar dual-bars__bar--income" style={{ height: `${Math.max(row.income ? 3 : 0, (row.income / max) * 100)}%` }} />
                <span className="dual-bars__bar dual-bars__bar--expense" style={{ height: `${Math.max(row.expenses ? 3 : 0, (row.expenses / max) * 100)}%` }} />
              </div>
              <span className="dual-bars__label mono">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="legend">
        <span><span className="legend__swatch" style={{ background: 'var(--color-success)' }} />Income</span>
        <span><span className="legend__swatch" style={{ background: 'var(--color-danger)' }} />Expenses</span>
      </div>
    </div>
  );
}

export function PerformanceCard({ performance, title = 'Latest examination performance' }) {
  if (!performance) {
    return (
      <section className="card">
        <div className="card__header"><h2 className="card__title">{title}</h2></div>
        <div className="card__body">
          <EmptyState icon={ChartColumn} title="No examination results yet" message="Pass rates appear once marks have been entered." />
        </div>
      </section>
    );
  }
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">{title}</h2>
        <span className="text-sm text-muted">
          {performance.exam.name} · {performance.exam.termName} <span className="mono">{performance.exam.yearLabel}</span>{' '}
          <StatusBadge status={performance.exam.status} />
        </span>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr><th>Class</th><th className="numeric">Candidates</th><th className="numeric">Mean %</th><th style={{ width: '35%' }}>Pass rate</th></tr>
          </thead>
          <tbody>
            {performance.byClass.map((row) => (
              <tr key={row.classId}>
                <td className="data-table__primary">{row.className}</td>
                <td className="numeric">{row.candidates}</td>
                <td className="numeric">{formatNumber(row.meanAverage)}</td>
                <td>
                  <div className="class-matrix__bar">
                    <Progress value={row.passRate} label={`${row.className} pass rate`} />
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

/** Recent audit activity, refreshed every 30 seconds. */
export function ActivityStream({ limit = 12 }) {
  const { data, error, reload } = useApi('/audit-logs', { pageSize: limit });
  useEffect(() => {
    const timer = setInterval(reload, 30000);
    return () => clearInterval(timer);
  }, [reload]);

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title"><Activity size={16} aria-hidden="true" className="inline-icon" /> Live activity</h2>
        <span className="live-indicator">Live</span>
      </div>
      {error && <div className="card__body text-sm text-danger">{error.message}</div>}
      {data && data.items.length === 0 && <div className="card__body text-sm text-muted">No activity recorded yet.</div>}
      {data && data.items.length > 0 && (
        <ul className="activity-stream">
          {data.items.map((entry) => (
            <li key={entry.id}>
              <span className={`activity-stream__dot activity-stream__dot--${actionTone(entry.action)}`} aria-hidden="true" />
              <span>
                <strong>{entry.userName || 'System'}</strong> {describeAction(entry.action)}
                {entry.ipAddress && <span className="data-table__secondary mono">{entry.ipAddress}</span>}
              </span>
              <span className="activity-stream__time mono">{formatDateTime(entry.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
