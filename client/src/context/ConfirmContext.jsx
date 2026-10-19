import { TriangleAlert } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/ui/Modal.jsx';

const ConfirmContext = createContext(null);
const DESTRUCTIVE = /^(delete|remove|reset|futa|ondoa)\b/i;

/**
 * In-app replacement for window.confirm(): `await confirm('Delete X?')` resolves true/false.
 * Options: { title, confirmLabel, tone: 'danger' | 'primary' }. Destructive wording defaults to danger.
 */
export function ConfirmProvider({ children }) {
  const { t } = useTranslation();
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((message, options = {}) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setRequest({ message, ...options });
  }), []);

  const settle = (answer) => {
    resolver.current?.(answer);
    resolver.current = null;
    setRequest(null);
  };

  const tone = request?.tone ?? (DESTRUCTIVE.test(String(request?.message ?? '')) ? 'danger' : 'primary');

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <Modal
          title={request.title ?? t('confirm.title')}
          size="sm"
          onClose={() => settle(false)}
          footer={(
            <>
              <button type="button" className="btn btn--outline" onClick={() => settle(false)}>{t('common.cancel')}</button>
              <button type="button" className={`btn btn--${tone}`} onClick={() => settle(true)}>
                {request.confirmLabel ?? t('confirm.ok')}
              </button>
            </>
          )}
        >
          <div className={`confirm-body confirm-body--${tone}`}>
            <span className="confirm-body__icon" aria-hidden="true"><TriangleAlert size={20} /></span>
            <p>{request.message}</p>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider');
  return confirm;
}
