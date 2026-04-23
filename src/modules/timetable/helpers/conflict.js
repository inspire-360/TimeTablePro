const WARNING_THRESHOLD_RATIO = 0.9;

function parseTimeToMinutes(value) {
  if (!value || typeof value !== 'string') {
    return 0;
  }

  const [hoursText, minutesText] = value.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

function calculateDurationMinutes(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  return Math.max(endMinutes - startMinutes, 0);
}

function formatMinutes(minutes) {
  const safeMinutes = Math.max(Math.round(minutes) || 0, 0);
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function intervalsOverlap(left, right) {
  const leftStart = parseTimeToMinutes(left.startTime);
  const leftEnd = parseTimeToMinutes(left.endTime);
  const rightStart = parseTimeToMinutes(right.startTime);
  const rightEnd = parseTimeToMinutes(right.endTime);

  return leftStart < rightEnd && rightStart < leftEnd;
}

function createIssue({ code, message, ...meta }) {
  return {
    code,
    message,
    ...meta,
  };
}

function appendIssue(result, severity, issue) {
  if (!issue?.message) {
    return result;
  }

  const nextIssues = result[severity];
  const isDuplicate = nextIssues.some(
    (existingIssue) =>
      existingIssue.code === issue.code && existingIssue.message === issue.message,
  );

  if (!isDuplicate) {
    nextIssues.push(issue);
  }

  return result;
}

function mergeValidationResults(target, source) {
  ['error', 'warning', 'info'].forEach((severity) => {
    (source[severity] || []).forEach((issue) => {
      appendIssue(target, severity, issue);
    });
  });

  return target;
}

function createTimeSlotDurationMap(timeSlots = []) {
  return new Map(
    timeSlots
      .filter((timeSlot) => timeSlot.slotType === 'teaching')
      .map((timeSlot) => [
        timeSlot.id,
        calculateDurationMinutes(timeSlot.startTime, timeSlot.endTime),
      ]),
  );
}

function getTimeSlotDurationMinutes(entry, timeSlotDurationMap) {
  return (
    timeSlotDurationMap.get(entry.timeSlotId) ||
    calculateDurationMinutes(entry.startTime, entry.endTime)
  );
}

function sumTeachingCapacityMinutes(timeSlots = [], weekdayKey = '') {
  return timeSlots.reduce((total, timeSlot) => {
    if (timeSlot.slotType !== 'teaching') {
      return total;
    }

    if (weekdayKey && timeSlot.weekdayKey !== weekdayKey) {
      return total;
    }

    return total + calculateDurationMinutes(timeSlot.startTime, timeSlot.endTime);
  }, 0);
}

function getUniqueTeachingMinutes({
  entries = [],
  excludeEntryId = '',
  timeSlotDurationMap,
  weekdayKey = '',
}) {
  const uniqueTimeSlotIds = new Set();
  let totalMinutes = 0;

  entries.forEach((entry) => {
    if (!entry || entry.status === 'inactive' || entry.slotType !== 'teaching') {
      return;
    }

    if (excludeEntryId && entry.id === excludeEntryId) {
      return;
    }

    if (weekdayKey && entry.weekdayKey !== weekdayKey) {
      return;
    }

    if (!entry.timeSlotId || uniqueTimeSlotIds.has(entry.timeSlotId)) {
      return;
    }

    uniqueTimeSlotIds.add(entry.timeSlotId);
    totalMinutes += getTimeSlotDurationMinutes(entry, timeSlotDurationMap);
  });

  return totalMinutes;
}

function getUniqueTeachingSlotIds({
  entries = [],
  excludeEntryId = '',
  weekdayKey = '',
}) {
  const uniqueTimeSlotIds = new Set();

  entries.forEach((entry) => {
    if (!entry || entry.status === 'inactive' || entry.slotType !== 'teaching') {
      return;
    }

    if (excludeEntryId && entry.id === excludeEntryId) {
      return;
    }

    if (weekdayKey && entry.weekdayKey !== weekdayKey) {
      return;
    }

    if (entry.timeSlotId) {
      uniqueTimeSlotIds.add(entry.timeSlotId);
    }
  });

  return uniqueTimeSlotIds;
}

function getPlcMinutes(assignments = [], weekdayKey = '') {
  return assignments.reduce((total, assignment) => {
    if (weekdayKey && assignment.weekdayKey !== weekdayKey) {
      return total;
    }

    return total + (Number(assignment.durationMinutes) || 0);
  }, 0);
}

function formatEntryReference(entry) {
  return [entry.subjectName, entry.className, entry.sectionName].filter(Boolean).join(' | ');
}

function getTeacherName(entry, teacherId) {
  const teacherIndex = entry.teacherIds.findIndex((candidateId) => candidateId === teacherId);

  if (teacherIndex >= 0) {
    return entry.teacherNames[teacherIndex] || 'Teacher';
  }

  return 'Teacher';
}

export function createConflictResult() {
  return {
    error: [],
    warning: [],
    info: [],
  };
}

export function hasConflictErrors(result) {
  return (result?.error || []).length > 0;
}

export function getPrimaryConflictMessage(result) {
  return (
    result?.error?.[0]?.message ||
    result?.warning?.[0]?.message ||
    result?.info?.[0]?.message ||
    ''
  );
}

export function validateClassConflict({ entry, timeSlotEntries = [] }) {
  const result = createConflictResult();
  const relevantEntries = timeSlotEntries.filter(
    (existingEntry) => existingEntry.id !== entry.id && existingEntry.status !== 'inactive',
  );
  const sameClassEntries = relevantEntries.filter(
    (existingEntry) => existingEntry.classId === entry.classId,
  );

  if (entry.sectionType === 'full_class' && sameClassEntries.length > 0) {
    appendIssue(
      result,
      'error',
      createIssue({
        code: 'class_conflict',
        message: 'This class already has a scheduled lesson in the selected time slot.',
      }),
    );
  }

  if (
    entry.sectionType === 'subgroup' &&
    sameClassEntries.some((existingEntry) => existingEntry.sectionType === 'full_class')
  ) {
    appendIssue(
      result,
      'error',
      createIssue({
        code: 'class_conflict_full_class',
        message:
          'A full-class lesson already uses this time slot, so subgroup lessons cannot be added here.',
      }),
    );
  }

  if (
    entry.sectionType === 'subgroup' &&
    sameClassEntries.some((existingEntry) => existingEntry.sectionId === entry.sectionId)
  ) {
    appendIssue(
      result,
      'error',
      createIssue({
        code: 'class_conflict_subgroup',
        message: 'The selected subgroup is already scheduled in this time slot.',
      }),
    );
  }

  return result;
}

export function validateTeacherConflict({ entry, timeSlotEntries = [] }) {
  const result = createConflictResult();

  timeSlotEntries.forEach((existingEntry) => {
    if (existingEntry.id === entry.id || existingEntry.status === 'inactive') {
      return;
    }

    existingEntry.teacherIds.forEach((teacherId) => {
      if (!entry.teacherIds.includes(teacherId)) {
        return;
      }

      appendIssue(
        result,
        'error',
        createIssue({
          code: 'teacher_conflict',
          message: `${getTeacherName(entry, teacherId)} is already scheduled for ${formatEntryReference(existingEntry)} during this slot.`,
          teacherId,
        }),
      );
    });
  });

  return result;
}

export function validateClassroomConflict({ entry, timeSlotEntries = [] }) {
  const result = createConflictResult();
  const roomConflict = timeSlotEntries.find(
    (existingEntry) =>
      existingEntry.id !== entry.id &&
      existingEntry.status !== 'inactive' &&
      existingEntry.classroomId === entry.classroomId,
  );

  if (roomConflict) {
    appendIssue(
      result,
      'error',
      createIssue({
        code: 'classroom_conflict',
        message: `${entry.classroomName || 'Selected room'} is already booked for ${formatEntryReference(roomConflict)} during this slot.`,
        classroomId: entry.classroomId,
      }),
    );
  }

  return result;
}

export function validatePlcConflict({
  entry,
  teacherPlcAssignments = [],
}) {
  const result = createConflictResult();

  entry.teacherIds.forEach((teacherId) => {
    const overlappingPlcAssignment = teacherPlcAssignments.find(
      (assignment) =>
        assignment.teacherId === teacherId &&
        assignment.timeStructureId === entry.timeStructureId &&
        assignment.weekdayKey === entry.weekdayKey &&
        assignment.blocksTeacherTime &&
        intervalsOverlap(entry, assignment),
    );

    if (!overlappingPlcAssignment) {
      return;
    }

    appendIssue(
      result,
      'error',
      createIssue({
        code: 'plc_conflict',
        message: `${getTeacherName(entry, teacherId)} has a PLC block from ${overlappingPlcAssignment.startTime} to ${overlappingPlcAssignment.endTime} on ${overlappingPlcAssignment.weekdayLabel || entry.weekdayLabel}.`,
        teacherId,
      }),
    );
  });

  return result;
}

export function validateMaxHours({
  entry,
  teacherEntriesByTeacherId = {},
  teacherPlcAssignments = [],
  timeSlots = [],
}) {
  const result = createConflictResult();
  const timeSlotDurationMap = createTimeSlotDurationMap(timeSlots);
  const weeklyTeachingCapacityMinutes = sumTeachingCapacityMinutes(timeSlots);
  const dailyTeachingCapacityMinutes = sumTeachingCapacityMinutes(timeSlots, entry.weekdayKey);
  const candidateSlotMinutes = getTimeSlotDurationMinutes(entry, timeSlotDurationMap);

  entry.teacherIds.forEach((teacherId) => {
    const teacherEntries = teacherEntriesByTeacherId[teacherId] || [];
    const teacherPlcBlocks = teacherPlcAssignments.filter(
      (assignment) =>
        assignment.teacherId === teacherId && assignment.timeStructureId === entry.timeStructureId,
    );
    const currentWeeklyTeachingMinutes = getUniqueTeachingMinutes({
      entries: teacherEntries,
      excludeEntryId: entry.id,
      timeSlotDurationMap,
    });
    const currentDailyTeachingMinutes = getUniqueTeachingMinutes({
      entries: teacherEntries,
      excludeEntryId: entry.id,
      timeSlotDurationMap,
      weekdayKey: entry.weekdayKey,
    });
    const currentWeeklyTeachingSlotIds = getUniqueTeachingSlotIds({
      entries: teacherEntries,
      excludeEntryId: entry.id,
    });
    const currentDailyTeachingSlotIds = getUniqueTeachingSlotIds({
      entries: teacherEntries,
      excludeEntryId: entry.id,
      weekdayKey: entry.weekdayKey,
    });
    const projectedWeeklyTeachingMinutes = currentWeeklyTeachingSlotIds.has(entry.timeSlotId)
      ? currentWeeklyTeachingMinutes
      : currentWeeklyTeachingMinutes + candidateSlotMinutes;
    const projectedDailyTeachingMinutes = currentDailyTeachingSlotIds.has(entry.timeSlotId)
      ? currentDailyTeachingMinutes
      : currentDailyTeachingMinutes + candidateSlotMinutes;
    const weeklyPlcMinutes = getPlcMinutes(teacherPlcBlocks);

    if (
      weeklyTeachingCapacityMinutes > 0 &&
      projectedWeeklyTeachingMinutes > weeklyTeachingCapacityMinutes
    ) {
      appendIssue(
        result,
        'error',
        createIssue({
          code: 'max_hours_weekly',
          message: `${getTeacherName(entry, teacherId)} would exceed weekly teaching capacity (${formatMinutes(projectedWeeklyTeachingMinutes)} / ${formatMinutes(weeklyTeachingCapacityMinutes)}).`,
          teacherId,
        }),
      );
    } else if (
      weeklyTeachingCapacityMinutes > 0 &&
      projectedWeeklyTeachingMinutes >= weeklyTeachingCapacityMinutes * WARNING_THRESHOLD_RATIO
    ) {
      appendIssue(
        result,
        'warning',
        createIssue({
          code: 'max_hours_weekly_warning',
          message: `${getTeacherName(entry, teacherId)} is near weekly teaching capacity (${formatMinutes(projectedWeeklyTeachingMinutes)} / ${formatMinutes(weeklyTeachingCapacityMinutes)}).`,
          teacherId,
        }),
      );
    }

    if (
      dailyTeachingCapacityMinutes > 0 &&
      projectedDailyTeachingMinutes > dailyTeachingCapacityMinutes
    ) {
      appendIssue(
        result,
        'error',
        createIssue({
          code: 'max_hours_daily',
          message: `${getTeacherName(entry, teacherId)} would exceed ${entry.weekdayLabel} teaching capacity (${formatMinutes(projectedDailyTeachingMinutes)} / ${formatMinutes(dailyTeachingCapacityMinutes)}).`,
          teacherId,
        }),
      );
    } else if (
      dailyTeachingCapacityMinutes > 0 &&
      projectedDailyTeachingMinutes >= dailyTeachingCapacityMinutes * WARNING_THRESHOLD_RATIO
    ) {
      appendIssue(
        result,
        'warning',
        createIssue({
          code: 'max_hours_daily_warning',
          message: `${getTeacherName(entry, teacherId)} is near ${entry.weekdayLabel} teaching capacity (${formatMinutes(projectedDailyTeachingMinutes)} / ${formatMinutes(dailyTeachingCapacityMinutes)}).`,
          teacherId,
        }),
      );
    }

    appendIssue(
      result,
      'info',
      createIssue({
        code: 'max_hours_info',
        message: `${getTeacherName(entry, teacherId)} projected weekly load: ${formatMinutes(projectedWeeklyTeachingMinutes)} teaching, ${formatMinutes(weeklyPlcMinutes)} PLC.`,
        teacherId,
      }),
    );
  });

  return result;
}

export function validateTimetableEntryConflicts({
  entry,
  teacherEntriesByTeacherId = {},
  teacherPlcAssignments = [],
  timeSlotEntries = [],
  timeSlots = [],
}) {
  const result = createConflictResult();

  mergeValidationResults(result, validateClassConflict({ entry, timeSlotEntries }));
  mergeValidationResults(result, validateTeacherConflict({ entry, timeSlotEntries }));
  mergeValidationResults(result, validateClassroomConflict({ entry, timeSlotEntries }));
  mergeValidationResults(
    result,
    validatePlcConflict({
      entry,
      teacherPlcAssignments,
    }),
  );
  mergeValidationResults(
    result,
    validateMaxHours({
      entry,
      teacherEntriesByTeacherId,
      teacherPlcAssignments,
      timeSlots,
    }),
  );

  if (result.error.length === 0 && result.warning.length === 0) {
    appendIssue(
      result,
      'info',
      createIssue({
        code: 'ready_to_save',
        message: 'No blocking timetable conflicts were found for the selected slot.',
      }),
    );
  }

  return result;
}
