import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { InputField } from '../../../shared/ui/InputField';
import { SelectField } from '../../../shared/ui/SelectField';
import { AuthShell } from '../components/AuthShell';
import { AUTH_ROLES, DEFAULT_AUTH_ROLE, getAuthRoleLabel } from '../constants/authRoles';
import { useAuth } from '../context/useAuth';

const initialLoginForm = {
  email: '',
  password: '',
};

const initialRegisterForm = {
  displayName: '',
  schoolId: '',
  role: DEFAULT_AUTH_ROLE,
  email: '',
  password: '',
  confirmPassword: '',
};

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildRedirectPath(locationState) {
  const fromPath = locationState?.from?.pathname;
  return fromPath && fromPath !== '/login' ? fromPath : '/app';
}

function validateLoginForm(form) {
  if (!isValidEmail(form.email.trim())) {
    return 'Enter a valid email address.';
  }

  if (!form.password) {
    return 'Enter your password.';
  }

  return '';
}

function validateRegisterForm(form) {
  if (!form.displayName.trim()) {
    return 'Enter the full name for this account.';
  }

  if (!form.schoolId.trim()) {
    return 'Enter the school ID that this account belongs to.';
  }

  if (!isValidEmail(form.email.trim())) {
    return 'Enter a valid email address.';
  }

  if (form.password.length < 8) {
    return 'Password must be at least 8 characters.';
  }

  if (form.password !== form.confirmPassword) {
    return 'Password confirmation does not match.';
  }

  return '';
}

function validateGoogleProfileSeed(form) {
  if (!form.displayName.trim()) {
    return 'Enter the full name for this account.';
  }

  if (!form.schoolId.trim()) {
    return 'Enter the school ID that this account belongs to.';
  }

  return '';
}

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { error, isAuthenticated, isLoading, loginWithEmail, loginWithGoogle, registerWithEmail } =
    useAuth();

  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [feedback, setFeedback] = useState({ tone: '', message: '' });

  const redirectPath = buildRedirectPath(location.state);

  if (isAuthenticated) {
    return <Navigate replace to={redirectPath} />;
  }

  async function handleEmailLogin(event) {
    event.preventDefault();

    const validationMessage = validateLoginForm(loginForm);

    if (validationMessage) {
      setFeedback({ tone: 'error', message: validationMessage });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      await loginWithEmail({
        email: loginForm.email.trim().toLowerCase(),
        password: loginForm.password,
      });
      navigate(redirectPath, { replace: true });
    } catch (authError) {
      setFeedback({
        tone: 'error',
        message: authError instanceof Error ? authError.message : 'Unable to sign in.',
      });
    }
  }

  async function handleEmailRegister(event) {
    event.preventDefault();

    const validationMessage = validateRegisterForm(registerForm);

    if (validationMessage) {
      setFeedback({ tone: 'error', message: validationMessage });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      await registerWithEmail({
        displayName: registerForm.displayName.trim(),
        schoolId: registerForm.schoolId.trim(),
        role: registerForm.role,
        email: registerForm.email.trim().toLowerCase(),
        password: registerForm.password,
      });
      navigate(redirectPath, { replace: true });
    } catch (authError) {
      setFeedback({
        tone: 'error',
        message: authError instanceof Error ? authError.message : 'Unable to create the account.',
      });
    }
  }

  async function handleGoogleClick() {
    try {
      setFeedback({ tone: '', message: '' });

      const profileInput =
        mode === 'register'
          ? {
              displayName: registerForm.displayName.trim(),
              schoolId: registerForm.schoolId.trim(),
              role: registerForm.role,
            }
          : {};

      if (mode === 'register') {
        const validationMessage = validateGoogleProfileSeed(registerForm);

        if (validationMessage) {
          setFeedback({ tone: 'error', message: validationMessage });
          return;
        }
      }

      await loginWithGoogle(profileInput);
      navigate(redirectPath, { replace: true });
    } catch (authError) {
      setFeedback({
        tone: 'error',
        message:
          authError instanceof Error ? authError.message : 'Unable to continue with Google.',
      });
    }
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <div className="auth-card__tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-card__tab${mode === 'login' ? ' auth-card__tab--active' : ''}`}
            onClick={() => {
              setMode('login');
              setFeedback({ tone: '', message: '' });
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-card__tab${mode === 'register' ? ' auth-card__tab--active' : ''}`}
            onClick={() => {
              setMode('register');
              setFeedback({ tone: '', message: '' });
            }}
          >
            Create account
          </button>
        </div>

        <div className="auth-card__body">
          <div className="auth-card__heading">
            <p className="auth-card__eyebrow">
              {mode === 'login' ? 'Existing account' : 'New auth account'}
            </p>
            <h2>{mode === 'login' ? 'Sign in to continue' : 'Create an auth profile'}</h2>
            <p>
              {mode === 'login'
                ? 'Email/password and Google sign-in both restore the Firestore profile before redirecting to protected routes.'
                : 'New accounts write a synced Firestore user profile with schoolId and role.'}
            </p>
          </div>

          {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}

          {mode === 'login' ? (
            <form className="auth-form" onSubmit={handleEmailLogin}>
              <InputField
                label="Email"
                type="email"
                autoComplete="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="name@school.ac.th"
              />
              <InputField
                label="Password"
                type="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="At least 8 characters"
              />

              <button type="submit" className="primary-button" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in with email'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleEmailRegister}>
              <InputField
                label="Full name"
                value={registerForm.displayName}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                placeholder="Teacher or student name"
              />
              <InputField
                label="School ID"
                value={registerForm.schoolId}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    schoolId: event.target.value,
                  }))
                }
                placeholder="example-school"
              />
              <SelectField
                label="Role"
                value={registerForm.role}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
              >
                {AUTH_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {getAuthRoleLabel(role)}
                  </option>
                ))}
              </SelectField>
              <InputField
                label="Email"
                type="email"
                autoComplete="email"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="name@school.ac.th"
              />
              <InputField
                label="Password"
                type="password"
                autoComplete="new-password"
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="At least 8 characters"
              />
              <InputField
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                value={registerForm.confirmPassword}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                placeholder="Repeat the password"
              />

              <button type="submit" className="primary-button" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create account with email'}
              </button>
            </form>
          )}

          <button type="button" className="secondary-button" onClick={handleGoogleClick}>
            {mode === 'login' ? 'Continue with Google' : 'Create account with Google'}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
