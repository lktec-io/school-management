export const ROLE_LABELS = {
  admin: 'Headmaster',
  accountant: 'Bursar',
  teacher: 'Teacher',
  parent: 'Parent',
};

export const LEVEL_LABELS = {
  nursery: 'Nursery',
  primary: 'Primary',
  o_level: 'O-Level',
  a_level: 'A-Level',
};

export const EXAM_TYPE_LABELS = {
  quiz: 'Quiz',
  monthly_test: 'Monthly Test',
  midterm: 'Midterm',
  terminal: 'Terminal',
  annual: 'Annual',
  mock: 'Mock',
};

export const STATUS_TONES = {
  // students
  active: 'success',
  suspended: 'warning',
  transferred: 'info',
  graduated: 'info',
  withdrawn: 'neutral',
  // users
  inactive: 'neutral',
  // exams
  draft: 'neutral',
  open: 'success',
  closed: 'warning',
  published: 'info',
  // payments, expenses, discounts
  confirmed: 'success',
  reversed: 'danger',
  recorded: 'success',
  voided: 'danger',
  revoked: 'neutral',
  // sms
  queued: 'warning',
  sent: 'success',
  delivered: 'success',
  failed: 'danger',
};

export const PAYMENT_MODE_LABELS = {
  cash: 'Cash',
  bank_deposit: 'Bank Deposit',
  bank_transfer: 'Bank Transfer',
  mobile_money: 'Mobile Money',
  cheque: 'Cheque',
};

export const PAYMENT_MODE_TONES = {
  cash: 'neutral',
  bank_deposit: 'info',
  bank_transfer: 'info',
  mobile_money: 'success',
  cheque: 'warning',
};

export const EXPENSE_CATEGORY_LABELS = {
  salaries: 'Salaries',
  utilities: 'Utilities',
  maintenance: 'Maintenance',
  supplies: 'Supplies',
  transport: 'Transport',
  examinations: 'Examinations',
  other: 'Other',
};

export function titleCase(value) {
  if (!value) return '';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export function formatDate(value) {
  if (!value) return '—';
  const date = typeof value === 'string' && value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

const moneyFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Digits only — pair with the `.amount` class, which renders the "TZS" prefix. */
export function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return moneyFormatter.format(Number(value));
}

export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: decimals });
}

export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(decimals)}%`;
}

/** 255777123456 → +255 777 123 456 */
export function formatPhone(value) {
  if (!value) return '—';
  const digits = String(value);
  if (/^255\d{9}$/.test(digits)) return `+255 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  return digits;
}

export function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function classLabel(className, streamName) {
  return streamName ? `${className} ${streamName}` : className;
}
