import { dateLocale } from '../i18n/index.js';
import { formatNumber } from './format.js';

/** Chart palette drawn from the portal theme (academic blue, amber, sky, slate, green, red). */
export const CHART_COLORS = ['#1e3a8a', '#f59e0b', '#3b82f6', '#94a3b8', '#059669', '#dc2626', '#64748b'];
export const SERIES = {
  primary: '#1e3a8a',
  accent: '#f59e0b',
  sky: '#3b82f6',
  success: '#059669',
  danger: '#dc2626',
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
