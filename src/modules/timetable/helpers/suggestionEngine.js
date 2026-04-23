import { createEntry } from './createEntry';
import {
  hasConflictErrors,
  validateTimetableEntryConflicts,
} from './conflict';

function buildTeacherEntriesByTeacherId(entries = []) {
  const nextTeacherEntriesById = {};

  entries.forEach((entry) => {
    if (!entry || entry.status === 'inactive') {
      return;
    }

    entry.teacherIds.forEach((teacherId) => {
      if (!teacherId) {
        return;
      }

      const teacherEntries = nextTeacherEntriesById[teacherId] || [];
      nextTeacherEntriesById[teacherId] = [...teacherEntries, entry];
    });
  });

  return nextTeacherEntriesById;
}

function buildTimeSlotEntriesMap(entries = []) {
  const nextEntriesByTimeSlot = new Map();

  entries.forEach((entry) => {
    if (!entry || entry.status === 'inactive' || !entry.timeSlotId) {
      return;
    }

    const existingEntries = nextEntriesByTimeSlot.get(entry.timeSlotId) || [];
    nextEntriesByTimeSlot.set(entry.timeSlotId, [...existingEntries, entry]);
  });

  return nextEntriesByTimeSlot;
}

function countUniqueTeachingSlots(entries = [], weekdayKey = '') {
  const timeSlotIds = new Set();

  entries.forEach((entry) => {
    if (!entry || entry.status === 'inactive' || entry.slotType !== 'teaching') {
      return;
    }

    if (weekdayKey && entry.weekdayKey !== weekdayKey) {
      return;
    }

    if (entry.timeSlotId) {
      timeSlotIds.add(entry.timeSlotId);
    }
  });

  return timeSlotIds.size;
}

function createAvailability(conflicts) {
  const errorCodes = new Set((conflicts.error || []).map((issue) => issue.code));

  return {
    classAvailable:
      !errorCodes.has('class_conflict') &&
      !errorCodes.has('class_conflict_full_class') &&
      !errorCodes.has('class_conflict_subgroup'),
    hasErrors: hasConflictErrors(conflicts),
    infoCount: conflicts.info.length,
    plcAvailable: !errorCodes.has('plc_conflict'),
    roomAvailable: !errorCodes.has('classroom_conflict'),
    teacherAvailable: !errorCodes.has('teacher_conflict'),
    warningCount: conflicts.warning.length,
  };
}

function buildSuggestionReasons({
  availability,
  classDayLoad,
  conflicts,
  sameSubjectDayLoad,
}) {
  const reasons = [];

  if (availability.teacherAvailable) {
    reasons.push('Teachers are free in this slot');
  }

  if (availability.roomAvailable) {
    reasons.push('Room is available');
  }

  if (availability.plcAvailable) {
    reasons.push('No PLC overlap');
  }

  if (availability.classAvailable) {
    reasons.push('Class is available');
  }

  if (sameSubjectDayLoad === 0) {
    reasons.push('Good subject spread for the day');
  } else if (sameSubjectDayLoad > 0) {
    reasons.push('This subject already appears on the same day');
  }

  if (classDayLoad <= 2) {
    reasons.push('Balanced day load for the class');
  }

  if (conflicts.warning[0]?.message) {
    reasons.push(conflicts.warning[0].message);
  }

  return reasons.slice(0, 3);
}

function buildSuggestionLabel({ availability, score }) {
  if (availability.warningCount === 0 && score >= 960) {
    return 'Best match';
  }

  if (availability.warningCount === 0) {
    return 'Strong fit';
  }

  return 'Use with care';
}

function calculateSuggestionScore({
  availability,
  classDayLoad,
  classEntries,
  classOffering,
  sameSubjectDayLoad,
  slot,
  teacherEntriesByTeacherId,
  teacherIds,
}) {
  let score = 1000;
  const maxTeacherDayLoad = teacherIds.reduce((highest, teacherId) => {
    const teacherEntries = teacherEntriesByTeacherId[teacherId] || [];
    return Math.max(highest, countUniqueTeachingSlots(teacherEntries, slot.weekdayKey));
  }, 0);
  const maxTeacherWeeklyLoad = teacherIds.reduce((highest, teacherId) => {
    const teacherEntries = teacherEntriesByTeacherId[teacherId] || [];
    return Math.max(highest, countUniqueTeachingSlots(teacherEntries));
  }, 0);
  const neighboringClassLessons = classEntries.filter(
    (entry) =>
      entry.weekdayKey === slot.weekdayKey &&
      Math.abs(Number(entry.slotIndex) - Number(slot.slotIndex)) === 1,
  ).length;

  score -= availability.warningCount * 95;
  score -= classDayLoad * 24;
  score -= sameSubjectDayLoad * 140;
  score -= maxTeacherDayLoad * 18;
  score -= maxTeacherWeeklyLoad * 5;
  score -= neighboringClassLessons * 10;
  score += Math.max(0, 8 - Number(slot.weekdayOrder || 0)) * 4;

  if (classOffering?.subjectType === 'core') {
    score += Math.max(0, 7 - Number(slot.slotIndex || 0)) * 6;
  } else if (classOffering?.subjectType === 'elective') {
    score += Math.max(0, Number(slot.slotIndex || 0) - 2) * 3;
  }

  return score;
}

function createBlockedSuggestion({ error, slot }) {
  return {
    availability: {
      classAvailable: false,
      hasErrors: true,
      infoCount: 0,
      plcAvailable: false,
      roomAvailable: false,
      teacherAvailable: false,
      warningCount: 0,
    },
    bundle: null,
    conflicts: {
      error: [
        {
          code: 'suggestion_unavailable',
          message: error instanceof Error ? error.message : 'This slot cannot be scheduled.',
        },
      ],
      info: [],
      warning: [],
    },
    id: slot?.id || 'unavailable',
    label: 'Unavailable',
    reasons: [error instanceof Error ? error.message : 'This slot cannot be scheduled.'],
    score: 0,
    slot,
  };
}

export function suggestAvailableSlots({
  academicYear,
  assignedTeachers = [],
  classOffering,
  classroom,
  contextEntries = [],
  schoolClass,
  schoolId,
  section,
  term,
  timeSlots = [],
  timeStructure,
  teacherPlcAssignments = [],
}) {
  const teachingSlots = timeSlots.filter((slot) => slot.slotType === 'teaching');

  if (
    !schoolId ||
    !academicYear?.id ||
    !term?.id ||
    !timeStructure?.id ||
    !schoolClass?.id ||
    !classOffering?.id ||
    !section?.id ||
    !classroom?.id ||
    assignedTeachers.length === 0
  ) {
    return {
      availableCount: 0,
      blockedCount: 0,
      blockedSuggestions: [],
      suggestions: [],
      totalTeachingSlots: teachingSlots.length,
    };
  }

  const classEntries = contextEntries.filter((entry) => entry.classId === schoolClass.id);
  const teacherEntriesByTeacherId = buildTeacherEntriesByTeacherId(contextEntries);
  const entriesByTimeSlot = buildTimeSlotEntriesMap(contextEntries);
  const suggestions = [];
  const blockedSuggestions = [];

  teachingSlots.forEach((slot) => {
    try {
      const bundle = createEntry({
        academicYear,
        assignedTeachers,
        classOffering,
        classroom,
        schoolClass,
        schoolId,
        section,
        slot,
        term,
        timeStructure,
      });
      const entry = {
        id: bundle.entry.id,
        ...bundle.entry.payload,
      };
      const conflicts = validateTimetableEntryConflicts({
        entry,
        teacherEntriesByTeacherId,
        teacherPlcAssignments: teacherPlcAssignments.filter(
          (assignment) =>
            entry.teacherIds.includes(assignment.teacherId) &&
            assignment.timeStructureId === timeStructure.id,
        ),
        timeSlotEntries: entriesByTimeSlot.get(slot.id) || [],
        timeSlots,
      });
      const availability = createAvailability(conflicts);

      if (availability.hasErrors) {
        blockedSuggestions.push({
          availability,
          bundle,
          conflicts,
          id: slot.id,
          label: 'Blocked',
          reasons: buildSuggestionReasons({
            availability,
            classDayLoad: countUniqueTeachingSlots(classEntries, slot.weekdayKey),
            conflicts,
            sameSubjectDayLoad: classEntries.filter(
              (classEntry) =>
                classEntry.subjectId === classOffering.subjectId &&
                classEntry.weekdayKey === slot.weekdayKey,
            ).length,
          }),
          score: 0,
          slot,
          weekdayLabel: entry.weekdayLabel,
        });
        return;
      }

      const classDayLoad = countUniqueTeachingSlots(classEntries, slot.weekdayKey);
      const sameSubjectDayLoad = classEntries.filter(
        (classEntry) =>
          classEntry.subjectId === classOffering.subjectId &&
          classEntry.weekdayKey === slot.weekdayKey,
      ).length;
      const score = calculateSuggestionScore({
        availability,
        classDayLoad,
        classEntries,
        classOffering,
        sameSubjectDayLoad,
        slot,
        teacherEntriesByTeacherId,
        teacherIds: entry.teacherIds,
      });

      suggestions.push({
        availability,
        bundle,
        conflicts,
        id: slot.id,
        label: buildSuggestionLabel({
          availability,
          score,
        }),
        reasons: buildSuggestionReasons({
          availability,
          classDayLoad,
          conflicts,
          sameSubjectDayLoad,
        }),
        score,
        slot,
        weekdayLabel: entry.weekdayLabel,
      });
    } catch (error) {
      blockedSuggestions.push(createBlockedSuggestion({ error, slot }));
    }
  });

  suggestions.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if ((left.slot?.weekdayOrder || 0) !== (right.slot?.weekdayOrder || 0)) {
      return (left.slot?.weekdayOrder || 0) - (right.slot?.weekdayOrder || 0);
    }

    return (left.slot?.slotIndex || 0) - (right.slot?.slotIndex || 0);
  });
  blockedSuggestions.sort((left, right) => {
    if ((left.slot?.weekdayOrder || 0) !== (right.slot?.weekdayOrder || 0)) {
      return (left.slot?.weekdayOrder || 0) - (right.slot?.weekdayOrder || 0);
    }

    return (left.slot?.slotIndex || 0) - (right.slot?.slotIndex || 0);
  });

  return {
    availableCount: suggestions.length,
    blockedCount: blockedSuggestions.length,
    blockedSuggestions,
    suggestions,
    totalTeachingSlots: teachingSlots.length,
  };
}

export function getBestSlotSuggestion(suggestionResult) {
  return suggestionResult?.suggestions?.[0] || null;
}

export function createEmptySuggestionResult() {
  return {
    availableCount: 0,
    blockedCount: 0,
    blockedSuggestions: [],
    suggestions: [],
    totalTeachingSlots: 0,
  };
}
