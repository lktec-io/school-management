import { ShieldAlert } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { EmptyState } from '../ui/Feedback.jsx';

export function FullPageLoader() {
  return (
    <div className="full-page-loader" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>Loading portal…</span>
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
  const { hasRole } = useAuth();
  if (!hasRole(roles)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Access restricted"
        message="Your account role does not have permission to open this page."
        action={<Link to="/dashboard" className="btn btn--primary">Return to dashboard</Link>}
      />
    );
  }
  return children;
}
