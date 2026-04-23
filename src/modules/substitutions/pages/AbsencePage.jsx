import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { InputField } from '../../../shared/ui/InputField';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { AcademicPageShell } from '../../academic/components/AcademicPageShell';
import { listAcademicYearsBySchool } from '../../academic/api/academicYearRepository';
import { listTermsBySchool } from '../../academic/api/termRepository';
import { listMasterDataRecords } from '../../master-data/api/masterDataRepository';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';
import { listTimeStructuresBySchool } from '../../time-structure/api/timeStructureRepository';
import { listTimetableEntriesByTeacher } from '../../timetable/api/timetableRepository';
import {
  deleteTeacherAbsenceCascade,
  listTeacherAbsencesBySchool,
  saveTeacherAbsence,
} from '../api/teacherAbsenceRepository';
import { listSubstitutionsBySchool } from '../api/substitutionRepository';
import {
  ABSENCE_REASON_OPTIONS,
  ABSENCE_STATUS_OPTIONS,
  getAbsenceReasonLabel,
  getAbsenceStatusLabel,
} from '../constants/substitutionOptions';
import {
  buildTeacherAbsenceId,
  buildTeacherAbsencePayload,
  resolveAbsenceAcademicContext,
  validateTeacherAbsenceForm,
} from '../helpers/absenceValidation';

function buildTeacherLabel(teacher) {
  return [teacher.displayName || 'Teacher', teacher.employeeCode || '']
    .filter(Boolean)
    .join(' | ');
}

function buildTimeStructureLabel(timeStructure) {
  return [timeStructure.name || 'Time structure', `${timeStructure.daysPerWeek} days`]
    .filter(Boolean)
    .join(' | ');
}

function buildTeacherAbsenceFormState({ schoolId, selectedAbsence, timeStructures }) {
  if (selectedAbsence) {
    return {
      id: selectedAbsence.id,
      schoolId: selectedAbsence.schoolId,
      teacherId: selectedAbsence.teacherId,
      date: selectedAbsence.date,
      timeStructureId: selectedAbsence.timeStructureId,
      reason: selectedAbsence.reason,
      notes: selectedAbsence.notes || '',
      status: selectedAbsence.status || 'reported',
    };
  }

  return {
    id: '',
    schoolId,
    teacherId: '',
    date: dayjs().format('YYYY-MM-DD'),
    timeStructureId: timeStructures[0]?.id || '',
    reason: ABSENCE_REASON_OPTIONS[0].value,
    notes: '',
    status: 'reported',
  };
}

function buildCoverageCountByAbsence(absences = [], substitutions = []) {
  const counts = new Map();

  absences.forEach((absence) => {
    counts.set(absence.id, 0);
  });

  substitutions.forEach((substitution) => {
    if (substitution.status === 'cancelled') {
      return;
    }

    counts.set(
      substitution.teacherAbsenceId,
      (counts.get(substitution.teacherAbsenceId) || 0) + 1,
    );
  });

  return counts;
}

function TeacherAbsenceForm({
  academicYears,
  onSave,
  schoolId,
  selectedAbsence,
  teachers,
  terms,
  timeStructures,
}) {
  const [form, setForm] = useState(() =>
    buildTeacherAbsenceFormState({ schoolId, selectedAbsence, timeStructures }),
  );
  const [previewLessons, setPreviewLessons] = useState([]);
  const [previewStatus, setPreviewStatus] = useState('idle');
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const selectedTeacher = teachers.find((teacher) => teacher.id === form.teacherId) || null;
  const selectedTimeStructure =
    timeStructures.find((timeStructure) => timeStructure.id === form.timeStructureId) || null;
  const academicContext = useMemo(
    () =>
      resolveAbsenceAcademicContext({
        academicYears,
        dateValue: form.date,
        terms,
      }),
    [academicYears, form.date, terms],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      async function loadPreviewLessons() {
        if (!selectedTeacher?.id || !selectedTimeStructure?.id || !academicContext.term?.id) {
          setPreviewLessons([]);
          setPreviewStatus('ready');
          return;
        }

        setPreviewStatus('loading');

        try {
          const entries = await listTimetableEntriesByTeacher({
            schoolId,
            teacherId: selectedTeacher.id,
            termId: academicContext.term.id,
            timeStructureId: selectedTimeStructure.id,
          });

          setPreviewLessons(
            entries.filter(
              (entry) =>
                entry.weekdayKey === academicContext.weekday?.key &&
                entry.status !== 'inactive',
            ),
          );
          setPreviewStatus('ready');
        } catch (error) {
          setFeedback({
            tone: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to preview affected lessons for this absence.',
          });
          setPreviewStatus('error');
        }
      }

      void loadPreviewLessons();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [academicContext.term?.id, academicContext.weekday?.key, schoolId, selectedTeacher?.id, selectedTimeStructure?.id]);

  async function handleSubmit(event) {
    event.preventDefault();

    const validationMessage = validateTeacherAbsenceForm({
      academicContext,
      form,
      teacher: selectedTeacher,
      timeStructure: selectedTimeStructure,
    });

    if (validationMessage) {
      setFeedback({ tone: 'error', message: validationMessage });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      const successMessage = await onSave({
        academicContext,
        affectedLessonCount: previewLessons.length,
        form,
        teacher: selectedTeacher,
        timeStructure: selectedTimeStructure,
      });

      setFeedback({
        tone: 'success',
        message: successMessage,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to save teacher absence.',
      });
    }
  }

  return (
    <section className="academic-form-card">
      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      <form className="academic-form" onSubmit={handleSubmit}>
        <div className="settings-grid">
          <InputField label="School ID" value={form.schoolId} readOnly />
          <SelectField
            label="Teacher"
            value={form.teacherId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                teacherId: event.target.value,
              }))
            }
          >
            <option value="">Select teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {buildTeacherLabel(teacher)}
              </option>
            ))}
          </SelectField>
          <InputField
            label="Absence date"
            type="date"
            value={form.date}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                date: event.target.value,
              }))
            }
          />
          <SelectField
            label="Time structure"
            value={form.timeStructureId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                timeStructureId: event.target.value,
              }))
            }
          >
            <option value="">Select time structure</option>
            {timeStructures.map((timeStructure) => (
              <option key={timeStructure.id} value={timeStructure.id}>
                {buildTimeStructureLabel(timeStructure)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Reason"
            value={form.reason}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                reason: event.target.value,
              }))
            }
          >
            {ABSENCE_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Status"
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
          >
            {ABSENCE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <label className="form-field settings-grid__full">
            <span className="form-field__label">Notes</span>
            <textarea
              className="form-field__control textarea-field__control"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Optional notes for supervisors or substitute planning."
            />
          </label>
        </div>

        <div className="timetable-helper-card">
          <span className="form-field__label">Academic context</span>
          {academicContext.error ? (
            <FormMessage tone="error">{academicContext.error}</FormMessage>
          ) : (
            <div className="academic-summary__grid">
              <StatusPill tone="info">
                {academicContext.weekday?.label || 'No weekday'}
              </StatusPill>
              <StatusPill tone="neutral">
                {academicContext.term?.name || 'No term'}
              </StatusPill>
              <StatusPill tone="neutral">
                {academicContext.academicYear?.label || 'No academic year'}
              </StatusPill>
            </div>
          )}
        </div>

        <div className="timetable-helper-card">
          <span className="form-field__label">Affected lessons preview</span>
          {previewStatus === 'loading' ? (
            <FormMessage tone="info">Checking the teacher timetable for this date.</FormMessage>
          ) : previewLessons.length === 0 ? (
            <p className="academic-empty-state">
              No scheduled lessons were found for this teacher on the selected date.
            </p>
          ) : (
            <div className="academic-record-list">
              {previewLessons.map((lesson) => (
                <article key={lesson.id} className="academic-record-card">
                  <div className="academic-record-card__header">
                    <div>
                      <h3>{lesson.subjectName}</h3>
                      <p>
                        {lesson.className} | {lesson.startTime} - {lesson.endTime}
                      </p>
                      <p>
                        {lesson.sectionType === 'subgroup' ? lesson.sectionName : 'Full class'} |{' '}
                        {lesson.classroomName || 'No room'}
                      </p>
                    </div>
                    <StatusPill tone="info">Slot {lesson.slotIndex}</StatusPill>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <button type="submit" className="primary-button">
          {form.id ? 'Update absence' : 'Save absence'}
        </button>
      </form>
    </section>
  );
}

export function AbsencePage() {
  const { currentSchool, currentSchoolId } = useCurrentSchool();
  const schoolId = currentSchoolId || currentSchool.schoolId || '';
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [timeStructures, setTimeStructures] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [selectedAbsenceId, setSelectedAbsenceId] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const selectedAbsence = useMemo(
    () => absences.find((absence) => absence.id === selectedAbsenceId) || null,
    [absences, selectedAbsenceId],
  );

  const refreshAbsencePage = useCallback(async () => {
    if (!schoolId) {
      setAcademicYears([]);
      setTerms([]);
      setTeachers([]);
      setTimeStructures([]);
      setAbsences([]);
      setSubstitutions([]);
      setSelectedAbsenceId('');
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError('');

    try {
      const [
        nextAcademicYears,
        nextTerms,
        nextTeachers,
        nextTimeStructures,
        nextAbsences,
        nextSubstitutions,
      ] = await Promise.all([
        listAcademicYearsBySchool(schoolId),
        listTermsBySchool(schoolId),
        listMasterDataRecords({ collectionName: 'teachers', schoolId }),
        listTimeStructuresBySchool(schoolId),
        listTeacherAbsencesBySchool(schoolId),
        listSubstitutionsBySchool(schoolId),
      ]);

      setAcademicYears(nextAcademicYears);
      setTerms(nextTerms);
      setTeachers(
        nextTeachers
          .filter((teacher) => teacher.status === 'active')
          .sort((left, right) =>
            buildTeacherLabel(left).localeCompare(buildTeacherLabel(right), undefined, {
              numeric: true,
            }),
          ),
      );
      setTimeStructures(nextTimeStructures);
      setAbsences(nextAbsences);
      setSubstitutions(nextSubstitutions);
      setSelectedAbsenceId((current) => {
        if (current && nextAbsences.some((absence) => absence.id === current)) {
          return current;
        }

        return nextAbsences[0]?.id || '';
      });
      setStatus('ready');
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load teacher absences.',
      );
      setStatus('error');
    }
  }, [schoolId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshAbsencePage();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshAbsencePage]);

  async function handleSaveTeacherAbsence({
    academicContext,
    affectedLessonCount,
    form,
    teacher,
    timeStructure,
  }) {
    const absenceId =
      form.id ||
      buildTeacherAbsenceId({
        date: form.date,
        schoolId,
        teacherId: teacher.id,
        timeStructureId: timeStructure.id,
      });
    const savedAbsence = await saveTeacherAbsence({
      id: absenceId,
      payload: buildTeacherAbsencePayload({
        academicContext,
        affectedLessonCount,
        form,
        teacher,
        timeStructure,
      }),
    });

    await refreshAbsencePage();
    setSelectedAbsenceId(savedAbsence.id);

    return 'Teacher absence saved successfully.';
  }

  async function handleDeleteAbsence(absence) {
    await deleteTeacherAbsenceCascade({
      schoolId,
      teacherAbsenceId: absence.id,
    });
    await refreshAbsencePage();

    return 'Teacher absence deleted successfully.';
  }

  if (status === 'loading') {
    return <AppLoader label="Loading teacher absences" />;
  }

  const coverageCountByAbsence = buildCoverageCountByAbsence(absences, substitutions);
  const totalAffectedLessons = absences.reduce(
    (total, absence) => total + (absence.affectedLessonCount || 0),
    0,
  );
  const assignedSubstitutions = substitutions.filter(
    (substitution) => substitution.status === 'assigned',
  ).length;
  const uncoveredLessons = Math.max(totalAffectedLessons - assignedSubstitutions, 0);

  return (
    <AcademicPageShell
      eyebrow="Teacher Coverage"
      title="Teacher Absences"
      description="Record school-scoped teacher absences by date and preview the lessons that need substitute coverage."
      error={error}
      summary={
        <div className="academic-summary__grid">
          <StatusPill tone="info">Absences: {absences.length}</StatusPill>
          <StatusPill tone="neutral">Affected lessons: {totalAffectedLessons}</StatusPill>
          <StatusPill tone="success">Covered: {assignedSubstitutions}</StatusPill>
          <StatusPill tone="warning">Open lessons: {uncoveredLessons}</StatusPill>
        </div>
      }
    >
      <div className="academic-page-grid">
        <TeacherAbsenceForm
          key={`${selectedAbsence?.id || 'new'}:${schoolId}:${timeStructures.length}`}
          academicYears={academicYears}
          onSave={handleSaveTeacherAbsence}
          schoolId={schoolId}
          selectedAbsence={selectedAbsence}
          teachers={teachers}
          terms={terms}
          timeStructures={timeStructures}
        />

        <section className="academic-list-card">
          <div className="academic-list-card__header">
            <div>
              <p className="auth-card__eyebrow">teacherAbsences collection</p>
              <h2 className="academic-list-card__title">Saved absences</h2>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedAbsenceId('')}
            >
              New absence
            </button>
          </div>

          {absences.length === 0 ? (
            <p className="academic-empty-state">
              No teacher absence has been reported for this school yet.
            </p>
          ) : (
            <div className="academic-record-list">
              {absences.map((absence) => (
                <article key={absence.id} className="academic-record-card">
                  <div className="academic-record-card__header">
                    <button
                      type="button"
                      className={`plc-record-card${
                        selectedAbsenceId === absence.id ? ' plc-record-card--active' : ''
                      }`}
                      onClick={() => setSelectedAbsenceId(absence.id)}
                    >
                      <div className="academic-record-card__header">
                        <div>
                          <h3>{absence.teacherName}</h3>
                          <p>
                            {absence.date} | {absence.weekdayLabel}
                          </p>
                          <p>
                            {getAbsenceReasonLabel(absence.reason)} | {absence.timeStructureName}
                          </p>
                        </div>
                        <div className="academic-record-card__actions">
                          <StatusPill tone="info">
                            Lessons: {absence.affectedLessonCount}
                          </StatusPill>
                          <StatusPill tone="success">
                            Covered: {coverageCountByAbsence.get(absence.id) || 0}
                          </StatusPill>
                          <StatusPill
                            tone={absence.status === 'cancelled' ? 'neutral' : 'warning'}
                          >
                            {getAbsenceStatusLabel(absence.status)}
                          </StatusPill>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        void handleDeleteAbsence(absence);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AcademicPageShell>
  );
}
