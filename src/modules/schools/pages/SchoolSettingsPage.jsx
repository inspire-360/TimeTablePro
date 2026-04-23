import { useState } from 'react';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { InputField } from '../../../shared/ui/InputField';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { AcademicPageShell } from '../../academic/components/AcademicPageShell';
import { useAuth } from '../../auth/context/useAuth';
import { ThemeColorPanel } from '../../theme/components/ThemeColorPanel';
import { normalizeSchoolTheme } from '../../theme/constants/themePalette';
import { useCurrentSchool } from '../context/useCurrentSchool';

function createEmptySignature(schoolId) {
  return {
    id: `signature-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    schoolId,
    name: '',
    title: '',
    imageUrl: '',
    sortOrder: 0,
  };
}

function buildFormState(currentSchool, currentSchoolId, currentSchoolSettings) {
  return {
    schoolId: currentSchoolId || currentSchool.schoolId || '',
    schoolName: currentSchool.name || '',
    logoUrl: currentSchool.logoUrl || '',
    affiliation: currentSchool.affiliation || '',
    theme: normalizeSchoolTheme(currentSchoolSettings.theme),
    signatures:
      currentSchoolSettings.signatures.length > 0
        ? currentSchoolSettings.signatures
        : [createEmptySignature(currentSchoolId || currentSchool.schoolId || '')],
  };
}

function validateForm(form) {
  if (!form.schoolId.trim()) {
    return 'ไม่พบรหัสโรงเรียนของระบบ';
  }

  if (!form.schoolName.trim()) {
    return 'กรุณากรอกชื่อโรงเรียน';
  }

  return '';
}

function getFormInstanceKey(currentSchoolId, currentSchool, currentSchoolSettings) {
  const schoolStamp = currentSchool.updatedAt?.seconds || 'draft';
  const settingsStamp = currentSchoolSettings.updatedAt?.seconds || 'draft';

  return `${currentSchoolId || currentSchool.schoolId || 'draft'}:${schoolStamp}:${settingsStamp}`;
}

function buildSchoolOptions(schools, fallbackSchool) {
  const options = new Map();

  if (fallbackSchool?.schoolId) {
    options.set(fallbackSchool.schoolId, fallbackSchool);
  }

  schools.forEach((school) => {
    options.set(school.schoolId, school);
  });

  return Array.from(options.values());
}

function SchoolSettingsForm({
  currentSchool,
  currentSchoolId,
  currentSchoolSettings,
  isSaving,
  saveCurrentSchoolSettings,
  schools,
  setCurrentSchoolId,
  canManageTheme,
}) {
  const [form, setForm] = useState(() =>
    buildFormState(currentSchool, currentSchoolId, currentSchoolSettings),
  );
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const schoolOptions = buildSchoolOptions(schools, {
    schoolId: currentSchoolId || form.schoolId,
    name: currentSchool.name || form.schoolName || currentSchoolId || form.schoolId,
  });

  function handleSignatureChange(signatureId, field, value) {
    setForm((current) => ({
      ...current,
      signatures: current.signatures.map((signature, index) =>
        signature.id === signatureId
          ? {
              ...signature,
              schoolId: current.schoolId,
              [field]: value,
              sortOrder: index,
            }
          : signature,
      ),
    }));
  }

  function handleAddSignature() {
    setForm((current) => ({
      ...current,
      signatures: [
        ...current.signatures,
        {
          ...createEmptySignature(current.schoolId),
          sortOrder: current.signatures.length,
        },
      ],
    }));
  }

  function handleRemoveSignature(signatureId) {
    setForm((current) => ({
      ...current,
      signatures:
        current.signatures.filter((signature) => signature.id !== signatureId).length > 0
          ? current.signatures.filter((signature) => signature.id !== signatureId)
          : [createEmptySignature(current.schoolId)],
    }));
  }

  function handleThemeChange(field, value) {
    setForm((current) => ({
      ...current,
      theme: normalizeSchoolTheme({
        ...current.theme,
        [field]: value,
      }),
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationMessage = validateForm(form);

    if (validationMessage) {
      setFeedback({ tone: 'error', message: validationMessage });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });

      await saveCurrentSchoolSettings({
        schoolId: form.schoolId.trim(),
        schoolName: form.schoolName.trim(),
        logoUrl: form.logoUrl.trim(),
        affiliation: form.affiliation.trim(),
        theme: form.theme,
        signatures: form.signatures.map((signature, index) => ({
          ...signature,
          schoolId: form.schoolId.trim(),
          sortOrder: index,
        })),
      });

      setFeedback({
        tone: 'success',
        message: 'บันทึกข้อมูลโรงเรียนเรียบร้อยแล้ว',
      });
    } catch (saveError) {
      setFeedback({
        tone: 'error',
        message:
          saveError instanceof Error ? saveError.message : 'ไม่สามารถบันทึกข้อมูลโรงเรียนได้',
      });
    }
  }

  return (
    <>
      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="settings-grid">
          <SelectField
            label="โรงเรียนปัจจุบัน"
            value={currentSchoolId || form.schoolId}
            onChange={(event) => {
              void setCurrentSchoolId(event.target.value);
            }}
          >
            {schoolOptions.length === 0 ? (
              <option value={form.schoolId}>
                {form.schoolName || form.schoolId || 'โรงเรียนปัจจุบัน'}
              </option>
            ) : (
              schoolOptions.map((school) => (
                <option key={school.schoolId} value={school.schoolId}>
                  {school.name || school.schoolId}
                </option>
              ))
            )}
          </SelectField>

          <InputField
            label="รหัสโรงเรียนในระบบ"
            value={form.schoolId}
            readOnly
            title="ระบบกำหนดรหัสโรงเรียนให้อัตโนมัติสำหรับการใช้งานภายในโรงเรียน"
          />

          <InputField
            label="ชื่อโรงเรียน"
            value={form.schoolName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                schoolName: event.target.value,
              }))
            }
            placeholder="โรงเรียนตัวอย่าง"
          />

          <InputField
            label="สังกัด"
            value={form.affiliation}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                affiliation: event.target.value,
              }))
            }
            placeholder="สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน"
          />

          <div className="settings-grid__full">
            <InputField
              label="URL โลโก้โรงเรียน"
              value={form.logoUrl}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  logoUrl: event.target.value,
                }))
              }
              placeholder="https://..."
            />
          </div>
        </div>

        {canManageTheme ? (
          <ThemeColorPanel disabled={isSaving} onChange={handleThemeChange} theme={form.theme} />
        ) : (
          <FormMessage tone="info">
            เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถปรับธีมสีของหน้าเว็บได้
          </FormMessage>
        )}

        <section className="signature-section">
          <div className="signature-section__header">
            <div>
              <p className="auth-card__eyebrow">schoolSettings collection</p>
              <h2 className="signature-section__title">ลายเซ็นในเอกสาร</h2>
            </div>
            <button type="button" className="secondary-button" onClick={handleAddSignature}>
              เพิ่มลายเซ็น
            </button>
          </div>

          <div className="signature-list">
            {form.signatures.map((signature) => (
              <article key={signature.id} className="signature-card">
                <div className="signature-card__header">
                  <h3>ข้อมูลผู้ลงนาม</h3>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleRemoveSignature(signature.id)}
                  >
                    ลบ
                  </button>
                </div>

                <div className="settings-grid">
                  <InputField
                    label="ชื่อผู้ลงนาม"
                    value={signature.name}
                    onChange={(event) =>
                      handleSignatureChange(signature.id, 'name', event.target.value)
                    }
                    placeholder="ผู้อำนวยการโรงเรียน"
                  />
                  <InputField
                    label="ตำแหน่งผู้ลงนาม"
                    value={signature.title}
                    onChange={(event) =>
                      handleSignatureChange(signature.id, 'title', event.target.value)
                    }
                    placeholder="ผู้อำนวยการ"
                  />
                  <div className="settings-grid__full">
                    <InputField
                      label="URL ภาพลายเซ็น"
                      value={signature.imageUrl}
                      onChange={(event) =>
                        handleSignatureChange(signature.id, 'imageUrl', event.target.value)
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <button type="submit" className="primary-button" disabled={isSaving}>
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลโรงเรียน'}
        </button>
      </form>
    </>
  );
}

export function SchoolSettingsPage() {
  const { logout, profile } = useAuth();
  const {
    currentSchool,
    currentSchoolId,
    currentSchoolSettings,
    error,
    isSaving,
    saveCurrentSchoolSettings,
    schools,
    setCurrentSchoolId,
    status,
  } = useCurrentSchool();
  const formInstanceKey = getFormInstanceKey(
    currentSchoolId,
    currentSchool,
    currentSchoolSettings,
  );
  const canManageTheme = ['super_admin', 'school_admin', 'academic_admin'].includes(
    profile?.role,
  );

  if (status === 'loading') {
    return (
      <div className="loader-shell">
        <div className="loader-panel">
          <span className="loader-spinner" aria-hidden="true" />
          <p className="loader-panel__eyebrow">โรงเรียนปัจจุบัน</p>
          <h2>กำลังโหลดข้อมูลโรงเรียน</h2>
        </div>
      </div>
    );
  }

  return (
    <AcademicPageShell
      eyebrow="ตั้งค่าโรงเรียน"
      title="ข้อมูลโรงเรียนและธีม"
      description="จัดการชื่อโรงเรียน โลโก้ สังกัด ลายเซ็นเอกสาร และธีมสีของหน้าเว็บ โดยข้อมูลทั้งหมดผูกกับโรงเรียนปัจจุบัน"
      error={error}
      summary={
        <div className="academic-summary__grid">
          <StatusPill tone="info">
            โรงเรียน: {currentSchool.name || currentSchool.schoolId || 'ยังไม่ตั้งค่า'}
          </StatusPill>
          <StatusPill tone={canManageTheme ? 'success' : 'neutral'}>
            สิทธิ์ธีม: {canManageTheme ? 'ปรับได้' : 'อ่านอย่างเดียว'}
          </StatusPill>
          <button type="button" className="secondary-button" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      }
    >
      <SchoolSettingsForm
        key={formInstanceKey}
        canManageTheme={canManageTheme}
        currentSchool={currentSchool}
        currentSchoolId={currentSchoolId}
        currentSchoolSettings={currentSchoolSettings}
        isSaving={isSaving}
        saveCurrentSchoolSettings={saveCurrentSchoolSettings}
        schools={schools}
        setCurrentSchoolId={setCurrentSchoolId}
      />
    </AcademicPageShell>
  );
}
