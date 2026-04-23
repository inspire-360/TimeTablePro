import { getWeekdayOptions } from '../constants/timeStructureOptions';

function buildDraftName(school) {
  if (school?.name) {
    return `${school.name} Main Week`;
  }

  if (school?.shortName) {
    return `${school.shortName} Main Week`;
  }

  return 'Main Weekly Structure';
}

export function createDefaultTimeStructureValues(school) {
  return {
    id: '',
    schoolId: school?.schoolId || '',
    name: buildDraftName(school),
    daysPerWeek: 5,
    periodsPerDay: 7,
  };
}

export function createDraftDailySchedule({ schoolId, timeStructureId, weekday }) {
  return {
    id: `${timeStructureId}-${weekday.key}`,
    schoolId,
    timeStructureId,
    weekdayKey: weekday.key,
    weekdayLabel: weekday.label,
    weekdayOrder: weekday.order,
    slotCount: 0,
    teachingSlotCount: 0,
    createdAt: null,
    updatedAt: null,
  };
}

export function createEmptyTimeSlot({
  dailyScheduleId,
  schoolId,
  timeStructureId,
  weekday,
}) {
  return {
    id: '',
    schoolId,
    timeStructureId,
    dailyScheduleId,
    weekdayKey: weekday.key,
    weekdayOrder: weekday.order,
    slotIndex: 1,
    startTime: '',
    endTime: '',
    slotType: 'teaching',
  };
}

export function createInitialTimeSlotList(context) {
  return [createEmptyTimeSlot(context)];
}

export function buildWeekdayDrafts(daysPerWeek) {
  return getWeekdayOptions(daysPerWeek).map((weekday) => ({
    weekdayKey: weekday.key,
    weekdayLabel: weekday.label,
    weekdayOrder: weekday.order,
  }));
}
