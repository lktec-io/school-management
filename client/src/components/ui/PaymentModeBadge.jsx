import { PAYMENT_MODE_LABELS, PAYMENT_MODE_TONES } from '../../utils/format.js';
import { StatusBadge } from './StatusBadge.jsx';

export default function PaymentModeBadge({ mode }) {
  return <StatusBadge status={mode} tone={PAYMENT_MODE_TONES[mode]} label={PAYMENT_MODE_LABELS[mode] ?? mode} />;
}
