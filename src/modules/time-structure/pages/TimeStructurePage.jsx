import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { InputField } from '../../../shared/ui/InputField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { AcademicPageShell } from '../../academic/components/AcademicPageShell';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';
import { listDailySchedulesByTimeStructure } from '../api/dailyScheduleRepository';
import { listTimeSlotsByDailySchedule } from '../api/timeSlotRepository';
import { listTimeStructuresBySchool, saveTimeStructure } from '../api/timeStructureRepository';
import { DailyScheduleEditor } from '../components/DailyScheduleEditor';
import { TimeSlotEditor } from '../components/TimeSlotEditor';
import {
  getWeekdayOptions,
} from '../constants/timeStructureOptions';
import {
  createDefaultTimeStructureValues,
  createDraftDailySchedule,
} from '../helpers/defaultTimeStructureValues';
import { validateTimeStructureForm } from '../helpers/timeStructureValidation';
import { saveDailyScheduleConfiguration } from '../services/saveDailyScheduleConfiguration';

function buildTimeStructureFormState(currentSchool, selectedTimeStructure = null) {
  if (selectedTimeStructure) {
    return {
      id: selectedTimeStructure.id,
      schoolId: selectedTimeStructure.schoolId,
      name: selectedTimeStructure.name,
      daysPerWeek: selectedTimeStructure.daysPerWeek,
      periodsPerDay: selectedTimeStructure.periodsPerDay,
    };
  }

  return createDefaultTimeStructureValues(currentSchool);
}

function TimeStructureForm({
  currentSchool,
  dailySchedules,
  onSave,
  selectedTimeStructure,
}) {
  const [form, setForm] = useState(() =>
    buildTimeStructureFormState(currentSchool, selectedTimeStructure),
  );
  const [feedback, setFeedback] = useState({ tone: '', message: '' });

  async function handleSubmit(event) {
    event.preventDefault();

    const validationMessage = validateTimeStructureForm(form, dailySchedules);

    if (validationMessage) {
      setFeedback({ tone: 'error', message: validationMessage });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      await onSave(form);
      setFeedback({
        tone: 'success',
        message: 'Time structure saved successfully.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save time structure.',
      });
    }
  }

  return (
    <section className="academic-form-card">
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
            label="Structure name"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Main Weekly Structure"
          />
          <InputField
            label="Days per week"
            type="number"
            min="1"
            max="7"
            value={form.daysPerWeek}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                daysPerWeek: Number(event.target.value) || 1,
              }))
            }
          />
          <InputField
            label="Teaching periods per day"
            type="number"
            min="1"
            max="20"
            value={form.periodsPerDay}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                periodsPerDay: Number(event.target.value) || 1,
              }))
            }
          />
        </div>

        <button type="submit" className="primary-button">
          {form.id ? 'Update time structure' : 'Create time structure'}
        </button>
      </form>
    </section>
  );
}

export function TimeStructurePage() {
  const { currentSchool, currentSchoolId } = useCurrentSchool();
  const schoolId = currentSchoolId || currentSchool.schoolId || '';
  const [timeStructures, setTimeStructures] = useState([]);
  const [selectedTimeStructureId, setSelectedTimeStructureId] = useState('');
  const [dailySchedules, setDailySchedules] = useState([]);
  const [selectedWeekdayKey, setSelectedWeekdayKey] = useState('');
  const [timeSlots, setTimeSlots] = useState([]);
  const [status, setStatus] = useState('loading');
  const [scheduleStatus, setScheduleStatus] = useState('idle');
  const [slotStatus, setSlotStatus] = useState('idle');
  const [error, setError] = useState('');

  const selectedTimeStructure = useMemo(
    () => timeStructures.find((timeStructure) => timeStructure.id === selectedTimeStructureId) || null,
    [selectedTimeStructureId, timeStructures],
  );

  const visibleWeekdays = useMemo(
    () => getWeekdayOptions(selectedTimeStructure?.daysPerWeek || 0),
    [selectedTimeStructure?.daysPerWeek],
  );

  const selectedWeekday = useMemo(
    () =>
      visibleWeekdays.find((weekday) => weekday.key === selectedWeekdayKey) ||
      visibleWeekdays[0] ||
      null,
    [selectedWeekdayKey, visibleWeekdays],
  );

  const selectedDailySchedule = useMemo(() => {
    if (!selectedTimeStructure || !selectedWeekday) {
      return null;
    }

    return (
      dailySchedules.find((dailySchedule) => dailySchedule.weekdayKey === selectedWeekday.key) ||
      createDraftDailySchedule({
        schoolId,
        timeStructureId: selectedTimeStructure.id,
        weekday: selectedWeekday,
      })
    );
  }, [dailySchedules, schoolId, selectedTimeStructure, selectedWeekday]);

  const refreshTimeStructures = useCallback(async () => {
    if (!schoolId) {
      setTimeStructures([]);
      setSelectedTimeStructureId('');
      setDailySchedules([]);
      setTimeSlots([]);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError('');

    try {
      const nextTimeStructures = await listTimeStructuresBySchool(schoolId);
      setTimeStructures(nextTimeStructures);
      setSelectedTimeStructureId((current) => {
        if (current && nextTimeStructures.some((timeStructure) => timeStructure.id === current)) {
          return current;
        }

        return nextTimeStructures[0]?.id || '';
      });
      setStatus('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load time structures.');
      setStatus('error');
    }
  }, [schoolId]);

  const refreshDailySchedules = useCallback(async () => {
    if (!schoolId || !selectedTimeStructureId) {
      setDailySchedules([]);
      setSelectedWeekdayKey('');
      setScheduleStatus('ready');
      return;
    }

    setScheduleStatus('loading');
    setError('');

    try {
      const nextDailySchedules = await listDailySchedulesByTimeStructure({
        schoolId,
        timeStructureId: selectedTimeStructureId,
      });
      setDailySchedules(nextDailySchedules);
      setSelectedWeekdayKey((current) => {
        const availableWeekdays = getWeekdayOptions(selectedTimeStructure?.daysPerWeek || 0);

        if (current && availableWeekdays.some((weekday) => weekday.key === current)) {
          return current;
        }

        return availableWeekdays[0]?.key || '';
      });
      setScheduleStatus('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load daily schedules.');
      setScheduleStatus('error');
    }
  }, [schoolId, selectedTimeStructure?.daysPerWeek, selectedTimeStructureId]);

  const refreshTimeSlots = useCallback(async () => {
    if (!schoolId || !selectedDailySchedule?.id) {
      setTimeSlots([]);
      setSlotStatus('ready');
      return;
    }

    setSlotStatus('loading');
    setError('');

    try {
      const nextTimeSlots = await listTimeSlotsByDailySchedule({
        schoolId,
        dailyScheduleId: selectedDailySchedule.id,
      });
      setTimeSlots(nextTimeSlots);
      setSlotStatus('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load time slots.');
      setSlotStatus('error');
    }
  }, [schoolId, selectedDailySchedule]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshTimeStructures();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshTimeStructures]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshDailySchedules();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshDailySchedules]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshTimeSlots();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshTimeSlots]);

  async function handleSaveTimeStructure(form) {
    const savedTimeStructure = await saveTimeStructure({
      ...form,
      schoolId,
    });
    await refreshTimeStructures();
    setSelectedTimeStructureId(savedTimeStructure.id);
  }

  async function handleSaveDailySchedule(slots) {
    if (!selectedTimeStructure || !selectedDailySchedule || !selectedWeekday) {
      throw new Error('Select a time structure and weekday first.');
    }

    const result = await saveDailyScheduleConfiguration({
      dailySchedule: selectedDailySchedule,
      schoolId,
      slots,
      timeStructure: {
        ...selectedTimeStructure,
        schoolId,
      },
      weekday: selectedWeekday,
    });

    await refreshDailySchedules();
    setTimeSlots(result.timeSlots);
  }

  if (status === 'loading') {
    return <AppLoader label="Loading time structures" />;
  }

  return (
    <AcademicPageShell
      title="Time Structure"
      description="Configure school-scoped weekly timing, variable weekday schedules, and dynamic time slots without hard-coded periods."
      error={error}
      summary={
        <div className="academic-summary__grid">
          <StatusPill tone="success">
            structures: {timeStructures.length}
          </StatusPill>
          <StatusPill tone="info">
            selected: {selectedTimeStructure?.name || 'new draft'}
          </StatusPill>
          {selectedTimeStructure ? (
            <StatusPill tone="neutral">
              {selectedTimeStructure.daysPerWeek} days / {selectedTimeStructure.periodsPerDay} teaching periods
            </StatusPill>
          ) : null}
        </div>
      }
    >
      <div className="academic-page-grid">
        <div className="time-structure-column">
          <TimeStructureForm
            key={`${selectedTimeStructure?.id || 'new'}:${schoolId}:${dailySchedules.length}`}
            currentSchool={{
              ...currentSchool,
              schoolId,
            }}
            dailySchedules={dailySchedules}
            selectedTimeStructure={selectedTimeStructure}
            onSave={handleSaveTimeStructure}
          />

          <section className="academic-list-card">
            <div className="academic-list-card__header">
              <div>
                <p className="auth-card__eyebrow">timeStructures collection</p>
                <h2 className="academic-list-card__title">Saved structures</h2>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedTimeStructureId('')}
              >
                New structure
              </button>
            </div>

            <div className="academic-record-list">
              {timeStructures.length === 0 ? (
                <p className="academic-empty-state">
                  No time structure has been created for this school yet.
                </p>
              ) : (
                timeStructures.map((timeStructure) => (
                  <button
                    key={timeStructure.id}
                    type="button"
                    className={`time-structure-card${
                      selectedTimeStructureId === timeStructure.id
                        ? ' time-structure-card--active'
                        : ''
                    }`}
                    onClick={() => setSelectedTimeStructureId(timeStructure.id)}
                  >
                    <div className="weekday-card__heading">
                      <h3>{timeStructure.name}</h3>
                      <StatusPill
                        tone={
                          selectedTimeStructureId === timeStructure.id ? 'success' : 'neutral'
                        }
                      >
                        {timeStructure.daysPerWeek} days
                      </StatusPill>
                    </div>
                    <p>{timeStructure.periodsPerDay} teaching periods per day</p>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="time-structure-column">
          {selectedTimeStructure ? (
            <>
              <DailyScheduleEditor
                dailySchedules={dailySchedules}
                selectedWeekdayKey={selectedWeekdayKey}
                timeStructure={selectedTimeStructure}
                onSelectWeekday={setSelectedWeekdayKey}
              />

              {scheduleStatus === 'loading' || slotStatus === 'loading' ? (
                <AppLoader label="Loading weekday schedule" />
              ) : selectedDailySchedule && selectedWeekday ? (
                <TimeSlotEditor
                  key={`${selectedDailySchedule.id}:${timeSlots.length}:${selectedWeekday.key}`}
                  dailySchedule={selectedDailySchedule}
                  onSave={handleSaveDailySchedule}
                  schoolId={schoolId}
                  timeSlots={timeSlots}
                  timeStructure={selectedTimeStructure}
                  weekday={selectedWeekday}
                />
              ) : (
                <section className="academic-list-card">
                  <p className="academic-empty-state">
                    Select a weekday to configure its dynamic time slots.
                  </p>
                </section>
              )}
            </>
          ) : (
            <section className="academic-list-card">
              <p className="academic-empty-state">
                Save a time structure first, then configure daily schedules and time slots.
              </p>
            </section>
          )}
        </div>
      </div>
    </AcademicPageShell>
  );
}
