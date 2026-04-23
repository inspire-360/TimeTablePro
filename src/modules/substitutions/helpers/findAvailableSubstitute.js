function normalizeText(value) {
  return String(value || '').trim();
}

function buildTeacherEntryMap(timetableEntries = []) {
  const teacherEntryMap = new Map();

  timetableEntries.forEach((entry) => {
    entry.teacherIds.forEach((teacherId) => {
      const entries = teacherEntryMap.get(teacherId) || [];
      teacherEntryMap.set(teacherId, [...entries, entry]);
    });
  });

  return teacherEntryMap;
}

function getTeacherLoad(entries = [], weekdayKey) {
  return {
    dailyLessons: entries.filter((entry) => entry.weekdayKey === weekdayKey).length,
    weeklyLessons: entries.length,
  };
}

function teacherIsAbsentOnDate({ teacherAbsences = [], targetDate, teacherId }) {
  return teacherAbsences.some(
    (absence) =>
      absence.teacherId === teacherId &&
      absence.date === targetDate &&
      absence.status !== 'cancelled',
  );
}

function teacherHasTimetableConflict({ affectedEntry, teacherEntries = [] }) {
  return teacherEntries.some((entry) => entry.timeSlotId === affectedEntry.timeSlotId);
}

function teacherHasSubstitutionConflict({
  currentSubstitutionId = '',
  substitutions = [],
  targetDate,
  teacherId,
  timeSlotId,
}) {
  return substitutions.some(
    (substitution) =>
      substitution.id !== currentSubstitutionId &&
      substitution.substituteTeacherId === teacherId &&
      substitution.date === targetDate &&
      substitution.timeSlotId === timeSlotId &&
      substitution.status !== 'cancelled',
  );
}

function buildSubjectMatchScore({ affectedEntry, teacherEntries = [] }) {
  return teacherEntries.reduce((score, entry) => {
    if (entry.subjectId === affectedEntry.subjectId) {
      return score + 2;
    }

    if (
      normalizeText(entry.learningAreaId) &&
      normalizeText(entry.learningAreaId) === normalizeText(affectedEntry.learningAreaId)
    ) {
      return score + 1;
    }

    return score;
  }, 0);
}

function buildCandidateSummary({
  affectedEntry,
  subjectMatchScore,
  teacherEntries,
  teacherName,
}) {
  const load = getTeacherLoad(teacherEntries, affectedEntry.weekdayKey);
  const reasons = [];

  if (subjectMatchScore >= 2) {
    reasons.push('Teaches the same subject');
  } else if (subjectMatchScore === 1) {
    reasons.push('Teaches the same learning area');
  }

  if (load.dailyLessons === 0) {
    reasons.push('No other lessons on this day');
  } else {
    reasons.push(`${load.dailyLessons} lesson(s) on ${affectedEntry.weekdayLabel}`);
  }

  return {
    dailyLessons: load.dailyLessons,
    reasonSummary: reasons.join(' | '),
    teacherName,
    weeklyLessons: load.weeklyLessons,
  };
}

export function getAffectedLessonsForAbsence({
  absence,
  timetableEntries = [],
}) {
  if (!absence?.teacherId || !absence?.weekdayKey) {
    return [];
  }

  return [...timetableEntries]
    .filter(
      (entry) =>
        entry.teacherIds.includes(absence.teacherId) &&
        entry.weekdayKey === absence.weekdayKey &&
        entry.status !== 'inactive',
    )
    .sort((left, right) => left.slotIndex - right.slotIndex);
}

export function findAvailableSubstitute({
  affectedEntry,
  currentSubstitution = null,
  substitutions = [],
  targetDate,
  teacherAbsences = [],
  teachers = [],
  timetableEntries = [],
}) {
  const teacherEntryMap = buildTeacherEntryMap(timetableEntries);
  const candidates = [];
  const blocked = [];

  teachers
    .filter((teacher) => teacher.status === 'active')
    .forEach((teacher) => {
      if (teacher.id === affectedEntry.teacherIds[0] || affectedEntry.teacherIds.includes(teacher.id)) {
        blocked.push({
          reason: 'Already assigned to the lesson',
          teacherId: teacher.id,
          teacherName: teacher.displayName || 'Teacher',
        });
        return;
      }

      if (
        teacherIsAbsentOnDate({
          targetDate,
          teacherAbsences,
          teacherId: teacher.id,
        })
      ) {
        blocked.push({
          reason: 'Absent on the selected date',
          teacherId: teacher.id,
          teacherName: teacher.displayName || 'Teacher',
        });
        return;
      }

      const teacherEntries = teacherEntryMap.get(teacher.id) || [];

      if (teacherHasTimetableConflict({ affectedEntry, teacherEntries })) {
        blocked.push({
          reason: 'Already teaching in this time slot',
          teacherId: teacher.id,
          teacherName: teacher.displayName || 'Teacher',
        });
        return;
      }

      if (
        teacherHasSubstitutionConflict({
          currentSubstitutionId: currentSubstitution?.id || '',
          substitutions,
          targetDate,
          teacherId: teacher.id,
          timeSlotId: affectedEntry.timeSlotId,
        })
      ) {
        blocked.push({
          reason: 'Already assigned as substitute in this time slot',
          teacherId: teacher.id,
          teacherName: teacher.displayName || 'Teacher',
        });
        return;
      }

      const subjectMatchScore = buildSubjectMatchScore({
        affectedEntry,
        teacherEntries,
      });
      const candidateSummary = buildCandidateSummary({
        affectedEntry,
        subjectMatchScore,
        teacherEntries,
        teacherName: teacher.displayName || 'Teacher',
      });
      const score = subjectMatchScore * 100 - candidateSummary.dailyLessons * 10 - candidateSummary.weeklyLessons;

      candidates.push({
        score,
        subjectMatchScore,
        teacherEmployeeCode: teacher.employeeCode || '',
        teacherId: teacher.id,
        teacherName: teacher.displayName || 'Teacher',
        ...candidateSummary,
      });
    });

  candidates.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }

    return left.teacherName.localeCompare(right.teacherName);
  });

  return {
    blocked,
    blockedCount: blocked.length,
    candidates,
  };
}
