import { saveDailySchedule } from '../api/dailyScheduleRepository';
import { replaceTimeSlotsForDailySchedule } from '../api/timeSlotRepository';
import {
  buildDailyScheduleMetrics,
  validateDailyScheduleContext,
  validateTimeSlots,
} from '../helpers/timeStructureValidation';

export async function saveDailyScheduleConfiguration({
  dailySchedule,
  schoolId,
  slots,
  timeStructure,
  weekday,
}) {
  const contextError = validateDailyScheduleContext({
    schoolId,
    timeStructure,
    weekday,
  });

  if (contextError) {
    throw new Error(contextError);
  }

  const slotError = validateTimeSlots({
    slots,
    timeStructure: {
      ...timeStructure,
      schoolId,
    },
    weekday,
  });

  if (slotError) {
    throw new Error(slotError);
  }

  const metrics = buildDailyScheduleMetrics(slots);
  const savedDailySchedule = await saveDailySchedule({
    id: dailySchedule.id,
    schoolId,
    timeStructureId: timeStructure.id,
    weekdayKey: weekday.key,
    weekdayLabel: weekday.label,
    weekdayOrder: weekday.order,
    ...metrics,
  });

  const savedTimeSlots = await replaceTimeSlotsForDailySchedule({
    dailySchedule: savedDailySchedule,
    schoolId,
    slots,
    timeStructureId: timeStructure.id,
    weekday,
  });

  return {
    dailySchedule: savedDailySchedule,
    timeSlots: savedTimeSlots,
  };
}
