import { SLOT_TYPE_OPTIONS, getWeekdayOptions } from '../constants/timeStructureOptions';

const MIN_DAYS_PER_WEEK = 1;
const MAX_DAYS_PER_WEEK = 7;
const MIN_PERIODS_PER_DAY = 1;
const MAX_PERIODS_PER_DAY = 20;
const MAX_SLOTS_PER_DAY = 24;

const validSlotTypes = SLOT_TYPE_OPTIONS.map((option) => option.value);

function parseTimeToMinutes(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return NaN;
  }

  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function buildDailyScheduleMetrics(timeSlots) {
  return {
    slotCount: timeSlots.length,
    teachingSlotCount: timeSlots.filter((slot) => slot.slotType === 'teaching').length,
  };
}

export function validateTimeStructureForm(form, dailySchedules = []) {
  if (!form.schoolId.trim()) {
    return 'schoolId is required.';
  }

  if (!form.name.trim()) {
    return 'Structure name is required.';
  }

  if (!Number.isInteger(Number(form.daysPerWeek))) {
    return 'Days per week must be a whole number.';
  }

  if (Number(form.daysPerWeek) < MIN_DAYS_PER_WEEK || Number(form.daysPerWeek) > MAX_DAYS_PER_WEEK) {
    return 'Days per week must be between 1 and 7.';
  }

  if (!Number.isInteger(Number(form.periodsPerDay))) {
    return 'Periods per day must be a whole number.';
  }

  if (
    Number(form.periodsPerDay) < MIN_PERIODS_PER_DAY ||
    Number(form.periodsPerDay) > MAX_PERIODS_PER_DAY
  ) {
    return 'Periods per day must be between 1 and 20.';
  }

  const highestConfiguredWeekday = dailySchedules.reduce(
    (highest, dailySchedule) => Math.max(highest, dailySchedule.weekdayOrder || 0),
    0,
  );

  if (highestConfiguredWeekday > Number(form.daysPerWeek)) {
    return 'Reduce existing weekday schedules before lowering days per week.';
  }

  const highestTeachingCount = dailySchedules.reduce(
    (highest, dailySchedule) =>
      Math.max(highest, dailySchedule.teachingSlotCount || 0),
    0,
  );

  if (highestTeachingCount > Number(form.periodsPerDay)) {
    return 'Configured teaching slots already exceed this periods-per-day value.';
  }

  return '';
}

export function validateDailyScheduleContext({ schoolId, timeStructure, weekday }) {
  if (!schoolId.trim()) {
    return 'schoolId is required.';
  }

  if (!timeStructure?.id) {
    return 'Save the time structure before editing daily schedules.';
  }

  if (!weekday) {
    return 'Select a weekday before editing slots.';
  }

  const visibleWeekdays = getWeekdayOptions(timeStructure.daysPerWeek);
  const weekdayAllowed = visibleWeekdays.some((visibleWeekday) => visibleWeekday.key === weekday.key);

  if (!weekdayAllowed) {
    return 'The selected weekday is outside the configured days-per-week range.';
  }

  return '';
}

export function validateTimeSlots({ slots, timeStructure, weekday }) {
  const contextError = validateDailyScheduleContext({
    schoolId: timeStructure?.schoolId || '',
    timeStructure,
    weekday,
  });

  if (contextError) {
    return contextError;
  }

  if (!Array.isArray(slots) || slots.length === 0) {
    return 'Add at least one time slot for this weekday.';
  }

  if (slots.length > MAX_SLOTS_PER_DAY) {
    return 'A daily schedule may contain at most 24 slots.';
  }

  let previousEndMinutes = null;
  let teachingSlotCount = 0;

  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const rowLabel = `Slot ${index + 1}`;

    if (!slot.startTime || !slot.endTime) {
      return `${rowLabel} requires both start and end times.`;
    }

    if (!validSlotTypes.includes(slot.slotType)) {
      return `${rowLabel} has an invalid slot type.`;
    }

    const startMinutes = parseTimeToMinutes(slot.startTime);
    const endMinutes = parseTimeToMinutes(slot.endTime);

    if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) {
      return `${rowLabel} has an invalid time format.`;
    }

    if (startMinutes >= endMinutes) {
      return `${rowLabel} must end after it starts.`;
    }

    if (previousEndMinutes !== null && startMinutes < previousEndMinutes) {
      return `${rowLabel} overlaps with the previous slot or is out of order.`;
    }

    if (slot.slotType === 'teaching') {
      teachingSlotCount += 1;
    }

    previousEndMinutes = endMinutes;
  }

  if (teachingSlotCount > Number(timeStructure.periodsPerDay)) {
    return 'Teaching slots exceed the configured periods-per-day limit.';
  }

  return '';
}
