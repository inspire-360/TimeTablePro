import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { InputField } from '../../../shared/ui/InputField';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';
import { listAcademicYearsBySchool } from '../api/academicYearRepository';
import { activateTerm, listTermsBySchool, saveTerm } from '../api/termRepository';
import { AcademicPageShell } from '../components/AcademicPageShell';
import { createDefaultTermValues } from '../helpers/defaultAcademicValues';
import { getActiveTerm } from '../helpers/getActiveTerm';

function buildTermFormState(academicYears, schoolId, selectedTerm, terms) {
  if (selectedTerm) {
    return {
      id: selectedTerm.id,
      schoolId: selectedTerm.schoolId,
      academicYearId: selectedTerm.academicYearId,
      name: selectedTerm.name,
      termNumber: selectedTerm.termNumber,
      startDate: selectedTerm.startDate,
      endDate: selectedTerm.endDate,
      isActive: selectedTerm.isActive,
    };
  }

  return createDefaultTermValues({
    academicYears,
    schoolId,
    terms,
  });
}

function TermForm({
  academicYears,
  onSave,
  schoolId,
  selectedTerm,
  terms,
}) {
  const [form, setForm] = useState(() =>
    buildTermFormState(academicYears, schoolId, selectedTerm, terms),
  );
  const [feedback, setFeedback] = useState({ tone: '', message: '' });

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.schoolId.trim()) {
      setFeedback({ tone: 'error', message: 'schoolId is required.' });
      return;
    }

    if (!form.academicYearId) {
      setFeedback({ tone: 'error', message: 'Select an academic year before saving a term.' });
      return;
    }

    if (!form.name.trim()) {
      setFeedback({ tone: 'error', message: 'Term name is required.' });
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
        message: 'Term saved successfully.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save term.',
      });
    }
  }

  return (
    <div className="academic-form-card">
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
          <SelectField
            label="Academic year"
            value={form.academicYearId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                academicYearId: event.target.value,
              }))
            }
          >
            <option value="">Select academic year</option>
            {academicYears.map((academicYear) => (
              <option key={academicYear.id} value={academicYear.id}>
                {academicYear.label}
              </option>
            ))}
          </SelectField>
          <InputField
            label="Term name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Term 1"
          />
          <InputField
            label="Term number"
            type="number"
            min="1"
            value={form.termNumber}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                termNumber: Number(event.target.value) || 1,
              }))
            }
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

        <button type="submit" className="primary-button" disabled={academicYears.length === 0}>
          {form.id ? 'Update term' : 'Create term'}
        </button>
      </form>
    </div>
  );
}

export function TermPage() {
  const { currentSchool, currentSchoolId } = useCurrentSchool();
  const schoolId = currentSchoolId || currentSchool.schoolId || '';
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const refreshTermsPage = useCallback(async () => {
    if (!schoolId) {
      setSelectedTerm(null);
      setAcademicYears([]);
      setTerms([]);
      setStatus('ready');
      return;
    }

    setSelectedTerm(null);
    setStatus('loading');
    setError('');

    try {
      const [nextAcademicYears, nextTerms] = await Promise.all([
        listAcademicYearsBySchool(schoolId),
        listTermsBySchool(schoolId),
      ]);
      setAcademicYears(nextAcademicYears);
      setTerms(nextTerms);
      setStatus('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load terms.');
      setStatus('error');
    }
  }, [schoolId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshTermsPage();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshTermsPage]);

  const { activeAcademicYear, activeTerm } = useMemo(
    () =>
      getActiveTerm({
        academicYears,
        terms,
      }),
    [academicYears, terms],
  );

  const academicYearLabelById = useMemo(
    () =>
      new Map(academicYears.map((academicYear) => [academicYear.id, academicYear.label])),
    [academicYears],
  );

  async function handleSaveTerm(form) {
    await saveTerm({
      ...form,
      schoolId,
      isActive: form.id ? form.isActive : terms.length === 0,
    });

    setSelectedTerm(null);
    await refreshTermsPage();
  }

  async function handleActivateTerm(term) {
    await activateTerm(term.id, schoolId);
    await refreshTermsPage();
  }

  if (status === 'loading') {
    return <AppLoader label="Loading terms" />;
  }

  return (
    <AcademicPageShell
      title="ภาคเรียน"
      description="จัดการภาคเรียนของโรงเรียน ระบบจะใช้ภาคเรียนที่เปิดใช้งาน หรือคำนวณจากช่วงวันที่เมื่อยังไม่ได้เลือกภาคเรียนปัจจุบัน"
      error={error}
      summary={
        <div className="academic-summary__grid">
          <StatusPill tone="success">
            Active year: {activeAcademicYear?.label || 'not selected'}
          </StatusPill>
          <StatusPill tone="success">
            Active term: {activeTerm?.name || 'not selected'}
          </StatusPill>
          <StatusPill tone="neutral">Records: {terms.length}</StatusPill>
        </div>
      }
    >
      <div className="academic-page-grid">
        <TermForm
          key={`${selectedTerm?.id || 'new'}:${schoolId}:${academicYears.length}:${terms.length}`}
          academicYears={academicYears}
          onSave={handleSaveTerm}
          schoolId={schoolId}
          selectedTerm={selectedTerm}
          terms={terms}
        />

        <section className="academic-list-card">
          <div className="academic-list-card__header">
            <div>
              <p className="auth-card__eyebrow">terms collection</p>
              <h2 className="academic-list-card__title">Configured terms</h2>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedTerm(null)}
            >
              New term
            </button>
          </div>

          {academicYears.length === 0 ? (
            <p className="academic-empty-state">
              Create at least one academic year before adding terms.
            </p>
          ) : (
            <div className="academic-record-list">
              {terms.length === 0 ? (
                <p className="academic-empty-state">
                  No terms have been created for this school yet.
                </p>
              ) : (
                terms.map((term) => (
                  <article key={term.id} className="academic-record-card">
                    <div className="academic-record-card__header">
                      <div>
                        <h3>{term.name}</h3>
                        <p>
                          {academicYearLabelById.get(term.academicYearId) || 'Unknown year'} • Term{' '}
                          {term.termNumber}
                        </p>
                        <p>
                          {term.startDate} to {term.endDate}
                        </p>
                      </div>
                      <div className="academic-record-card__actions">
                        {term.isActive ? <StatusPill tone="success">Active</StatusPill> : null}
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setSelectedTerm(term)}
                        >
                          Edit
                        </button>
                        {!term.isActive ? (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => void handleActivateTerm(term)}
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
          )}
        </section>
      </div>
    </AcademicPageShell>
  );
}
