import {
  getWeekdayByKey,
  getWeekdayOptions,
} from '../../time-structure/constants/timeStructureOptions';

const HOURS_STEP = 0.25;
const MINUTES_PER_HOUR = 60;
const MIN_ASSIGNMENT_MINUTES = 15;
const MAX_PLC_HOURS_PER_WEEK = 20;

export function normalizePlcDayKeys(dayKeys = []) {
  const uniqueKeys = new Set(
    (Array.isArray(dayKeys) ? dayKeys : []).filter((dayKey) => getWeekdayByKey(dayKey)),
  );

  return Array.from(uniqueKeys).sort((left, right) => {
    const leftWeekday = getWeekdayByKey(left);
    const rightWeekday = getWeekdayByKey(right);

    return (leftWeekday?.order || 0) - (rightWeekday?.order || 0);
  });
}

export function parseHoursPerWeek(value, { allowBlank = false } = {}) {
  const rawValue =
    value === null || value === undefined ? '' : String(value).trim();

  if (!rawValue) {
    return {
      error: allowBlank ? '' : 'PLC hours per week is required.',
      value: null,
    };
  }

  const hoursPerWeek = Number(rawValue);

  if (!Number.isFinite(hoursPerWeek)) {
    return {
      error: 'PLC hours per week must be a valid number.',
      value: null,
    };
  }

  if (hoursPerWeek <= 0 || hoursPerWeek > MAX_PLC_HOURS_PER_WEEK) {
    return {
      error: 'PLC hours per week must be greater than 0 and at most 20.',
      value: null,
    };
  }

  const normalizedStepCount = Math.round(hoursPerWeek / HOURS_STEP);

  if (Math.abs(hoursPerWeek - normalizedStepCount * HOURS_STEP) > 0.00001) {
    return {
      error: 'PLC hours per week must use 0.25-hour increments.',
      value: null,
    };
  }

  return {
    error: '',
    value: normalizedStepCount * HOURS_STEP,
  };
}

function validatePlcConfiguration({ dayKeys, hoursPerWeek, timeStructure }) {
  const normalizedDays = normalizePlcDayKeys(dayKeys);

  if (normalizedDays.length === 0) {
    return 'Select at least one PLC day.';
  }

  const parsedHours = parseHoursPerWeek(hoursPerWeek);

  if (parsedHours.error) {
    return parsedHours.error;
  }

  if (timeStructure?.daysPerWeek) {
    const allowedWeekdays = new Set(
      getWeekdayOptions(timeStructure.daysPerWeek).map((weekday) => weekday.key),
    );
    const invalidDay = normalizedDays.find((dayKey) => !allowedWeekdays.has(dayKey));

    if (invalidDay) {
      return `${getWeekdayByKey(invalidDay)?.label || invalidDay} is outside the selected time structure.`;
    }
  }

  if (parsedHours.value * MINUTES_PER_HOUR < normalizedDays.length * MIN_ASSIGNMENT_MINUTES) {
    return 'PLC hours per week must provide at least 15 minutes for each selected PLC day.';
  }

  return '';
}

export function resolveTeacherPlcConfiguration({
  plcPolicy,
  teacherWorkloadPolicy = null,
}) {
  const normalizedPolicyDays = normalizePlcDayKeys(plcPolicy?.plcDays || []);
  const normalizedOverrideDays = normalizePlcDayKeys(
    teacherWorkloadPolicy?.plcDayOverrides || [],
  );
  const hasDayOverride = normalizedOverrideDays.length > 0;
  const rawOverrideHours = teacherWorkloadPolicy?.plcHoursPerWeekOverride;
  const hasHoursOverride =
    rawOverrideHours !== null &&
    rawOverrideHours !== undefined &&
    String(rawOverrideHours).trim() !== '';
  const effectiveHoursPerWeek = hasHoursOverride
    ? Number(rawOverrideHours)
    : Number(plcPolicy?.hoursPerWeek) || 0;

  return {
    effectiveDays: hasDayOverride ? normalizedOverrideDays : normalizedPolicyDays,
    effectiveHoursPerWeek,
    hasTeacherOverride:
      hasDayOverride || hasHoursOverride || teacherWorkloadPolicy?.plcEnabled === false,
    plcEnabled: teacherWorkloadPolicy ? Boolean(teacherWorkloadPolicy.plcEnabled) : true,
    source:
      hasDayOverride || hasHoursOverride || teacherWorkloadPolicy?.plcEnabled === false
        ? 'teacher_override'
        : 'policy',
  };
}

export function validatePlcPolicyForm({ form, timeStructure }) {
  if (!form.schoolId?.trim()) {
    return 'schoolId is required.';
  }

  if (!form.name?.trim()) {
    return 'Policy name is required.';
  }

  if (!form.timeStructureId) {
    return 'Select a time structure before saving the PLC policy.';
  }

  if (!timeStructure) {
    return 'The selected time structure could not be found.';
  }

  return validatePlcConfiguration({
    dayKeys: form.plcDays,
    hoursPerWeek: form.hoursPerWeek,
    timeStructure,
  });
}

export function validateTeacherWorkloadForm({
  form,
  plcPolicy,
  timeStructure,
}) {
  if (!form.schoolId?.trim()) {
    return 'schoolId is required.';
  }

  if (!plcPolicy) {
    return 'Set an active PLC policy before configuring teacher overrides.';
  }

  if (!form.teacherId?.trim()) {
    return 'Select a teacher before saving workload settings.';
  }

  if (!form.teacherName?.trim()) {
    return 'Teacher name is required.';
  }

  if (!form.plcEnabled) {
    return '';
  }

  const parsedOverrideHours = parseHoursPerWeek(form.plcHoursPerWeekOverride, {
    allowBlank: true,
  });

  if (parsedOverrideHours.error) {
    return parsedOverrideHours.error;
  }

  const resolvedConfig = resolveTeacherPlcConfiguration({
    plcPolicy,
    teacherWorkloadPolicy: {
      ...form,
      plcHoursPerWeekOverride:
        parsedOverrideHours.value === null ? '' : parsedOverrideHours.value,
    },
  });

  return validatePlcConfiguration({
    dayKeys: resolvedConfig.effectiveDays,
    hoursPerWeek: resolvedConfig.effectiveHoursPerWeek,
    timeStructure,
  });
}

export function validatePlcScheduleReadiness({
  dailySchedules,
  plcDays,
  timeSlots,
}) {
  const scheduleByWeekday = new Map(
    (dailySchedules || []).map((dailySchedule) => [dailySchedule.weekdayKey, dailySchedule]),
  );

  for (const dayKey of normalizePlcDayKeys(plcDays)) {
    const weekday = getWeekdayByKey(dayKey);
    const dailySchedule = scheduleByWeekday.get(dayKey);

    if (!dailySchedule) {
      return `${weekday?.label || dayKey} does not have a daily schedule yet.`;
    }

    const hasTeachingSlot = (timeSlots || []).some(
      (timeSlot) =>
        timeSlot.dailyScheduleId === dailySchedule.id && timeSlot.slotType === 'teaching',
    );

    if (!hasTeachingSlot) {
      return `${weekday?.label || dayKey} must have at least one teaching slot before PLC can be generated.`;
    }
  }

  return '';
}

export { HOURS_STEP, MIN_ASSIGNMENT_MINUTES };
