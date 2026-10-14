import { ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import LoginForm from '../auth/LoginForm.jsx';
import Crest from '../layout/Crest.jsx';

/** Sharp-edged sign-in overlay for the public site. Escape or the backdrop closes it. */
export default function LoginDialog({ copy, school, onClose, onSuccess }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key === 'Tab' && dialogRef.current) {
        // Keep keyboard focus inside the dialog.
        const focusable = dialogRef.current.querySelectorAll('button, input, a[href]');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="gov-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} className="gov-dialog" role="dialog" aria-modal="true" aria-labelledby="gov-dialog-title">
        <div className="gov-dialog__header">
          <Crest name={school?.name || ''} size={40} inverted logoSrc={school?.logoSrc} />
          <div className="gov-dialog__heading">
            <span className="gov-dialog__school">{school?.name}</span>
            <h2 id="gov-dialog-title" className="gov-dialog__title">{copy.title}</h2>
          </div>
          <button type="button" className="gov-dialog__close" onClick={onClose} aria-label={copy.close}>
            <X size={18} />
          </button>
        </div>
        <div className="gov-dialog__body">
          <p className="gov-dialog__subtitle">{copy.subtitle}</p>
          <LoginForm copy={copy} onSuccess={onSuccess} />
        </div>
        <div className="gov-dialog__footer">
          <ShieldCheck size={14} aria-hidden="true" /> {copy.legal}
        </div>
      </div>
    </div>,
    document.body,
  );
}
