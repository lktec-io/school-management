import { CircleAlert, Inbox, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Placeholder while a section loads. Progress itself is shown by the top bar, so this renders
 * shimmering skeleton lines instead of a spinner.
 */
export function LoadingBlock({ label, rows = 4 }) {
  const { t } = useTranslation();
  return (
    <div className="skeleton-block" role="status" aria-live="polite">
      <span className="sr-only">{label || t('common.loading')}</span>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="skeleton skeleton--line" style={{ width: `${92 - ((index * 17) % 40)}%` }} aria-hidden="true" />
      ))}
    </div>
  );
}

/** Page-shaped skeleton (KPI row + panels) used while a whole screen loads. */
export function PageSkeleton({ variant = 'page' }) {
  const { t } = useTranslation();
  return (
    <div className="page-skeleton" role="status" aria-live="polite">
      <span className="sr-only">{t('common.loading')}</span>
      {variant === 'dashboard' && (
        <div className="kpi-grid" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => <span key={index} className="skeleton skeleton--tile" />)}
        </div>
      )}
      <div className="page-skeleton__panels" aria-hidden="true">
        <span className="skeleton skeleton--panel" />
        {variant === 'dashboard' && <span className="skeleton skeleton--panel" />}
      </div>
    </div>
  );
}

export function ErrorBlock({ error, onRetry }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <div className="alert alert--danger" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <div>
        <p className="alert__title">{t('feedback.errorTitle')}</p>
        <p>{error.message}</p>
        {onRetry && (
          <button type="button" className="btn btn--outline btn--sm" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" /> {t('common.retry')}
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true"><Icon size={28} /></span>
      <p className="empty-state__title">{title}</p>
      {message && <p className="empty-state__message">{message}</p>}
      {action}
    </div>
  );
}

export function InlineAlert({ tone = 'info', title, children, icon: Icon = CircleAlert }) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'danger' ? 'alert' : 'note'}>
      <Icon size={18} aria-hidden="true" />
      <div>
        {title && <p className="alert__title">{title}</p>}
        {children}
      </div>
    </div>
  );
}
