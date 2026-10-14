import { Send } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { InlineAlert } from '../ui/Feedback.jsx';
import Modal from '../ui/Modal.jsx';
import MessageComposer from './MessageComposer.jsx';

/** Compose and send an SMS to a pre-selected audience (e.g. selected fee defaulters). */
export default function SmsComposeModal({ title, description, target, defaultMessage = '', category, onClose, onSent }) {
  const toast = useToast();
  const [message, setMessage] = useState(defaultMessage);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await api.post('/sms/send-bulk', { target, message, category });
      toast.success(`${result.queued} SMS queued for delivery${result.failed ? ` (${result.failed} invalid numbers skipped)` : ''}.`);
      onSent?.(result);
    } catch (failure) {
      setError(failure.message);
      setSending(false);
    }
  };

  return (
    <Modal
      title={title}
      size="lg"
      onClose={onClose}
      closeDisabled={sending}
      footer={(
        <>
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={sending}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={send} disabled={sending || !preview || preview.recipients === 0}>
            {sending ? <span className="spinner spinner--light" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
            {sending ? 'Sending…' : `Send to ${preview?.recipients ?? 0} recipient${preview?.recipients === 1 ? '' : 's'}`}
          </button>
        </>
      )}
    >
      <div className="stack">
        {description && <p className="text-sm text-muted">{description}</p>}
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <MessageComposer target={target} targetReady value={message} onChange={setMessage} onPreview={setPreview} />
      </div>
    </Modal>
  );
}
