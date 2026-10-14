/** Human-readable wording for audit log actions (dashboard activity stream & Audit Trail). */
const ACTION_LABELS = {
  'auth.login': 'signed in',
  'auth.logout': 'signed out',
  'auth.login_failed': 'failed sign-in attempt',
  'auth.login_blocked': 'blocked sign-in attempt',
  'auth.account_locked': 'account locked after failed sign-ins',
  'auth.password_changed': 'changed password',
  'auth.password_change_failed': 'failed password change',
  'payment.create': 'recorded a fee payment',
  'payment.reverse': 'reversed a fee payment',
  'expense.create': 'recorded an expense',
  'expense.void': 'voided an expense',
  'marks.bulk_save': 'saved examination marks',
  'report_remarks.save': 'updated report card remarks',
  'student.register': 'registered a student',
  'student.update': 'updated a student record',
  'student.status_change': 'changed a student status',
  'user.create': 'created a user account',
  'user.create_admin_cli': 'created an administrator (server console)',
  'user.update': 'updated a user account',
  'user.reset_password': 'reset a user password',
  'sms.broadcast': 'sent an SMS broadcast',
  'sms.retry': 'retried failed SMS',
  'fee_discount.grant': 'granted a fee discount',
  'fee_discount.revoke': 'revoked a fee discount',
  'fee_structure.create': 'added a fee to classes',
  'fee_structure.update': 'changed a fee amount',
  'fee_allocation.update': 'changed optional fee allocations',
  'system.settings_update': 'updated school settings',
  'system.backup_download': 'downloaded a database backup',
  'system.backup_file_download': 'downloaded a stored backup',
  'system.branding_upload': 'uploaded a branding image',
  'system.branding_delete': 'removed a branding image',
};

export function describeAction(action) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith('exam.status_')) return `changed an exam to ${action.slice(12)}`;
  return action.replace(/[._]/g, ' ');
}

/** Colour family for an action: danger, finance, academic, system or neutral. */
export function actionTone(action) {
  if (/reverse|void|revoke|failed|locked|blocked|delete/.test(action)) return 'danger';
  if (/^(payment|expense|fee_)/.test(action)) return 'finance';
  if (/^(marks|exam|report|student|class|subject|term|academic|teacher|stream)/.test(action)) return 'academic';
  if (/^(system|user)/.test(action)) return 'system';
  return 'neutral';
}

export const ACTION_GROUP_LABELS = {
  auth: 'Sign-in & passwords',
  payment: 'Fee payments',
  expense: 'Expenses',
  fee_discount: 'Fee discounts',
  fee_structure: 'Fee structures',
  fee_type: 'Fee types',
  fee_allocation: 'Optional fee allocations',
  marks: 'Marks',
  exam: 'Examinations',
  report_remarks: 'Report remarks',
  student: 'Students',
  user: 'User accounts',
  sms: 'SMS',
  system: 'System & backups',
  class: 'Classes',
  stream: 'Streams',
  subject: 'Subjects',
  term: 'Terms',
  academic_year: 'Academic years',
  teacher_assignment: 'Teacher assignments',
};
