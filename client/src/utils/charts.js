import { dateLocale } from '../i18n/index.js';
import { formatNumber } from './format.js';

/** Chart palette: primary blue, success green, gold, info, danger, greys. */
export const CHART_COLORS = ['#007bff', '#28a745', '#ffc107', '#17a2b8', '#dc3545', '#6c757d', '#343a40'];
export const SERIES = {
  primary: '#007bff',
  accent: '#ffc107',
  sky: '#17a2b8',
  success: '#28a745',
  danger: '#dc3545',
  muted: '#ced4da',
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
