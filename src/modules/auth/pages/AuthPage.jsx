import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthLayout } from '../../../app/layouts/AuthLayout';
import { useAuthSession } from '../context/useAuthSession';
import { thaiProvinces } from '../../../shared/constants/thaiProvinces';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { InputField } from '../../../shared/ui/InputField';
import { SelectField } from '../../../shared/ui/SelectField';
import { getDefaultAcademicYearLabel } from '../../../shared/utils/date';

const initialSignInForm = {
  email: '',
  password: '',
};

const initialRegisterForm = {
  schoolName: '',
  shortName: '',
  province: '',
  academicYearLabel: getDefaultAcademicYearLabel(),
  adminName: '',
  positionTitle: 'ผู้อำนวยการโรงเรียน',
  email: '',
  password: '',
  confirmPassword: '',
};

function normalizeShortName(value, fallback) {
  const trimmed = value.trim();

  if (trimmed) {
    return trimmed;
  }

  return fallback.trim().slice(0, 24);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateSignInForm(form) {
  if (!form.email.trim() || !form.password.trim()) {
    return 'กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน';
  }

  if (!isValidEmail(form.email.trim())) {
    return 'กรุณากรอกอีเมลให้ถูกต้อง';
  }

  return '';
}

function validateRegisterForm(form) {
  if (!form.schoolName.trim()) {
    return 'กรุณากรอกชื่อโรงเรียน';
  }

  if (!form.province) {
    return 'กรุณาเลือกจังหวัดของโรงเรียน';
  }

  if (!form.adminName.trim()) {
    return 'กรุณากรอกชื่อผู้ดูแลระบบคนแรก';
  }

  if (!isValidEmail(form.email.trim())) {
    return 'กรุณากรอกอีเมลให้ถูกต้อง';
  }

  if (form.password.length < 8) {
    return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  }

  if (form.password !== form.confirmPassword) {
    return 'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน';
  }

  return '';
}

export function AuthPage() {
  const { error: sessionError, isAuthenticated, registerSchool, signIn, status } = useAuthSession();
  const [mode, setMode] = useState('signin');
  const [signInForm, setSignInForm] = useState(initialSignInForm);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate replace to="/app" />;
  }

  async function handleSignInSubmit(event) {
    event.preventDefault();

    const validationMessage = validateSignInForm(signInForm);

    if (validationMessage) {
      setFeedback({ tone: 'error', message: validationMessage });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback({ tone: '', message: '' });
      await signIn({
        email: signInForm.email.trim().toLowerCase(),
        password: signInForm.password,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'ไม่สามารถลงชื่อเข้าใช้ได้',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();

    const validationMessage = validateRegisterForm(registerForm);

    if (validationMessage) {
      setFeedback({ tone: 'error', message: validationMessage });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback({
        tone: 'success',
        message: 'กำลังสร้างพื้นที่ของโรงเรียนและบัญชีผู้ดูแลระบบ',
      });

      await registerSchool({
        schoolName: registerForm.schoolName.trim(),
        shortName: normalizeShortName(registerForm.shortName, registerForm.schoolName),
        province: registerForm.province,
        academicYearLabel: registerForm.academicYearLabel.trim(),
        adminName: registerForm.adminName.trim(),
        positionTitle: registerForm.positionTitle.trim(),
        email: registerForm.email.trim().toLowerCase(),
        password: registerForm.password,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'ไม่สามารถสร้างบัญชีของโรงเรียนได้',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-card">
        <div className="auth-card__tabs" role="tablist" aria-label="โหมดการใช้งาน">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`auth-card__tab${mode === 'signin' ? ' auth-card__tab--active' : ''}`}
            onClick={() => {
              setMode('signin');
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
            สร้างโรงเรียน
          </button>
        </div>

        <div className="auth-card__body">
          <div className="auth-card__heading">
            <p className="auth-card__eyebrow">
              {mode === 'signin' ? 'สำหรับโรงเรียนที่มีบัญชีแล้ว' : 'เริ่มต้นระบบสำหรับโรงเรียนใหม่'}
            </p>
            <h2>{mode === 'signin' ? 'เข้าสู่พื้นที่ทำงานของโรงเรียน' : 'สร้างบัญชีผู้ดูแลระบบโรงเรียน'}</h2>
            <p>
              {mode === 'signin'
                ? 'ลงชื่อเข้าใช้ด้วยอีเมลของผู้ดูแลระบบเพื่อเข้าสู่พื้นที่ที่ผูกกับโรงเรียนของคุณ'
                : 'เราจะสร้างเอกสารโรงเรียนและบัญชีผู้ดูแลคนแรกใน Firestore ภายใต้ schoolId ใหม่'}
            </p>
          </div>

          {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}
          {sessionError && status === 'session-error' ? (
            <FormMessage tone="error">{sessionError}</FormMessage>
          ) : null}

          {mode === 'signin' ? (
            <form className="auth-form" onSubmit={handleSignInSubmit}>
              <InputField
                label="อีเมล"
                type="email"
                autoComplete="email"
                value={signInForm.email}
                onChange={(event) =>
                  setSignInForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="admin@school.ac.th"
              />
              <InputField
                label="รหัสผ่าน"
                type="password"
                autoComplete="current-password"
                value={signInForm.password}
                onChange={(event) =>
                  setSignInForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="อย่างน้อย 8 ตัวอักษร"
              />

              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? 'กำลังตรวจสอบข้อมูล' : 'เข้าสู่ระบบ'}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegisterSubmit}>
              <InputField
                label="ชื่อโรงเรียน"
                value={registerForm.schoolName}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, schoolName: event.target.value }))
                }
                placeholder="เช่น โรงเรียนบ้านตัวอย่างวิทยา"
              />
              <InputField
                label="ชื่อย่อโรงเรียน"
                value={registerForm.shortName}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, shortName: event.target.value }))
                }
                placeholder="เช่น บตว."
              />
              <SelectField
                label="จังหวัด"
                value={registerForm.province}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, province: event.target.value }))
                }
              >
                <option value="">เลือกจังหวัด</option>
                {thaiProvinces.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </SelectField>
              <InputField
                label="ปีการศึกษาเริ่มต้น"
                value={registerForm.academicYearLabel}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    academicYearLabel: event.target.value,
                  }))
                }
                placeholder="2569"
              />
              <InputField
                label="ชื่อผู้ดูแลระบบคนแรก"
                value={registerForm.adminName}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, adminName: event.target.value }))
                }
                placeholder="ชื่อ-นามสกุล"
              />
              <InputField
                label="ตำแหน่ง"
                value={registerForm.positionTitle}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    positionTitle: event.target.value,
                  }))
                }
                placeholder="เช่น ผู้อำนวยการโรงเรียน"
              />
              <InputField
                label="อีเมล"
                type="email"
                autoComplete="email"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="admin@school.ac.th"
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

              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? 'กำลังสร้างระบบโรงเรียน' : 'สร้างโรงเรียนและผู้ดูแลระบบ'}
              </button>
            </form>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
