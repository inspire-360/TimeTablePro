import { getWeekdayByKey } from '../../time-structure/constants/timeStructureOptions';
import {
  MIN_ASSIGNMENT_MINUTES,
  normalizePlcDayKeys,
  parseHoursPerWeek,
  resolveTeacherPlcConfiguration,
  validatePlcScheduleReadiness,
} from './plcValidation';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * 60;

function parseTimeToMinutes(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return NaN;
  }

  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMinutes) {
  const safeMinutes = Math.max(0, Math.min(totalMinutes, MINUTES_PER_DAY - 1));
  const hours = String(Math.floor(safeMinutes / 60)).padStart(2, '0');
  const minutes = String(safeMinutes % 60).padStart(2, '0');

  return `${hours}:${minutes}`;
}

function distributeDurationMinutes(totalMinutes, dayCount) {
  if (dayCount <= 0) {
    return [];
  }

  const totalSlices = totalMinutes / MIN_ASSIGNMENT_MINUTES;
  const baseSlices = Math.floor(totalSlices / dayCount);
  const remainderSlices = totalSlices % dayCount;

  return Array.from({ length: dayCount }, (_, index) => {
    const extraSlices = index < remainderSlices ? 1 : 0;
    return (baseSlices + extraSlices) * MIN_ASSIGNMENT_MINUTES;
  });
}

function buildTeacherIdentity(teacher) {
  return {
    teacherEmail: teacher?.teacherEmail || teacher?.email || '',
    teacherId: teacher?.teacherId || teacher?.uid || '',
    teacherName: teacher?.teacherName || teacher?.displayName || '',
  };
}

export function autoCreatePlcSlots({
  dailySchedules = [],
  plcPolicy,
  teacher,
  teacherWorkloadPolicy = null,
  timeSlots = [],
}) {
  if (!plcPolicy?.id) {
    throw new Error('An active PLC policy is required.');
  }

  const { teacherEmail, teacherId, teacherName } = buildTeacherIdentity(teacher);

  if (!teacherId) {
    throw new Error('Teacher identity is required to generate PLC blocks.');
  }

  const resolvedConfig = resolveTeacherPlcConfiguration({
    plcPolicy,
    teacherWorkloadPolicy,
  });

  if (!resolvedConfig.plcEnabled) {
    return [];
  }

  const normalizedDays = normalizePlcDayKeys(resolvedConfig.effectiveDays);
  const parsedHours = parseHoursPerWeek(resolvedConfig.effectiveHoursPerWeek);

  if (parsedHours.error) {
    throw new Error(parsedHours.error);
  }

  const readinessError = validatePlcScheduleReadiness({
    dailySchedules,
    plcDays: normalizedDays,
    timeSlots,
  });

  if (readinessError) {
    throw new Error(readinessError);
  }

  const dailyScheduleByWeekday = new Map(
    dailySchedules.map((dailySchedule) => [dailySchedule.weekdayKey, dailySchedule]),
  );
  const totalMinutes = parsedHours.value * MINUTES_PER_HOUR;
  const durationByDay = distributeDurationMinutes(totalMinutes, normalizedDays.length);

  return normalizedDays.map((dayKey, index) => {
    const weekday = getWeekdayByKey(dayKey);
    const dailySchedule = dailyScheduleByWeekday.get(dayKey);
    const dailyTimeSlots = timeSlots
      .filter((timeSlot) => timeSlot.dailyScheduleId === dailySchedule.id)
      .sort((left, right) => left.slotIndex - right.slotIndex);
    const teachingSlots = dailyTimeSlots.filter((timeSlot) => timeSlot.slotType === 'teaching');
    const lastTeachingSlot = teachingSlots[teachingSlots.length - 1];
    const startMinutes = parseTimeToMinutes(lastTeachingSlot.endTime);
    const durationMinutes = durationByDay[index];
    const endMinutes = startMinutes + durationMinutes;

    if (endMinutes > MINUTES_PER_DAY) {
      throw new Error(
        `${weekday?.label || dayKey} PLC block extends past midnight. Reduce PLC hours or choose fewer PLC days.`,
      );
    }

    return {
      id: `${plcPolicy.schoolId}-${teacherId}-${plcPolicy.id}-${dayKey}`,
      schoolId: plcPolicy.schoolId,
      teacherId,
      teacherName,
      teacherEmail,
      plcPolicyId: plcPolicy.id,
      teacherWorkloadPolicyId: teacherWorkloadPolicy?.id || '',
      timeStructureId: plcPolicy.timeStructureId,
      dailyScheduleId: dailySchedule.id,
      weekdayKey: dayKey,
      weekdayLabel: weekday?.label || dayKey,
      weekdayOrder: weekday?.order || dailySchedule.weekdayOrder || index + 1,
      startTime: formatMinutesToTime(startMinutes),
      endTime: formatMinutesToTime(endMinutes),
      durationMinutes,
      blocksTeacherTime: true,
      visibleInStudentTimetable: false,
      source: resolvedConfig.source,
    };
  });
}
