import { dateLocale } from '../i18n/index.js';
import { formatNumber } from './format.js';

/** Chart palette drawn from the portal theme (navy, slate, gold, sky, green, red). */
export const CHART_COLORS = ['#0b2545', '#d4af37', '#3e6c9a', '#8da9c4', '#1f7a4d', '#b42318', '#6b7a90'];
export const SERIES = {
  primary: '#0b2545',
  accent: '#d4af37',
  sky: '#3e6c9a',
  success: '#1f7a4d',
  danger: '#b42318',
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
