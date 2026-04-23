import { getWeekdayOptions } from '../../time-structure/constants/timeStructureOptions';

const DEFAULT_PLC_HOURS_PER_WEEK = 2;

function buildDefaultPolicyName(school) {
  if (school?.name) {
    return `${school.name} PLC Policy`;
  }

  return 'School PLC Policy';
}

function buildDefaultPlcDays(timeStructure) {
  const visibleWeekdays = getWeekdayOptions(timeStructure?.daysPerWeek || 5);
  const lastWeekday = visibleWeekdays[visibleWeekdays.length - 1];

  return lastWeekday ? [lastWeekday.key] : [];
}

export function createDefaultPlcPolicyValues({ school, timeStructure }) {
  return {
    id: '',
    schoolId: school?.schoolId || '',
    name: buildDefaultPolicyName(school),
    timeStructureId: timeStructure?.id || '',
    plcDays: buildDefaultPlcDays(timeStructure),
    hoursPerWeek: DEFAULT_PLC_HOURS_PER_WEEK,
    isActive: true,
  };
}

export function createDefaultTeacherWorkloadValues({ schoolId, teacher }) {
  return {
    id: teacher?.uid ? `${schoolId}-${teacher.uid}` : '',
    schoolId,
    teacherId: teacher?.uid || '',
    teacherName: teacher?.displayName || '',
    teacherEmail: teacher?.email || '',
    plcEnabled: true,
    plcHoursPerWeekOverride: '',
    plcDayOverrides: [],
  };
}

export { DEFAULT_PLC_HOURS_PER_WEEK };
