import { Save } from 'lucide-react';
import { InlineAlert } from './Feedback.jsx';
import Modal from './Modal.jsx';

/** Modal with a form body and Cancel / Submit footer, wired to a useForm() instance. */
export default function FormModal({
  title, form, onSubmit, onClose, submitLabel = 'Save', size = 'md', children,
}) {
  const formId = `form-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const hasFieldErrors = Object.values(form.errors).some(Boolean);
  return (
    <Modal
      title={title}
      size={size}
      onClose={onClose}
      closeDisabled={form.submitting}
      footer={(
        <>
          <button type="button" className="btn btn--outline" onClick={onClose} disabled={form.submitting}>Cancel</button>
          <button type="submit" form={formId} className="btn btn--primary" disabled={form.submitting}>
            <Save size={16} aria-hidden="true" /> {form.submitting ? 'Saving…' : submitLabel}
          </button>
        </>
      )}
    >
      <form id={formId} className="stack" onSubmit={form.submit(onSubmit)} noValidate>
        {form.formError && !hasFieldErrors && <InlineAlert tone="danger">{form.formError}</InlineAlert>}
        {children}
      </form>
    </Modal>
  );
}
