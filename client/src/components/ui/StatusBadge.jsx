import i18n from '../../i18n/index.js';
import { STATUS_TONES, titleCase } from '../../utils/format.js';

export function StatusBadge({ status, label, tone }) {
  const resolvedTone = tone || STATUS_TONES[status] || 'neutral';
  const className = resolvedTone === 'neutral' ? 'badge' : `badge badge--${resolvedTone}`;
  return <span className={className}>{label || i18n.t(`status.${status}`, { defaultValue: titleCase(status) })}</span>;
}

export function GradeChip({ grade }) {
  if (!grade) return <span className="text-muted mono">—</span>;
  return <span className={`grade-chip grade-chip--${grade}`}>{grade}</span>;
}
