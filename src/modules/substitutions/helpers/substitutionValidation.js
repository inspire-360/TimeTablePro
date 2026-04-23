function normalizeText(value) {
  return String(value || '').trim();
}

export function buildSubstitutionId({ teacherAbsenceId, timetableEntryId }) {
  return `${teacherAbsenceId}-${timetableEntryId}`;
}

export function validateSubstitutionAssignment({
  absence,
  affectedEntry,
  availability,
  substituteTeacher,
}) {
  if (!absence?.id) {
    return 'Select an absence record before assigning a substitute.';
  }

  if (!affectedEntry?.id) {
    return 'Choose a timetable lesson before assigning a substitute.';
  }

  if (!substituteTeacher?.id) {
    return 'Select an available substitute teacher.';
  }

  if (substituteTeacher.id === absence.teacherId) {
    return 'The absent teacher cannot substitute their own lesson.';
  }

  const isAvailableCandidate =
    availability?.candidates?.some((candidate) => candidate.teacherId === substituteTeacher.id) || false;

  if (!isAvailableCandidate) {
    return 'The selected teacher is no longer available for this lesson.';
  }

  return '';
}

export function buildSubstitutionPayload({
  absence,
  affectedEntry,
  substituteTeacher,
}) {
  return {
    schoolId: absence.schoolId,
    teacherAbsenceId: absence.id,
    timetableEntryId: affectedEntry.id,
    date: absence.date,
    weekdayKey: absence.weekdayKey,
    weekdayLabel: absence.weekdayLabel,
    weekdayOrder: absence.weekdayOrder,
    academicYearId: absence.academicYearId,
    academicYearLabel: absence.academicYearLabel || '',
    termId: absence.termId,
    termName: absence.termName || '',
    timeStructureId: absence.timeStructureId,
    timeStructureName: absence.timeStructureName || '',
    dailyScheduleId: affectedEntry.dailyScheduleId,
    timeSlotId: affectedEntry.timeSlotId,
    absentTeacherId: absence.teacherId,
    absentTeacherName: absence.teacherName,
    substituteTeacherId: substituteTeacher.id,
    substituteTeacherName: substituteTeacher.displayName || 'Teacher',
    substituteTeacherEmployeeCode: substituteTeacher.employeeCode || '',
    classId: affectedEntry.classId,
    className: affectedEntry.className || '',
    subjectId: affectedEntry.subjectId,
    subjectName: affectedEntry.subjectName || '',
    sectionId: affectedEntry.sectionId,
    sectionName: affectedEntry.sectionName || '',
    classroomId: affectedEntry.classroomId,
    classroomName: affectedEntry.classroomName || '',
    startTime: affectedEntry.startTime,
    endTime: affectedEntry.endTime,
    status: 'assigned',
    notes: '',
  };
}

export function buildSubstitutionFormLabel(substituteTeacher) {
  return [
    substituteTeacher.displayName || 'Teacher',
    normalizeText(substituteTeacher.employeeCode),
  ]
    .filter(Boolean)
    .join(' | ');
}
