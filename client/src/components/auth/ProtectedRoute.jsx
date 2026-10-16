import { ShieldAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { progress } from '../../utils/progress.js';
import { EmptyState } from '../ui/Feedback.jsx';

/** Blank shell while the session is restored; the top progress bar shows activity. */
export function FullPageLoader() {
  const { t } = useTranslation();
  useEffect(() => {
    progress.start();
    return () => progress.done();
  }, []);
  return (
    <div className="full-page-loader" role="status">
      <span className="sr-only">{t('common.loadingPortal')}</span>
    </div>
  );
}

/** Requires a session; forces the password-change screen while a temporary password is active. */
export function RequireAuth({ children }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageLoader />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.mustChangePassword && location.pathname !== '/account/password') {
    return <Navigate to="/account/password" replace />;
  }
  return children;
}

export function RequireRole({ roles, children }) {
  const { t } = useTranslation();
  const { hasRole } = useAuth();
  if (!hasRole(roles)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t('feedback.accessRestricted')}
        message={t('feedback.accessMessage')}
        action={<Link to="/dashboard" className="btn btn--primary">{t('feedback.returnDashboard')}</Link>}
      />
    );
  }
  return children;
}
