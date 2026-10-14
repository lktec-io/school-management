import { CircleAlert, Inbox, RefreshCw } from 'lucide-react';

export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="loading-block" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBlock({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert--danger" role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      <div>
        <p className="alert__title">Something went wrong</p>
        <p>{error.message}</p>
        {onRetry && (
          <button type="button" className="btn btn--outline btn--sm" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" /> Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="empty-state">
      <Icon size={36} aria-hidden="true" />
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
