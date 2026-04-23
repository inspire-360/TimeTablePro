import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { InputField } from '../../../shared/ui/InputField';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { AcademicPageShell } from '../../academic/components/AcademicPageShell';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';
import { listTimeStructuresBySchool } from '../../time-structure/api/timeStructureRepository';
import {
  getWeekdayByKey,
  getWeekdayOptions,
} from '../../time-structure/constants/timeStructureOptions';
import { listTeacherUsersBySchool } from '../api/teacherDirectoryRepository';
import { listPlcPoliciesBySchool, savePlcPolicy, activatePlcPolicy } from '../api/plcPolicyRepository';
import { listTeacherPlcAssignmentsBySchool } from '../api/teacherPlcAssignmentRepository';
import { listTeacherWorkloadPoliciesBySchool } from '../api/teacherWorkloadPolicyRepository';
import { WeekdayToggleField } from '../components/WeekdayToggleField';
import { createDefaultPlcPolicyValues } from '../helpers/defaultPlcValues';
import { normalizePlcDayKeys, validatePlcPolicyForm } from '../helpers/plcValidation';
import { syncPlcAssignmentsForTeachers } from '../services/syncPlcAssignments';

function buildPolicyFormState({ school, selectedPolicy, timeStructures }) {
  if (selectedPolicy) {
    return {
      id: selectedPolicy.id,
      schoolId: selectedPolicy.schoolId,
      name: selectedPolicy.name,
      timeStructureId: selectedPolicy.timeStructureId,
      plcDays: selectedPolicy.plcDays,
      hoursPerWeek: selectedPolicy.hoursPerWeek,
      isActive: selectedPolicy.isActive,
    };
  }

  return createDefaultPlcPolicyValues({
    school,
    timeStructure: timeStructures[0] || null,
  });
}

function summarizePolicySync({ teacherCount, totalAssignments, warnings }) {
  if (teacherCount === 0) {
    return 'PLC policy saved successfully.';
  }

  if (warnings.length > 0) {
    return `PLC policy saved. ${totalAssignments} PLC blocks were generated, and some teachers still need weekday schedules before PLC can be placed.`;
  }

  return `PLC policy saved. ${totalAssignments} PLC blocks were generated across ${teacherCount} teachers.`;
}

function formatWeekdayList(dayKeys = []) {
  return dayKeys
    .map((dayKey) => getWeekdayByKey(dayKey)?.label || dayKey)
    .join(', ');
}

function PlcPolicyForm({
  currentSchool,
  onSave,
  selectedPolicy,
  timeStructures,
}) {
  const [form, setForm] = useState(() =>
    buildPolicyFormState({
      school: currentSchool,
      selectedPolicy,
      timeStructures,
    }),
  );
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const selectedTimeStructure =
    timeStructures.find((timeStructure) => timeStructure.id === form.timeStructureId) || null;
  const visibleWeekdays = getWeekdayOptions(selectedTimeStructure?.daysPerWeek || 0);

  function handleToggleDay(dayKey) {
    setForm((current) => {
      const nextDayKeys = current.plcDays.includes(dayKey)
        ? current.plcDays.filter((currentDayKey) => currentDayKey !== dayKey)
        : [...current.plcDays, dayKey];

      return {
        ...current,
        plcDays: normalizePlcDayKeys(nextDayKeys),
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationMessage = validatePlcPolicyForm({
      form,
      timeStructure: selectedTimeStructure,
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
        message: error instanceof Error ? error.message : 'Unable to save the PLC policy.',
      });
    }
  }

  return (
    <section className="academic-form-card">
      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      <form className="academic-form" onSubmit={handleSubmit}>
        <div className="settings-grid">
          <InputField label="School ID" value={form.schoolId} readOnly />
          <InputField
            label="Policy name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Primary PLC Policy"
          />
          <SelectField
            label="Time structure"
            value={form.timeStructureId}
            onChange={(event) => {
              const nextTimeStructure =
                timeStructures.find(
                  (timeStructure) => timeStructure.id === event.target.value,
                ) || null;
              const allowedWeekdays = new Set(
                getWeekdayOptions(nextTimeStructure?.daysPerWeek || 0).map(
                  (weekday) => weekday.key,
                ),
              );
              setForm((current) => {
                const nextDays = normalizePlcDayKeys(
                  current.plcDays.filter((dayKey) => allowedWeekdays.has(dayKey)),
                );

                return {
                  ...current,
                  timeStructureId: event.target.value,
                  plcDays:
                    nextDays.length > 0
                      ? nextDays
                      : getWeekdayOptions(nextTimeStructure?.daysPerWeek || 0)
                          .slice(-1)
                          .map((weekday) => weekday.key),
                };
              });
            }}
          >
            <option value="">Select time structure</option>
            {timeStructures.map((timeStructure) => (
              <option key={timeStructure.id} value={timeStructure.id}>
                {timeStructure.name}
              </option>
            ))}
          </SelectField>
          <InputField
            label="PLC hours per week"
            type="number"
            min="0.25"
            max="20"
            step="0.25"
            value={form.hoursPerWeek}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                hoursPerWeek: event.target.value,
              }))
            }
          />
          <SelectField
            label="Policy status"
            value={form.isActive ? 'active' : 'inactive'}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isActive: event.target.value === 'active',
              }))
            }
          >
            <option value="active">Active policy</option>
            <option value="inactive">Inactive draft</option>
          </SelectField>
        </div>

        <WeekdayToggleField
          label="PLC days"
          weekdays={visibleWeekdays}
          selectedKeys={form.plcDays}
          onToggle={handleToggleDay}
          helper="PLC is generated immediately after the last teaching period on each selected day."
          disabled={!selectedTimeStructure}
        />

        <button type="submit" className="primary-button" disabled={timeStructures.length === 0}>
          {form.id ? 'Update PLC policy' : 'Create PLC policy'}
        </button>
      </form>
    </section>
  );
}

export function PlcPolicySettingsPage() {
  const { currentSchool, currentSchoolId } = useCurrentSchool();
  const schoolId = currentSchoolId || currentSchool.schoolId || '';
  const [plcPolicies, setPlcPolicies] = useState([]);
  const [timeStructures, setTimeStructures] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherWorkloadPolicies, setTeacherWorkloadPolicies] = useState([]);
  const [teacherPlcAssignments, setTeacherPlcAssignments] = useState([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [actionFeedback, setActionFeedback] = useState({ tone: '', message: '' });

  const selectedPolicy = useMemo(
    () => plcPolicies.find((plcPolicy) => plcPolicy.id === selectedPolicyId) || null,
    [plcPolicies, selectedPolicyId],
  );

  const activePlcPolicy = useMemo(
    () => plcPolicies.find((plcPolicy) => plcPolicy.isActive) || null,
    [plcPolicies],
  );

  const refreshPlcPage = useCallback(async () => {
    if (!schoolId) {
      setPlcPolicies([]);
      setTimeStructures([]);
      setTeachers([]);
      setTeacherWorkloadPolicies([]);
      setTeacherPlcAssignments([]);
      setSelectedPolicyId('');
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError('');

    try {
      const [
        nextPlcPolicies,
        nextTimeStructures,
        nextTeachers,
        nextTeacherWorkloadPolicies,
        nextTeacherPlcAssignments,
      ] = await Promise.all([
        listPlcPoliciesBySchool(schoolId),
        listTimeStructuresBySchool(schoolId),
        listTeacherUsersBySchool(schoolId),
        listTeacherWorkloadPoliciesBySchool(schoolId),
        listTeacherPlcAssignmentsBySchool(schoolId),
      ]);

      setPlcPolicies(nextPlcPolicies);
      setTimeStructures(nextTimeStructures);
      setTeachers(nextTeachers);
      setTeacherWorkloadPolicies(nextTeacherWorkloadPolicies);
      setTeacherPlcAssignments(nextTeacherPlcAssignments);
      setSelectedPolicyId((current) => {
        if (current && nextPlcPolicies.some((plcPolicy) => plcPolicy.id === current)) {
          return current;
        }

        return nextPlcPolicies[0]?.id || '';
      });
      setStatus('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load PLC settings.');
      setStatus('error');
    }
  }, [schoolId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshPlcPage();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshPlcPage]);

  async function handleSavePlcPolicy(form) {
    const selectedTimeStructure =
      timeStructures.find((timeStructure) => timeStructure.id === form.timeStructureId) || null;
    const isFirstPolicy = !form.id && plcPolicies.length === 0;
    const savedPolicy = await savePlcPolicy({
      ...form,
      schoolId,
      isActive: form.id ? form.isActive : isFirstPolicy || Boolean(form.isActive),
      timeStructureName: selectedTimeStructure?.name || '',
    });

    let successMessage = 'PLC policy saved successfully.';

    if (savedPolicy.isActive) {
      const syncResult = await syncPlcAssignmentsForTeachers({
        plcPolicy: savedPolicy,
        schoolId,
        teachers,
        teacherWorkloadPolicies,
      });

      successMessage = summarizePolicySync({
        teacherCount: teachers.length,
        totalAssignments: syncResult.totalAssignments,
        warnings: syncResult.warnings,
      });
    }

    await refreshPlcPage();
    setSelectedPolicyId(savedPolicy.id);
    setActionFeedback({ tone: 'success', message: '' });

    return successMessage;
  }

  async function handleActivatePolicy(plcPolicy) {
    try {
      const activatedPolicy = await activatePlcPolicy(plcPolicy.id, schoolId);
      const syncResult = await syncPlcAssignmentsForTeachers({
        plcPolicy: activatedPolicy,
        schoolId,
        teachers,
        teacherWorkloadPolicies,
      });

      await refreshPlcPage();
      setSelectedPolicyId(activatedPolicy.id);
      setActionFeedback({
        tone: syncResult.warnings.length > 0 ? 'info' : 'success',
        message: syncResult.warnings.length > 0
          ? 'PLC policy activated. Some teacher PLC blocks are waiting for weekday schedules with teaching periods.'
          : `PLC policy activated. ${syncResult.totalAssignments} PLC blocks were regenerated.`,
      });
    } catch (activationError) {
      setActionFeedback({
        tone: 'error',
        message:
          activationError instanceof Error
            ? activationError.message
            : 'Unable to activate the PLC policy.',
      });
    }
  }

  if (status === 'loading') {
    return <AppLoader label="Loading PLC policy settings" />;
  }

  return (
    <AcademicPageShell
      eyebrow="Teacher Collaboration"
      title="PLC Policy Settings"
      description="Configure school-wide PLC days, weekly PLC hours, and the time structure used to generate teacher-only PLC blocks after the final teaching period."
      error={error}
      summary={
        <div className="academic-summary__grid">
          <StatusPill tone="success">
            Active policy: {activePlcPolicy?.name || 'not selected'}
          </StatusPill>
          <StatusPill tone="info">Teachers: {teachers.length}</StatusPill>
          <StatusPill tone="neutral">
            Workload overrides: {teacherWorkloadPolicies.length}
          </StatusPill>
          <StatusPill tone="neutral">
            PLC blocks: {teacherPlcAssignments.length}
          </StatusPill>
        </div>
      }
    >
      {actionFeedback.message ? (
        <FormMessage tone={actionFeedback.tone}>{actionFeedback.message}</FormMessage>
      ) : null}

      <div className="academic-page-grid">
        <PlcPolicyForm
          key={`${selectedPolicy?.id || 'new'}:${schoolId}:${timeStructures.length}`}
          currentSchool={{
            ...currentSchool,
            schoolId,
          }}
          onSave={handleSavePlcPolicy}
          selectedPolicy={selectedPolicy}
          timeStructures={timeStructures}
        />

        <section className="academic-list-card">
          <div className="academic-list-card__header">
            <div>
              <p className="auth-card__eyebrow">plcPolicies collection</p>
              <h2 className="academic-list-card__title">Configured PLC policies</h2>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSelectedPolicyId('')}
            >
              New policy
            </button>
          </div>

          {timeStructures.length === 0 ? (
            <p className="academic-empty-state">
              Create a time structure first so PLC can be placed after each day&apos;s last
              teaching period.
            </p>
          ) : plcPolicies.length === 0 ? (
            <p className="academic-empty-state">
              No PLC policy has been created for this school yet.
            </p>
          ) : (
            <div className="academic-record-list">
              {plcPolicies.map((plcPolicy) => (
                <button
                  key={plcPolicy.id}
                  type="button"
                  className={`plc-record-card${
                    selectedPolicyId === plcPolicy.id ? ' plc-record-card--active' : ''
                  }`}
                  onClick={() => setSelectedPolicyId(plcPolicy.id)}
                >
                  <div className="academic-record-card__header">
                    <div>
                      <h3>{plcPolicy.name}</h3>
                      <p>{plcPolicy.timeStructureName || 'No time structure selected'}</p>
                      <p>
                        Days: {formatWeekdayList(plcPolicy.plcDays) || 'none'} |{' '}
                        {plcPolicy.hoursPerWeek} hours/week
                      </p>
                    </div>
                    <div className="academic-record-card__actions">
                      {plcPolicy.isActive ? <StatusPill tone="success">Active</StatusPill> : null}
                      {!plcPolicy.isActive ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleActivatePolicy(plcPolicy);
                          }}
                        >
                          Set active
                        </button>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </AcademicPageShell>
  );
}
