import { dateLocale } from '../i18n/index.js';
import { formatNumber } from './format.js';

/** Chart palette drawn from the portal theme (academic blue, emerald, sky, slate, crimson). */
export const CHART_COLORS = ['#1e3a8a', '#10b981', '#3b82f6', '#94a3b8', '#dc2626', '#f59e0b', '#64748b'];
export const SERIES = {
  primary: '#1e3a8a',
  accent: '#10b981',
  sky: '#3b82f6',
  success: '#059669',
  danger: '#ef4444',
  muted: '#cbd5e1',
};

/** Compact axis labels: 1,250,000 → 1.3M. */
export function compactNumber(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 1e6) return `${formatNumber(number / 1e6, 1)}M`;
  if (Math.abs(number) >= 1e3) return `${formatNumber(number / 1e3, 0)}K`;
  return formatNumber(number, 0);
}

export function monthLabel(month) {
  return new Date(`${month}-01T12:00:00`).toLocaleDateString(dateLocale(), { month: 'short' });
}

/** Last day of a YYYY-MM month as YYYY-MM-DD (for month drill-down links). */
export function monthEnd(month) {
  const [year, mon] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(year, mon, 0)).getUTCDate()).padStart(2, '0')}`;
}
