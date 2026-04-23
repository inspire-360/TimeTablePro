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
    return 'กรุณากรอกอีเมลให้ถูกต้อง';
  }

  if (!form.password) {
    return 'กรุณากรอกรหัสผ่าน';
  }

  return '';
}

function validateRegisterForm(form) {
  if (!form.displayName.trim()) {
    return 'กรุณากรอกชื่อ-นามสกุล';
  }

  if (!isValidEmail(form.email.trim())) {
    return 'กรุณากรอกอีเมลให้ถูกต้อง';
  }

  if (form.password.length < 8) {
    return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  }

  if (form.password !== form.confirmPassword) {
    return 'ยืนยันรหัสผ่านไม่ตรงกัน';
  }

  return '';
}

function validateGoogleProfileSeed(form) {
  if (!form.displayName.trim()) {
    return 'กรุณากรอกชื่อ-นามสกุลก่อนสร้างบัญชีด้วย Google';
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
        message: authError instanceof Error ? authError.message : 'ไม่สามารถเข้าสู่ระบบได้',
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
        role: registerForm.role,
        email: registerForm.email.trim().toLowerCase(),
        password: registerForm.password,
      });
      navigate(redirectPath, { replace: true });
    } catch (authError) {
      setFeedback({
        tone: 'error',
        message: authError instanceof Error ? authError.message : 'ไม่สามารถสร้างบัญชีได้',
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
          authError instanceof Error ? authError.message : 'ไม่สามารถดำเนินการด้วย Google ได้',
      });
    }
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <div className="auth-card__tabs" role="tablist" aria-label="โหมดเข้าสู่ระบบ">
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
            เข้าสู่ระบบ
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
            สร้างบัญชี
          </button>
        </div>

        <div className="auth-card__body">
          <div className="auth-card__heading">
            <p className="auth-card__eyebrow">
              {mode === 'login' ? 'บัญชีที่มีอยู่' : 'บัญชีใหม่'}
            </p>
            <h2>{mode === 'login' ? 'เข้าสู่ระบบเพื่อใช้งาน' : 'สร้างบัญชีผู้ใช้งาน'}</h2>
            <p>
              {mode === 'login'
                ? 'เข้าสู่ระบบด้วยอีเมลหรือ Google ระบบจะเชื่อมโปรไฟล์โรงเรียนให้อัตโนมัติ'
                : 'บัญชีใหม่จะถูกผูกกับโรงเรียนหลักของระบบโดยอัตโนมัติ ไม่ต้องกรอก School ID'}
            </p>
          </div>

          {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}

          {mode === 'login' ? (
            <form className="auth-form" onSubmit={handleEmailLogin}>
              <InputField
                label="อีเมล"
                type="email"
                autoComplete="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="name@school.ac.th"
              />
              <InputField
                label="รหัสผ่าน"
                type="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="กรอกรหัสผ่าน"
              />

              <button type="submit" className="primary-button" disabled={isLoading}>
                {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วยอีเมล'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleEmailRegister}>
              <InputField
                label="ชื่อ-นามสกุล"
                value={registerForm.displayName}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                placeholder="ชื่อครู นักเรียน หรือผู้ดูแลระบบ"
              />
              <SelectField
                label="บทบาท"
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
                label="อีเมล"
                type="email"
                autoComplete="email"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="name@school.ac.th"
              />
              <InputField
                label="รหัสผ่าน"
                type="password"
                autoComplete="new-password"
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="อย่างน้อย 8 ตัวอักษร"
              />
              <InputField
                label="ยืนยันรหัสผ่าน"
                type="password"
                autoComplete="new-password"
                value={registerForm.confirmPassword}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                placeholder="กรอกรหัสผ่านอีกครั้ง"
              />

              <button type="submit" className="primary-button" disabled={isLoading}>
                {isLoading ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชีด้วยอีเมล'}
              </button>
            </form>
          )}

          <button type="button" className="secondary-button" onClick={handleGoogleClick}>
            {mode === 'login' ? 'เข้าสู่ระบบด้วย Google' : 'สร้างบัญชีด้วย Google'}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
