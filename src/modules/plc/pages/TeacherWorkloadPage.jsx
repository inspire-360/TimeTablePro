import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { InputField } from '../../../shared/ui/InputField';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { AcademicPageShell } from '../../academic/components/AcademicPageShell';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';
import { listTimeStructuresBySchool } from '../../time-structure/api/timeStructureRepository';
import { getWeekdayByKey, getWeekdayOptions } from '../../time-structure/constants/timeStructureOptions';
import { listTeacherUsersBySchool } from '../api/teacherDirectoryRepository';
import { listPlcPoliciesBySchool } from '../api/plcPolicyRepository';
import { listTeacherPlcAssignmentsBySchool } from '../api/teacherPlcAssignmentRepository';
import {
  listTeacherWorkloadPoliciesBySchool,
  saveTeacherWorkloadPolicy,
} from '../api/teacherWorkloadPolicyRepository';
import { WeekdayToggleField } from '../components/WeekdayToggleField';
import { createDefaultTeacherWorkloadValues } from '../helpers/defaultPlcValues';
import {
  normalizePlcDayKeys,
  resolveTeacherPlcConfiguration,
  validateTeacherWorkloadForm,
} from '../helpers/plcValidation';
import { syncTeacherPlcAssignments } from '../services/syncPlcAssignments';

function buildTeacherWorkloadFormState({ schoolId, selectedTeacher, selectedWorkloadPolicy }) {
  if (selectedWorkloadPolicy) {
    return {
      id: selectedWorkloadPolicy.id,
      schoolId: selectedWorkloadPolicy.schoolId,
      teacherId: selectedWorkloadPolicy.teacherId,
      teacherName: selectedWorkloadPolicy.teacherName,
      teacherEmail: selectedWorkloadPolicy.teacherEmail,
      plcEnabled: selectedWorkloadPolicy.plcEnabled,
      plcHoursPerWeekOverride:
        selectedWorkloadPolicy.plcHoursPerWeekOverride === null
          ? ''
          : selectedWorkloadPolicy.plcHoursPerWeekOverride,
      plcDayOverrides: selectedWorkloadPolicy.plcDayOverrides,
    };
  }

  return createDefaultTeacherWorkloadValues({
    schoolId,
    teacher: selectedTeacher,
  });
}

function hasTeacherSpecificOverride(teacherWorkloadPolicy) {
  return (
    !teacherWorkloadPolicy.plcEnabled ||
    teacherWorkloadPolicy.plcDayOverrides.length > 0 ||
    teacherWorkloadPolicy.plcHoursPerWeekOverride !== null
  );
}

function formatWeekdayList(dayKeys = []) {
  return dayKeys
    .map((dayKey) => getWeekdayByKey(dayKey)?.label || dayKey)
    .join(', ');
}

function TeacherWorkloadForm({
  activePlcPolicy,
  onSave,
  schoolId,
  selectedTeacher,
  selectedWorkloadPolicy,
  timeStructure,
}) {
  const [form, setForm] = useState(() =>
    buildTeacherWorkloadFormState({
      schoolId,
      selectedTeacher,
      selectedWorkloadPolicy,
    }),
  );
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const visibleWeekdays = getWeekdayOptions(timeStructure?.daysPerWeek || 0);
  const effectiveConfiguration = activePlcPolicy
    ? resolveTeacherPlcConfiguration({
        plcPolicy: activePlcPolicy,
        teacherWorkloadPolicy: {
          ...form,
          plcHoursPerWeekOverride:
            form.plcHoursPerWeekOverride === ''
              ? null
              : form.plcHoursPerWeekOverride,
        },
      })
    : null;

  function handleToggleDay(dayKey) {
    setForm((current) => {
      const nextDayKeys = current.plcDayOverrides.includes(dayKey)
        ? current.plcDayOverrides.filter((currentDayKey) => currentDayKey !== dayKey)
        : [...current.plcDayOverrides, dayKey];

      return {
        ...current,
        plcDayOverrides: normalizePlcDayKeys(nextDayKeys),
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationMessage = validateTeacherWorkloadForm({
      form,
      plcPolicy: activePlcPolicy,
      timeStructure,
    });

    if (validationMessage) {
      setFeedback({ tone: 'error', message: validationMessage });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      const successMessage = await onSave(form);
      setFeedback({
        tone: 'success',
        message: successMessage,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to save teacher workload settings.',
      });
    }
  }

  return (
    <section className="academic-form-card">
      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      {!activePlcPolicy ? (
        <p className="academic-empty-state">
          Set an active PLC policy first. Teacher overrides are generated against that policy.
        </p>
      ) : !selectedTeacher ? (
        <p className="academic-empty-state">
          Select a teacher to configure PLC workload overrides.
        </p>
      ) : (
        <form className="academic-form" onSubmit={handleSubmit}>
          <div className="settings-grid">
            <InputField label="School ID" value={form.schoolId} readOnly />
            <InputField label="Teacher" value={form.teacherName} readOnly />
            <InputField label="Teacher email" value={form.teacherEmail} readOnly />
            <SelectField
              label="PLC participation"
              value={form.plcEnabled ? 'enabled' : 'disabled'}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  plcEnabled: event.target.value === 'enabled',
                }))
              }
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </SelectField>
            <InputField
              label="Hours override"
              type="number"
              min="0.25"
              max="20"
              step="0.25"
              value={form.plcHoursPerWeekOverride}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  plcHoursPerWeekOverride: event.target.value,
                }))
              }
              placeholder={`${activePlcPolicy.hoursPerWeek}`}
            />
            <div className="plc-override-summary">
              <span className="form-field__label">Effective PLC load</span>
              <div className="academic-summary__grid">
                <StatusPill tone={form.plcEnabled ? 'success' : 'neutral'}>
                  {form.plcEnabled ? 'Teacher blocks PLC time' : 'PLC disabled'}
                </StatusPill>
                {effectiveConfiguration ? (
                  <>
                    <StatusPill tone="info">
                      {effectiveConfiguration.effectiveHoursPerWeek} hours/week
                    </StatusPill>
                    <StatusPill tone="neutral">
                      {formatWeekdayList(effectiveConfiguration.effectiveDays) || 'No PLC days'}
                    </StatusPill>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <WeekdayToggleField
            label="PLC day overrides"
            weekdays={visibleWeekdays}
            selectedKeys={form.plcDayOverrides}
            onToggle={handleToggleDay}
            helper={`Leave all days unselected to inherit the school policy: ${formatWeekdayList(
              activePlcPolicy.plcDays,
            )}.`}
            disabled={!form.plcEnabled}
          />

          <div className="time-slot-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  plcEnabled: true,
                  plcHoursPerWeekOverride: '',
                  plcDayOverrides: [],
                }))
              }
            >
              Use school defaults
            </button>
            <button type="submit" className="primary-button">
              Save teacher workload
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export function TeacherWorkloadPage() {
  const { currentSchool, currentSchoolId } = useCurrentSchool();
  const schoolId = currentSchoolId || currentSchool.schoolId || '';
  const [plcPolicies, setPlcPolicies] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherWorkloadPolicies, setTeacherWorkloadPolicies] = useState([]);
  const [teacherPlcAssignments, setTeacherPlcAssignments] = useState([]);
  const [timeStructures, setTimeStructures] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const activePlcPolicy = useMemo(
    () => plcPolicies.find((plcPolicy) => plcPolicy.isActive) || null,
    [plcPolicies],
  );

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.uid === selectedTeacherId) || null,
    [selectedTeacherId, teachers],
  );

  const teacherWorkloadPolicyByTeacherId = useMemo(
    () =>
      new Map(
        teacherWorkloadPolicies.map((teacherWorkloadPolicy) => [
          teacherWorkloadPolicy.teacherId,
          teacherWorkloadPolicy,
        ]),
      ),
    [teacherWorkloadPolicies],
  );

  const selectedWorkloadPolicy = selectedTeacher
    ? teacherWorkloadPolicyByTeacherId.get(selectedTeacher.uid) || null
    : null;

  const timeStructure =
    timeStructures.find(
      (currentTimeStructure) => currentTimeStructure.id === activePlcPolicy?.timeStructureId,
    ) || null;

  const assignmentCountByTeacherId = useMemo(() => {
    const counts = new Map();

    teacherPlcAssignments.forEach((assignment) => {
      counts.set(assignment.teacherId, (counts.get(assignment.teacherId) || 0) + 1);
    });

    return counts;
  }, [teacherPlcAssignments]);

  const selectedAssignments = useMemo(
    () =>
      selectedTeacher
        ? teacherPlcAssignments.filter(
            (assignment) => assignment.teacherId === selectedTeacher.uid,
          )
        : [],
    [selectedTeacher, teacherPlcAssignments],
  );

  const overrideCount = useMemo(
    () =>
      teacherWorkloadPolicies.filter((teacherWorkloadPolicy) =>
        hasTeacherSpecificOverride(teacherWorkloadPolicy),
      ).length,
    [teacherWorkloadPolicies],
  );

  const refreshTeacherWorkloadPage = useCallback(async () => {
    if (!schoolId) {
      setPlcPolicies([]);
      setTeachers([]);
      setTeacherWorkloadPolicies([]);
      setTeacherPlcAssignments([]);
      setTimeStructures([]);
      setSelectedTeacherId('');
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError('');

    try {
      const [
        nextPlcPolicies,
        nextTeachers,
        nextTeacherWorkloadPolicies,
        nextTeacherPlcAssignments,
        nextTimeStructures,
      ] = await Promise.all([
        listPlcPoliciesBySchool(schoolId),
        listTeacherUsersBySchool(schoolId),
        listTeacherWorkloadPoliciesBySchool(schoolId),
        listTeacherPlcAssignmentsBySchool(schoolId),
        listTimeStructuresBySchool(schoolId),
      ]);

      setPlcPolicies(nextPlcPolicies);
      setTeachers(nextTeachers);
      setTeacherWorkloadPolicies(nextTeacherWorkloadPolicies);
      setTeacherPlcAssignments(nextTeacherPlcAssignments);
      setTimeStructures(nextTimeStructures);
      setSelectedTeacherId((current) => {
        if (current && nextTeachers.some((teacher) => teacher.uid === current)) {
          return current;
        }

        return nextTeachers[0]?.uid || '';
      });
      setStatus('ready');
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load teacher workload settings.',
      );
      setStatus('error');
    }
  }, [schoolId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshTeacherWorkloadPage();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshTeacherWorkloadPage]);

  async function handleSaveTeacherWorkload(form) {
    if (!selectedTeacher || !activePlcPolicy) {
      throw new Error('Select a teacher and ensure an active PLC policy exists.');
    }

    const savedPolicy = await saveTeacherWorkloadPolicy({
      ...form,
      schoolId,
    });
    const syncResult = await syncTeacherPlcAssignments({
      plcPolicy: activePlcPolicy,
      schoolId,
      teacher: selectedTeacher,
      teacherWorkloadPolicy: savedPolicy,
    });

    await refreshTeacherWorkloadPage();
    setSelectedTeacherId(selectedTeacher.uid);

    if (syncResult.warnings.length > 0) {
      return `Teacher workload settings saved. ${syncResult.warnings[0]}`;
    }

    return `Teacher workload settings saved. ${syncResult.assignments.length} PLC block(s) generated for ${selectedTeacher.displayName}.`;
  }

  if (status === 'loading') {
    return <AppLoader label="Loading teacher workload settings" />;
  }

  return (
    <AcademicPageShell
      eyebrow="Teacher Collaboration"
      title="Teacher Workload"
      description="Apply teacher-specific PLC overrides without changing the student timetable. PLC assignments block teacher availability only."
      error={error}
      summary={
        <div className="academic-summary__grid">
          <StatusPill tone="success">
            Active policy: {activePlcPolicy?.name || 'not selected'}
          </StatusPill>
          <StatusPill tone="info">Teachers: {teachers.length}</StatusPill>
          <StatusPill tone="neutral">Overrides: {overrideCount}</StatusPill>
          <StatusPill tone="neutral">
            PLC blocks: {teacherPlcAssignments.length}
          </StatusPill>
        </div>
      }
    >
      <div className="academic-page-grid">
        <div className="time-structure-column">
          <TeacherWorkloadForm
            key={`${selectedTeacher?.uid || 'none'}:${schoolId}:${selectedWorkloadPolicy?.id || 'new'}`}
            activePlcPolicy={activePlcPolicy}
            onSave={handleSaveTeacherWorkload}
            schoolId={schoolId}
            selectedTeacher={selectedTeacher}
            selectedWorkloadPolicy={selectedWorkloadPolicy}
            timeStructure={timeStructure}
          />

          <section className="academic-list-card">
            <div className="academic-list-card__header">
              <div>
                <p className="auth-card__eyebrow">teacherWorkloadPolicies collection</p>
                <h2 className="academic-list-card__title">Teachers</h2>
              </div>
              {timeStructure ? (
                <StatusPill tone="info">{timeStructure.name}</StatusPill>
              ) : (
                <StatusPill tone="neutral">No active policy</StatusPill>
              )}
            </div>

            {teachers.length === 0 ? (
              <p className="academic-empty-state">
                No teacher user profiles were found for this school yet.
              </p>
            ) : (
              <div className="academic-record-list">
                {teachers.map((teacher) => {
                  const teacherWorkloadPolicy =
                    teacherWorkloadPolicyByTeacherId.get(teacher.uid) || null;
                  const effectiveConfiguration = activePlcPolicy
                    ? resolveTeacherPlcConfiguration({
                        plcPolicy: activePlcPolicy,
                        teacherWorkloadPolicy,
                      })
                    : null;
                  const isActive = selectedTeacherId === teacher.uid;

                  return (
                    <button
                      key={teacher.uid}
                      type="button"
                      className={`plc-record-card${isActive ? ' plc-record-card--active' : ''}`}
                      onClick={() => setSelectedTeacherId(teacher.uid)}
                    >
                      <div className="academic-record-card__header">
                        <div>
                          <h3>{teacher.displayName}</h3>
                          <p>{teacher.email || 'No email address'}</p>
                          {effectiveConfiguration ? (
                            <p>
                              {effectiveConfiguration.plcEnabled ? (
                                <>
                                  {effectiveConfiguration.effectiveHoursPerWeek} hours/week |{' '}
                                  {formatWeekdayList(effectiveConfiguration.effectiveDays)}
                                </>
                              ) : (
                                'PLC disabled for this teacher'
                              )}
                            </p>
                          ) : null}
                        </div>
                        <div className="academic-record-card__actions">
                          {teacherWorkloadPolicy && hasTeacherSpecificOverride(teacherWorkloadPolicy) ? (
                            <StatusPill tone="success">Override</StatusPill>
                          ) : (
                            <StatusPill tone="neutral">Default</StatusPill>
                          )}
                          <StatusPill tone="info">
                            Blocks: {assignmentCountByTeacherId.get(teacher.uid) || 0}
                          </StatusPill>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <section className="academic-list-card">
          <div className="academic-list-card__header">
            <div>
              <p className="auth-card__eyebrow">teacherPlcAssignments collection</p>
              <h2 className="academic-list-card__title">Generated PLC blocks</h2>
            </div>
            {selectedTeacher ? (
              <StatusPill tone="info">{selectedTeacher.displayName}</StatusPill>
            ) : null}
          </div>

          {!activePlcPolicy ? (
            <p className="academic-empty-state">
              Activate a PLC policy to start generating teacher PLC blocks.
            </p>
          ) : selectedAssignments.length === 0 ? (
            <p className="academic-empty-state">
              No PLC blocks have been generated for the selected teacher yet.
            </p>
          ) : (
            <div className="academic-record-list">
              {selectedAssignments.map((assignment) => (
                <article key={assignment.id} className="academic-record-card">
                  <div className="academic-record-card__header">
                    <div>
                      <h3>{assignment.weekdayLabel}</h3>
                      <p>
                        {assignment.startTime} to {assignment.endTime} |{' '}
                        {assignment.durationMinutes / 60} hours
                      </p>
                      <p>
                        source: {assignment.source} | teacher only | hidden from student timetable
                      </p>
                    </div>
                    <div className="academic-record-card__actions">
                      <StatusPill tone="success">Teacher blocked</StatusPill>
                    </div>
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
