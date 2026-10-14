export const SCHOOL_TIMEZONE = 'Africa/Dar_es_Salaam';

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHOOL_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const displayDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCHOOL_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** Today's date in Zanzibar as YYYY-MM-DD. */
export function todayInSchoolTz() {
  return isoDateFormatter.format(new Date());
}

/** Format a YYYY-MM-DD string or Date as e.g. "13 Oct 2026". */
export function formatDisplayDate(value) {
  if (!value) return '';
  const date = typeof value === 'string' && value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : displayDateFormatter.format(date);
}
