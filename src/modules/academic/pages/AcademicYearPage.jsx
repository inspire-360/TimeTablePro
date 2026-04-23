import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { InputField } from '../../../shared/ui/InputField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';
import { activateAcademicYear, listAcademicYearsBySchool, saveAcademicYear } from '../api/academicYearRepository';
import { AcademicPageShell } from '../components/AcademicPageShell';
import { createDefaultAcademicYearValues } from '../helpers/defaultAcademicValues';
import { getActiveTerm } from '../helpers/getActiveTerm';

function buildAcademicYearFormState(schoolId, selectedAcademicYear = null) {
  if (selectedAcademicYear) {
    return {
      id: selectedAcademicYear.id,
      schoolId: selectedAcademicYear.schoolId,
      label: selectedAcademicYear.label,
      startDate: selectedAcademicYear.startDate,
      endDate: selectedAcademicYear.endDate,
      isActive: selectedAcademicYear.isActive,
    };
  }

  return createDefaultAcademicYearValues(schoolId);
}

function AcademicYearForm({
  onSave,
  selectedAcademicYear,
  schoolId,
}) {
  const [form, setForm] = useState(() => buildAcademicYearFormState(schoolId, selectedAcademicYear));
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const formKey = `${selectedAcademicYear?.id || 'new'}:${schoolId}`;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.schoolId.trim()) {
      setFeedback({ tone: 'error', message: 'schoolId is required.' });
      return;
    }

    if (!form.label.trim()) {
      setFeedback({ tone: 'error', message: 'Academic year label is required.' });
      return;
    }

    if (!form.startDate || !form.endDate) {
      setFeedback({ tone: 'error', message: 'Start date and end date are required.' });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      await onSave(form);
      setFeedback({
        tone: 'success',
        message: 'Academic year saved successfully.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save academic year.',
      });
    }
  }

  return (
    <div key={formKey} className="academic-form-card">
      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      <form className="academic-form" onSubmit={handleSubmit}>
        <div className="settings-grid">
          <InputField
            label="School ID"
            value={form.schoolId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                schoolId: event.target.value.trim().toLowerCase(),
              }))
            }
            placeholder="example-school"
          />
          <InputField
            label="Academic year label"
            value={form.label}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                label: event.target.value,
              }))
            }
            placeholder="2569"
          />
          <InputField
            label="Start date"
            type="date"
            value={form.startDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                startDate: event.target.value,
              }))
            }
          />
          <InputField
            label="End date"
            type="date"
            value={form.endDate}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                endDate: event.target.value,
              }))
            }
          />
        </div>

        <button type="submit" className="primary-button">
          {form.id ? 'Update academic year' : 'Create academic year'}
        </button>
      </form>
    </div>
  );
}

export function AcademicYearPage() {
  const { currentSchool, currentSchoolId } = useCurrentSchool();
  const schoolId = currentSchoolId || currentSchool.schoolId || '';
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const refreshAcademicYears = useCallback(async () => {
    if (!schoolId) {
      setSelectedAcademicYear(null);
      setAcademicYears([]);
      setStatus('ready');
      return;
    }

    setSelectedAcademicYear(null);
    setStatus('loading');
    setError('');

    try {
      const nextAcademicYears = await listAcademicYearsBySchool(schoolId);
      setAcademicYears(nextAcademicYears);
      setStatus('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load academic years.');
      setStatus('error');
    }
  }, [schoolId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshAcademicYears();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshAcademicYears]);

  const { activeAcademicYear } = useMemo(
    () =>
      getActiveTerm({
        academicYears,
        terms: [],
      }),
    [academicYears],
  );

  async function handleSaveAcademicYear(form) {
    await saveAcademicYear({
      ...form,
      schoolId,
      isActive: form.id ? form.isActive : academicYears.length === 0,
    });

    setSelectedAcademicYear(null);
    await refreshAcademicYears();
  }

  async function handleActivateAcademicYear(academicYear) {
    await activateAcademicYear(academicYear.id, schoolId);
    await refreshAcademicYears();
  }

  if (status === 'loading') {
    return <AppLoader label="Loading academic years" />;
  }

  return (
    <AcademicPageShell
      title="Academic Years"
      description="Manage school-scoped academic year records in the academicYears collection. The active year is used by term defaults and active-period logic."
      error={error}
      summary={
        <div className="academic-summary__grid">
          <StatusPill tone="success">
            Active year: {activeAcademicYear?.label || 'not selected'}
          </StatusPill>
          <StatusPill tone="neutral">
            Records: {academicYears.length}
          </StatusPill>
        </div>
      }
    >
      <div className="academic-page-grid">
        <AcademicYearForm
          key={`${selectedAcademicYear?.id || 'new'}:${schoolId}:${academicYears.length}`}
          schoolId={schoolId}
          selectedAcademicYear={selectedAcademicYear}
          onSave={handleSaveAcademicYear}
        />

        <section className="academic-list-card">
          <div className="academic-list-card__header">
            <div>
              <p className="auth-card__eyebrow">academicYears collection</p>
              <h2 className="academic-list-card__title">Configured years</h2>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedAcademicYear(null)}
            >
              New year
            </button>
          </div>

          <div className="academic-record-list">
            {academicYears.length === 0 ? (
              <p className="academic-empty-state">
                No academic year has been created for this school yet.
              </p>
            ) : (
              academicYears.map((academicYear) => (
                <article key={academicYear.id} className="academic-record-card">
                  <div className="academic-record-card__header">
                    <div>
                      <h3>{academicYear.label}</h3>
                      <p>
                        {academicYear.startDate} to {academicYear.endDate}
                      </p>
                    </div>
                    <div className="academic-record-card__actions">
                      {academicYear.isActive ? (
                        <StatusPill tone="success">Active</StatusPill>
                      ) : null}
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setSelectedAcademicYear(academicYear)}
                      >
                        Edit
                      </button>
                      {!academicYear.isActive ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => void handleActivateAcademicYear(academicYear)}
                        >
                          Set active
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </AcademicPageShell>
  );
}
