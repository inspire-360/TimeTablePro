import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { AcademicPageShell } from '../../academic/components/AcademicPageShell';
import { listMasterDataRecords } from '../../master-data/api/masterDataRepository';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';
import { listTimetableEntriesByContext } from '../../timetable/api/timetableRepository';
import { listTeacherAbsencesBySchool } from '../api/teacherAbsenceRepository';
import {
  deleteSubstitution,
  listSubstitutionsBySchool,
  saveSubstitution,
} from '../api/substitutionRepository';
import {
  getAbsenceReasonLabel,
  getSubstitutionStatusLabel,
} from '../constants/substitutionOptions';
import {
  findAvailableSubstitute,
  getAffectedLessonsForAbsence,
} from '../helpers/findAvailableSubstitute';
import {
  buildSubstitutionFormLabel,
  buildSubstitutionId,
  buildSubstitutionPayload,
  validateSubstitutionAssignment,
} from '../helpers/substitutionValidation';

function buildTeacherLabel(teacher) {
  return [teacher.displayName || 'Teacher', teacher.employeeCode || '']
    .filter(Boolean)
    .join(' | ');
}

function buildSubstitutionCountMap(substitutions = []) {
  const counts = new Map();

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

function buildCurrentSelection({
  candidateSelections,
  candidates,
  currentSubstitution,
  lessonId,
}) {
  return (
    candidateSelections[lessonId] ||
    currentSubstitution?.substituteTeacherId ||
    candidates[0]?.teacherId ||
    ''
  );
}

export function SubstitutePage() {
  const { currentSchool, currentSchoolId } = useCurrentSchool();
  const schoolId = currentSchoolId || currentSchool.schoolId || '';
  const [teachers, setTeachers] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [contextEntries, setContextEntries] = useState([]);
  const [selectedAbsenceId, setSelectedAbsenceId] = useState('');
  const [candidateSelections, setCandidateSelections] = useState({});
  const [status, setStatus] = useState('loading');
  const [contextStatus, setContextStatus] = useState('idle');
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const [error, setError] = useState('');

  const selectedAbsence = useMemo(
    () => absences.find((absence) => absence.id === selectedAbsenceId) || null,
    [absences, selectedAbsenceId],
  );
  const activeTeachers = useMemo(
    () =>
      teachers
        .filter((teacher) => teacher.status === 'active')
        .sort((left, right) =>
          buildTeacherLabel(left).localeCompare(buildTeacherLabel(right), undefined, {
            numeric: true,
          }),
        ),
    [teachers],
  );
  const substitutionsByLessonId = useMemo(() => {
    const map = new Map();

    substitutions
      .filter(
        (substitution) =>
          substitution.teacherAbsenceId === selectedAbsence?.id &&
          substitution.status !== 'cancelled',
      )
      .forEach((substitution) => {
        map.set(substitution.timetableEntryId, substitution);
      });

    return map;
  }, [selectedAbsence?.id, substitutions]);
  const affectedLessons = useMemo(
    () =>
      getAffectedLessonsForAbsence({
        absence: selectedAbsence,
        timetableEntries: contextEntries,
      }),
    [contextEntries, selectedAbsence],
  );
  const availabilityByLessonId = useMemo(
    () =>
      Object.fromEntries(
        affectedLessons.map((lesson) => [
          lesson.id,
          findAvailableSubstitute({
            affectedEntry: lesson,
            currentSubstitution: substitutionsByLessonId.get(lesson.id) || null,
            substitutions,
            targetDate: selectedAbsence?.date || '',
            teacherAbsences: absences,
            teachers: activeTeachers,
            timetableEntries: contextEntries,
          }),
        ]),
      ),
    [absences, activeTeachers, affectedLessons, contextEntries, selectedAbsence?.date, substitutions, substitutionsByLessonId],
  );

  const refreshSubstitutePage = useCallback(async () => {
    if (!schoolId) {
      setTeachers([]);
      setAbsences([]);
      setSubstitutions([]);
      setSelectedAbsenceId('');
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError('');

    try {
      const [nextTeachers, nextAbsences, nextSubstitutions] = await Promise.all([
        listMasterDataRecords({ collectionName: 'teachers', schoolId }),
        listTeacherAbsencesBySchool(schoolId),
        listSubstitutionsBySchool(schoolId),
      ]);

      setTeachers(nextTeachers);
      setAbsences(nextAbsences.filter((absence) => absence.status !== 'cancelled'));
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
        loadError instanceof Error ? loadError.message : 'Unable to load substitute planning.',
      );
      setStatus('error');
    }
  }, [schoolId]);

  const refreshSelectedAbsenceContext = useCallback(async () => {
    if (!schoolId || !selectedAbsence?.termId || !selectedAbsence?.timeStructureId) {
      setContextEntries([]);
      setContextStatus('ready');
      return;
    }

    setContextStatus('loading');
    setError('');

    try {
      const nextContextEntries = await listTimetableEntriesByContext({
        schoolId,
        termId: selectedAbsence.termId,
        timeStructureId: selectedAbsence.timeStructureId,
      });

      setContextEntries(nextContextEntries);
      setContextStatus('ready');
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load timetable lessons for the selected absence.',
      );
      setContextStatus('error');
    }
  }, [schoolId, selectedAbsence]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshSubstitutePage();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshSubstitutePage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshSelectedAbsenceContext();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshSelectedAbsenceContext]);

  async function handleAssignSubstitute(lesson) {
    if (!selectedAbsence) {
      return;
    }

    const availability = availabilityByLessonId[lesson.id];
    const currentSubstitution = substitutionsByLessonId.get(lesson.id) || null;
    const selectedTeacherId = buildCurrentSelection({
      candidateSelections,
      candidates: availability?.candidates || [],
      currentSubstitution,
      lessonId: lesson.id,
    });
    const substituteTeacher =
      activeTeachers.find((teacher) => teacher.id === selectedTeacherId) || null;
    const validationMessage = validateSubstitutionAssignment({
      absence: selectedAbsence,
      affectedEntry: lesson,
      availability,
      substituteTeacher,
    });

    if (validationMessage) {
      setFeedback({
        tone: 'error',
        message: validationMessage,
      });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      await saveSubstitution({
        id: buildSubstitutionId({
          teacherAbsenceId: selectedAbsence.id,
          timetableEntryId: lesson.id,
        }),
        payload: buildSubstitutionPayload({
          absence: selectedAbsence,
          affectedEntry: lesson,
          substituteTeacher,
        }),
      });

      await refreshSubstitutePage();
      setSelectedAbsenceId(selectedAbsence.id);
      setFeedback({
        tone: 'success',
        message: `Substitute assigned to ${lesson.subjectName} for ${lesson.className}.`,
      });
    } catch (saveError) {
      setFeedback({
        tone: 'error',
        message:
          saveError instanceof Error
            ? saveError.message
            : 'Unable to assign the substitute teacher.',
      });
    }
  }

  async function handleClearSubstitution(substitutionId) {
    try {
      setFeedback({ tone: '', message: '' });
      await deleteSubstitution(substitutionId);
      await refreshSubstitutePage();
      setSelectedAbsenceId((current) => current || selectedAbsence?.id || '');
      setFeedback({
        tone: 'success',
        message: 'Substitute assignment cleared.',
      });
    } catch (deleteError) {
      setFeedback({
        tone: 'error',
        message:
          deleteError instanceof Error
            ? deleteError.message
            : 'Unable to clear the substitute assignment.',
      });
    }
  }

  if (status === 'loading') {
    return <AppLoader label="Loading substitute planning" />;
  }

  const substitutionCountByAbsence = buildSubstitutionCountMap(substitutions);
  const totalAffectedLessons = absences.reduce(
    (total, absence) => total + (absence.affectedLessonCount || 0),
    0,
  );
  const assignedSubstitutionCount = substitutions.filter(
    (substitution) => substitution.status === 'assigned',
  ).length;
  const uncoveredLessonCount = Math.max(totalAffectedLessons - assignedSubstitutionCount, 0);
  const selectedAssignedCount = affectedLessons.filter((lesson) =>
    substitutionsByLessonId.has(lesson.id),
  ).length;
  const selectedAvailableCoverageCount = affectedLessons.filter(
    (lesson) => (availabilityByLessonId[lesson.id]?.candidates || []).length > 0,
  ).length;

  return (
    <AcademicPageShell
      eyebrow="การสอนแทน"
      title="จัดครูสอนแทน"
      description="เลือกครูสอนแทนให้คาบที่ได้รับผลกระทบจากการลา และดูสรุปสถานะการจัดครูแทนจากตารางสอนปัจจุบัน"
      error={error}
      summary={
        <div className="academic-summary__grid">
          <StatusPill tone="info">Absences: {absences.length}</StatusPill>
          <StatusPill tone="neutral">Affected lessons: {totalAffectedLessons}</StatusPill>
          <StatusPill tone="success">Assigned: {assignedSubstitutionCount}</StatusPill>
          <StatusPill tone="warning">Open lessons: {uncoveredLessonCount}</StatusPill>
        </div>
      }
    >
      {contextStatus === 'loading' ? <AppLoader label="Loading affected lessons" /> : null}

      <div className="substitute-layout-grid">
        <div className="substitute-column">
          <section className="academic-list-card">
            <div className="academic-list-card__header">
              <div>
                <p className="auth-card__eyebrow">teacherAbsences collection</p>
                <h2 className="academic-list-card__title">Absences awaiting cover</h2>
              </div>
              {selectedAbsence ? (
                <StatusPill tone="info">{selectedAbsence.teacherName}</StatusPill>
              ) : (
                <StatusPill tone="neutral">No absence selected</StatusPill>
              )}
            </div>

            {absences.length === 0 ? (
              <p className="academic-empty-state">
                Record teacher absences first before assigning substitute coverage.
              </p>
            ) : (
              <div className="academic-record-list">
                {absences.map((absence) => (
                  <button
                    key={absence.id}
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
                        <StatusPill tone="neutral">
                          Lessons: {absence.affectedLessonCount}
                        </StatusPill>
                        <StatusPill tone="success">
                          Assigned: {substitutionCountByAbsence.get(absence.id) || 0}
                        </StatusPill>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="academic-list-card">
            <div className="academic-list-card__header">
              <div>
                <p className="auth-card__eyebrow">Coverage statistics</p>
                <h2 className="academic-list-card__title">Selected absence</h2>
              </div>
            </div>

            {!selectedAbsence ? (
              <p className="academic-empty-state">Select an absence to review substitute options.</p>
            ) : (
              <div className="academic-record-list">
                <article className="academic-record-card">
                  <div className="academic-record-card__header">
                    <div>
                      <h3>{selectedAbsence.teacherName}</h3>
                      <p>
                        {selectedAbsence.date} | {selectedAbsence.weekdayLabel}
                      </p>
                      <p>{getAbsenceReasonLabel(selectedAbsence.reason)}</p>
                    </div>
                    <div className="academic-record-card__actions">
                      <StatusPill tone="info">{selectedAbsence.timeStructureName}</StatusPill>
                    </div>
                  </div>
                </article>

                <div className="academic-summary__grid">
                  <StatusPill tone="neutral">Affected: {affectedLessons.length}</StatusPill>
                  <StatusPill tone="success">Assigned: {selectedAssignedCount}</StatusPill>
                  <StatusPill tone="warning">
                    Open: {Math.max(affectedLessons.length - selectedAssignedCount, 0)}
                  </StatusPill>
                  <StatusPill tone="info">
                    With candidates: {selectedAvailableCoverageCount}
                  </StatusPill>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="substitute-column">
          <section className="academic-list-card">
            <div className="academic-list-card__header">
              <div>
                <p className="auth-card__eyebrow">substitutions collection</p>
                <h2 className="academic-list-card__title">Substitute assignments</h2>
              </div>
              {selectedAbsence ? (
                <StatusPill tone="info">
                  {selectedAbsence.weekdayLabel} | {selectedAbsence.date}
                </StatusPill>
              ) : null}
            </div>

            {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

            {!selectedAbsence ? (
              <p className="academic-empty-state">Select an absence to assign substitutes.</p>
            ) : affectedLessons.length === 0 ? (
              <p className="academic-empty-state">
                The absent teacher has no scheduled lessons on this date.
              </p>
            ) : (
              <div className="academic-record-list">
                {affectedLessons.map((lesson) => {
                  const availability = availabilityByLessonId[lesson.id] || {
                    blocked: [],
                    candidates: [],
                  };
                  const currentSubstitution = substitutionsByLessonId.get(lesson.id) || null;
                  const effectiveSelection = buildCurrentSelection({
                    candidateSelections,
                    candidates: availability.candidates,
                    currentSubstitution,
                    lessonId: lesson.id,
                  });

                  return (
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
                          {currentSubstitution ? (
                            <p>
                              Current substitute: {currentSubstitution.substituteTeacherName} |{' '}
                              {getSubstitutionStatusLabel(currentSubstitution.status)}
                            </p>
                          ) : null}
                        </div>
                        <div className="academic-record-card__actions">
                          <StatusPill tone="info">
                            Candidates: {availability.candidates.length}
                          </StatusPill>
                          <StatusPill tone="neutral">
                            Blocked: {availability.blockedCount}
                          </StatusPill>
                        </div>
                      </div>

                      {availability.candidates.length === 0 ? (
                        <FormMessage tone="warning">
                          No available substitute was found for this lesson.
                        </FormMessage>
                      ) : (
                        <>
                          <SelectField
                            label="Available substitute"
                            value={effectiveSelection}
                            onChange={(event) =>
                              setCandidateSelections((current) => ({
                                ...current,
                                [lesson.id]: event.target.value,
                              }))
                            }
                          >
                            {availability.candidates.map((candidate) => (
                              <option key={candidate.teacherId} value={candidate.teacherId}>
                                {buildSubstitutionFormLabel({
                                  displayName: candidate.teacherName,
                                  employeeCode: candidate.teacherEmployeeCode,
                                })}{' '}
                                | {candidate.reasonSummary}
                              </option>
                            ))}
                          </SelectField>

                          <p className="plc-helper-text">
                            Recommended: {availability.candidates[0]?.teacherName || 'None'} |{' '}
                            {availability.candidates[0]?.reasonSummary || 'No recommendation'}
                          </p>
                        </>
                      )}

                      <div className="academic-record-card__actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => {
                            void handleAssignSubstitute(lesson);
                          }}
                          disabled={availability.candidates.length === 0}
                        >
                          Assign substitute
                        </button>
                        {currentSubstitution ? (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              void handleClearSubstitution(currentSubstitution.id);
                            }}
                          >
                            Clear assignment
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </AcademicPageShell>
  );
}
