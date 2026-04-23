import { getWeekdayByKey } from '../../time-structure/constants/timeStructureOptions';

function normalizeTeacherAssignments(assignedTeachers = []) {
  const uniqueTeachers = new Map();

  assignedTeachers.forEach((teacher) => {
    if (!teacher?.teacherId) {
      return;
    }

    uniqueTeachers.set(teacher.teacherId, {
      id: teacher.teacherId,
      name: teacher.teacherName || 'Teacher',
      employeeCode: teacher.teacherEmployeeCode || '',
    });
  });

  return Array.from(uniqueTeachers.values());
}

function getOwnerName(owner, timetableType) {
  if (timetableType === 'class') {
    return owner?.name || 'Class';
  }

  if (timetableType === 'teacher') {
    return owner?.displayName || owner?.teacherName || owner?.name || 'Teacher';
  }

  return owner?.name || 'Room';
}

function getOwnerCode(owner, timetableType) {
  if (timetableType === 'class' || timetableType === 'room') {
    return owner?.code || '';
  }

  return owner?.employeeCode || owner?.teacherEmployeeCode || '';
}

function createTimetablePayload({
  academicYear,
  owner,
  schoolId,
  term,
  timeStructure,
  timetableType,
}) {
  const ownerId = owner?.id;

  if (!ownerId) {
    throw new Error(`A valid ${timetableType} owner is required before saving a timetable.`);
  }

  return {
    id: buildTimetableId({
      schoolId,
      timetableType,
      ownerId,
      termId: term.id,
      timeStructureId: timeStructure.id,
    }),
    payload: {
      schoolId,
      timetableType,
      ownerId,
      ownerName: getOwnerName(owner, timetableType),
      ownerCode: getOwnerCode(owner, timetableType),
      academicYearId: academicYear.id,
      academicYearLabel: academicYear.label || '',
      termId: term.id,
      termName: term.name || '',
      timeStructureId: timeStructure.id,
      timeStructureName: timeStructure.name || '',
      classId: timetableType === 'class' ? owner.id : '',
      className: timetableType === 'class' ? getOwnerName(owner, timetableType) : '',
      teacherId: timetableType === 'teacher' ? owner.id : '',
      teacherName: timetableType === 'teacher' ? getOwnerName(owner, timetableType) : '',
      classroomId: timetableType === 'room' ? owner.id : '',
      classroomName: timetableType === 'room' ? getOwnerName(owner, timetableType) : '',
      status: 'active',
    },
  };
}

function ensureRequiredValue(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function formatTeacherDisplay(teacherNames = []) {
  return teacherNames.filter(Boolean).join(', ');
}

function buildTeacherTimetablePayloads({
  academicYear,
  schoolId,
  teachers,
  term,
  timeStructure,
}) {
  return teachers.map((teacher) =>
    createTimetablePayload({
      academicYear,
      owner: {
        id: teacher.id,
        displayName: teacher.name,
        employeeCode: teacher.employeeCode,
      },
      schoolId,
      term,
      timeStructure,
      timetableType: 'teacher',
    }),
  );
}

export function buildTimetableId({
  ownerId,
  schoolId,
  termId,
  timeStructureId,
  timetableType,
}) {
  return [schoolId, timetableType, ownerId, termId, timeStructureId].join('-');
}

export function createEntry({
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
}) {
  ensureRequiredValue(schoolId, 'schoolId is required before creating a timetable entry.');
  ensureRequiredValue(academicYear?.id, 'An active academic year is required before creating a timetable entry.');
  ensureRequiredValue(term?.id, 'An active term is required before creating a timetable entry.');
  ensureRequiredValue(timeStructure?.id, 'A time structure is required before creating a timetable entry.');
  ensureRequiredValue(schoolClass?.id, 'Select a class before creating a timetable entry.');
  ensureRequiredValue(classOffering?.id, 'Select a class offering before creating a timetable entry.');
  ensureRequiredValue(section?.id, 'Select a section before creating a timetable entry.');
  ensureRequiredValue(classroom?.id, 'Select a classroom before creating a timetable entry.');
  ensureRequiredValue(slot?.id, 'Select a time slot before creating a timetable entry.');

  if (slot.slotType !== 'teaching') {
    throw new Error('Only teaching time slots can accept timetable entries.');
  }

  const normalizedTeachers = normalizeTeacherAssignments(assignedTeachers);

  if (normalizedTeachers.length === 0) {
    throw new Error('Assign at least one subject teacher to the selected section before scheduling it.');
  }

  const weekday = getWeekdayByKey(slot.weekdayKey);
  const classTimetable = createTimetablePayload({
    academicYear,
    owner: schoolClass,
    schoolId,
    term,
    timeStructure,
    timetableType: 'class',
  });
  const teacherTimetables = buildTeacherTimetablePayloads({
    academicYear,
    schoolId,
    teachers: normalizedTeachers,
    term,
    timeStructure,
  });
  const roomTimetable = createTimetablePayload({
    academicYear,
    owner: classroom,
    schoolId,
    term,
    timeStructure,
    timetableType: 'room',
  });
  const teacherIds = normalizedTeachers.map((teacher) => teacher.id);
  const teacherNames = normalizedTeachers.map((teacher) => teacher.name);

  return {
    entry: {
      id: `${classTimetable.id}-${slot.id}-${section.id}`,
      payload: {
        schoolId,
        timetableId: classTimetable.id,
        academicYearId: academicYear.id,
        academicYearLabel: academicYear.label || '',
        termId: term.id,
        termName: term.name || '',
        timeStructureId: timeStructure.id,
        timeStructureName: timeStructure.name || '',
        dailyScheduleId: slot.dailyScheduleId,
        timeSlotId: slot.id,
        weekdayKey: slot.weekdayKey,
        weekdayLabel: weekday?.label || slot.weekdayKey,
        weekdayOrder: slot.weekdayOrder,
        slotIndex: slot.slotIndex,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotType: slot.slotType,
        classId: schoolClass.id,
        className: schoolClass.name || '',
        classCode: schoolClass.code || '',
        subjectId: classOffering.subjectId,
        subjectName: classOffering.subjectName || '',
        subjectCode: classOffering.subjectCode || '',
        subjectShortName: classOffering.subjectShortName || '',
        subjectType: classOffering.subjectType || 'core',
        learningAreaId: classOffering.learningAreaId || '',
        learningAreaName: classOffering.learningAreaName || '',
        colorToken: classOffering.colorToken || '',
        colorHex: classOffering.colorHex || '',
        classOfferingId: classOffering.id,
        sectionId: section.id,
        sectionName: section.name || '',
        sectionType: section.sectionType || 'full_class',
        teacherIds,
        teacherNames,
        teacherDisplay: formatTeacherDisplay(teacherNames),
        teacherTimetableIds: teacherTimetables.map((timetable) => timetable.id),
        classroomId: classroom.id,
        classroomName: classroom.name || '',
        classroomCode: classroom.code || '',
        roomTimetableId: roomTimetable.id,
        status: 'active',
      },
    },
    timetablePayloads: [classTimetable, roomTimetable, ...teacherTimetables],
  };
}
