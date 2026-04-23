import { useState } from 'react';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { InputField } from '../../../shared/ui/InputField';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { useAuth } from '../../auth/context/useAuth';
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
    signatures:
      currentSchoolSettings.signatures.length > 0
        ? currentSchoolSettings.signatures
        : [createEmptySignature(currentSchoolId || currentSchool.schoolId || '')],
  };
}

function validateForm(form) {
  if (!form.schoolId.trim()) {
    return 'School ID is required.';
  }

  if (!form.schoolName.trim()) {
    return 'School name is required.';
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
        signatures: form.signatures.map((signature, index) => ({
          ...signature,
          schoolId: form.schoolId.trim(),
          sortOrder: index,
        })),
      });

      setFeedback({
        tone: 'success',
        message: 'School settings saved successfully.',
      });
    } catch (saveError) {
      setFeedback({
        tone: 'error',
        message:
          saveError instanceof Error ? saveError.message : 'Unable to save school settings.',
      });
    }
  }

  return (
    <>
      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="settings-grid">
          <SelectField
            label="Current school"
            value={currentSchoolId || form.schoolId}
            onChange={(event) => {
              void setCurrentSchoolId(event.target.value);
            }}
          >
            {schoolOptions.length === 0 ? (
              <option value={form.schoolId}>
                {form.schoolName || form.schoolId || 'Current school'}
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
            label="School ID"
            value={form.schoolId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                schoolId: event.target.value.trim().toLowerCase(),
                signatures: current.signatures.map((signature) => ({
                  ...signature,
                  schoolId: event.target.value.trim().toLowerCase(),
                })),
              }))
            }
            placeholder="example-school"
          />

          <InputField
            label="School name"
            value={form.schoolName}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                schoolName: event.target.value,
              }))
            }
            placeholder="Bangkok Demonstration School"
          />

          <InputField
            label="Affiliation"
            value={form.affiliation}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                affiliation: event.target.value,
              }))
            }
            placeholder="Office of the Basic Education Commission"
          />

          <div className="settings-grid__full">
            <InputField
              label="Logo URL"
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

        <section className="signature-section">
          <div className="signature-section__header">
            <div>
              <p className="auth-card__eyebrow">schoolSettings collection</p>
              <h2 className="signature-section__title">Signatures</h2>
            </div>
            <button type="button" className="secondary-button" onClick={handleAddSignature}>
              Add signature
            </button>
          </div>

          <div className="signature-list">
            {form.signatures.map((signature) => (
              <article key={signature.id} className="signature-card">
                <div className="signature-card__header">
                  <h3>Signature record</h3>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleRemoveSignature(signature.id)}
                  >
                    Remove
                  </button>
                </div>

                <div className="settings-grid">
                  <InputField
                    label="Signer name"
                    value={signature.name}
                    onChange={(event) =>
                      handleSignatureChange(signature.id, 'name', event.target.value)
                    }
                    placeholder="School director"
                  />
                  <InputField
                    label="Signer title"
                    value={signature.title}
                    onChange={(event) =>
                      handleSignatureChange(signature.id, 'title', event.target.value)
                    }
                    placeholder="Director"
                  />
                  <div className="settings-grid__full">
                    <InputField
                      label="Signature image URL"
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
          {isSaving ? 'Saving settings...' : 'Save school settings'}
        </button>
      </form>
    </>
  );
}

export function SchoolSettingsPage() {
  const { logout } = useAuth();
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

  if (status === 'loading') {
    return (
      <div className="loader-shell">
        <div className="loader-panel">
          <span className="loader-spinner" aria-hidden="true" />
          <p className="loader-panel__eyebrow">Current School</p>
          <h2>Loading school settings</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-shell">
      <section className="settings-card">
        <header className="settings-card__header">
          <div className="settings-card__heading">
            <p className="auth-card__eyebrow">Multi-school system</p>
            <h1 className="settings-card__title">School settings</h1>
            <p className="settings-card__copy">
              Manage school master data in <code>schools</code> and signatures in
              <code>schoolSettings</code>. Every saved document includes <code>schoolId</code>.
            </p>
          </div>

          <div className="settings-card__actions">
            <StatusPill tone="info">
              currentSchoolId: {currentSchoolId || currentSchool.schoolId || 'not set'}
            </StatusPill>
            <button type="button" className="secondary-button" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>

        <div className="settings-card__body">
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}

          <SchoolSettingsForm
            key={formInstanceKey}
            currentSchool={currentSchool}
            currentSchoolId={currentSchoolId}
            currentSchoolSettings={currentSchoolSettings}
            isSaving={isSaving}
            saveCurrentSchoolSettings={saveCurrentSchoolSettings}
            schools={schools}
            setCurrentSchoolId={setCurrentSchoolId}
          />
        </div>
      </section>
    </div>
  );
}
