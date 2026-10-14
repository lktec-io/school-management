import { useState } from 'react';
import FormField from './FormField.jsx';
import { InlineAlert } from './Feedback.jsx';
import Modal from './Modal.jsx';

/**
 * Confirmation dialog that requires a written reason (reversals, voids, revocations).
 * `onConfirm(reason)` should return a promise; errors are shown inline.
 */
export default function ReasonModal({ title, children, confirmLabel = 'Confirm', label = 'Reason', onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const valid = reason.trim().length >= 5;

  const submit = async (event) => {
    event.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (failure) {
      setError(failure.message);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      closeDisabled={submitting}
      footer={(
        <>
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" form="reason-form" className="btn btn--danger" disabled={!valid || submitting}>
            {submitting && <span className="spinner spinner--light" aria-hidden="true" />}
            {submitting ? 'Processing…' : confirmLabel}
          </button>
        </>
      )}
    >
      <form id="reason-form" className="stack" onSubmit={submit}>
        {children}
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <FormField label={label} required hint="At least 5 characters. Recorded permanently in the audit log.">
          <textarea className="form-control" rows={3} maxLength={255} value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}
