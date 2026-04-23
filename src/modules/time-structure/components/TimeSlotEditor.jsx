import { useMemo, useState } from 'react';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { InputField } from '../../../shared/ui/InputField';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { SLOT_TYPE_OPTIONS } from '../constants/timeStructureOptions';
import {
  createEmptyTimeSlot,
  createInitialTimeSlotList,
} from '../helpers/defaultTimeStructureValues';
import { buildDailyScheduleMetrics } from '../helpers/timeStructureValidation';

function buildInitialState({ dailySchedule, schoolId, timeSlots, timeStructure, weekday }) {
  if (timeSlots.length > 0) {
    return timeSlots.map((timeSlot, index) => ({
      ...timeSlot,
      slotIndex: index + 1,
    }));
  }

  return createInitialTimeSlotList({
    dailyScheduleId: dailySchedule.id,
    schoolId,
    timeStructureId: timeStructure.id,
    weekday,
  });
}

export function TimeSlotEditor({
  dailySchedule,
  onSave,
  schoolId,
  timeSlots,
  timeStructure,
  weekday,
}) {
  const [slots, setSlots] = useState(() =>
    buildInitialState({
      dailySchedule,
      schoolId,
      timeSlots,
      timeStructure,
      weekday,
    }),
  );
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const metrics = useMemo(() => buildDailyScheduleMetrics(slots), [slots]);

  function updateSlot(slotIndex, field, value) {
    setSlots((current) =>
      current.map((slot, index) =>
        index === slotIndex
          ? {
              ...slot,
              [field]: value,
              schoolId,
              timeStructureId: timeStructure.id,
              dailyScheduleId: dailySchedule.id,
              weekdayKey: weekday.key,
              weekdayOrder: weekday.order,
            }
          : slot,
      ),
    );
  }

  function addSlot() {
    setSlots((current) => [
      ...current,
      {
        ...createEmptyTimeSlot({
          dailyScheduleId: dailySchedule.id,
          schoolId,
          timeStructureId: timeStructure.id,
          weekday,
        }),
        slotIndex: current.length + 1,
      },
    ]);
  }

  function removeSlot(slotIndex) {
    setSlots((current) => {
      const nextSlots = current.filter((_, index) => index !== slotIndex);

      if (nextSlots.length === 0) {
        return createInitialTimeSlotList({
          dailyScheduleId: dailySchedule.id,
          schoolId,
          timeStructureId: timeStructure.id,
          weekday,
        });
      }

      return nextSlots.map((slot, index) => ({
        ...slot,
        slotIndex: index + 1,
      }));
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setFeedback({ tone: '', message: '' });
      await onSave(slots);
      setFeedback({
        tone: 'success',
        message: 'Daily schedule saved successfully.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to save time slots.',
      });
    }
  }

  return (
    <section className="academic-list-card">
      <div className="academic-list-card__header">
        <div>
          <p className="auth-card__eyebrow">timeSlots collection</p>
          <h2 className="academic-list-card__title">{weekday.label} slot editor</h2>
        </div>
        <div className="time-slot-summary">
          <StatusPill tone="info">teaching: {metrics.teachingSlotCount}</StatusPill>
          <StatusPill tone="neutral">slots: {metrics.slotCount}</StatusPill>
        </div>
      </div>

      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      <form className="academic-form" onSubmit={handleSubmit}>
        <div className="time-slot-list">
          {slots.map((slot, index) => (
            <article key={slot.id || `${weekday.key}-${index}`} className="time-slot-row">
              <div className="time-slot-row__index">
                <StatusPill tone="neutral">#{index + 1}</StatusPill>
              </div>

              <div className="time-slot-row__fields">
                <InputField
                  label="Start"
                  type="time"
                  value={slot.startTime}
                  onChange={(event) => updateSlot(index, 'startTime', event.target.value)}
                />
                <InputField
                  label="End"
                  type="time"
                  value={slot.endTime}
                  onChange={(event) => updateSlot(index, 'endTime', event.target.value)}
                />
                <SelectField
                  label="Slot type"
                  value={slot.slotType}
                  onChange={(event) => updateSlot(index, 'slotType', event.target.value)}
                >
                  {SLOT_TYPE_OPTIONS.map((slotType) => (
                    <option key={slotType.value} value={slotType.value}>
                      {slotType.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => removeSlot(index)}
              >
                Remove
              </button>
            </article>
          ))}
        </div>

        <div className="time-slot-actions">
          <button type="button" className="secondary-button" onClick={addSlot}>
            Add slot
          </button>
          <button type="submit" className="primary-button">
            Save weekday schedule
          </button>
        </div>
      </form>
    </section>
  );
}
