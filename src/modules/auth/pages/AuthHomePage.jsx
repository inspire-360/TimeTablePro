import { getAuthRoleLabel } from '../constants/authRoles';
import { useAuth } from '../context/useAuth';

export function AuthHomePage() {
  const { logout, profile } = useAuth();

  return (
    <div className="loader-shell">
      <div className="loader-panel loader-panel--error">
        <p className="loader-panel__eyebrow">Protected route</p>
        <h2>{profile.displayName}</h2>
        <p>{profile.email}</p>
        <p>Role: {getAuthRoleLabel(profile.role)}</p>
        <p>School ID: {profile.schoolId}</p>
        <button type="button" className="primary-button" onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
