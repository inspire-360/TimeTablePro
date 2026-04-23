import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { useAuth } from '../context/useAuth';

function AccessDeniedState({ role }) {
  return (
    <div className="loader-shell">
      <div className="loader-panel loader-panel--error">
        <p className="loader-panel__eyebrow">Access denied</p>
        <h2>Your account cannot access this route.</h2>
        <p>Current role: {role || 'unknown'}</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ allowedRoles = [], children }) {
  const location = useLocation();
  const { isAuthenticated, isLoading, profile } = useAuth();

  if (isLoading) {
    return <AppLoader label="Loading your account" />;
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
    return <AccessDeniedState role={profile.role} />;
  }

  return children || <Outlet />;
}
