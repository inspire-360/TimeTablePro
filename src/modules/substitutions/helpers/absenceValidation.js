import dayjs from 'dayjs';
import { getActiveTerm } from '../../academic/helpers/getActiveTerm';
import { getWeekdayByKey } from '../../time-structure/constants/timeStructureOptions';

const DAY_INDEX_TO_WEEKDAY_KEY = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function normalizeText(value) {
  return String(value || '').trim();
}

function parseDateValue(dateValue) {
  const parsedDate = dayjs(dateValue);
  return parsedDate.isValid() ? parsedDate : null;
}

function isDateWithinRange(dateValue, startDate, endDate) {
  const parsedDate = parseDateValue(dateValue);
  const parsedStartDate = parseDateValue(startDate);
  const parsedEndDate = parseDateValue(endDate);

  if (!parsedDate || !parsedStartDate || !parsedEndDate) {
    return false;
  }

  return (
    parsedDate.isSame(parsedStartDate, 'day') ||
    parsedDate.isSame(parsedEndDate, 'day') ||
    (parsedDate.isAfter(parsedStartDate, 'day') && parsedDate.isBefore(parsedEndDate, 'day'))
  );
}

export function buildTeacherAbsenceId({ date, schoolId, teacherId, timeStructureId }) {
  return [schoolId, teacherId, date, timeStructureId].join('-');
}

export function getAbsenceWeekday(dateValue) {
  const parsedDate = parseDateValue(dateValue);

  if (!parsedDate) {
    return null;
  }

  const weekdayKey = DAY_INDEX_TO_WEEKDAY_KEY[parsedDate.day()];
  const weekday = getWeekdayByKey(weekdayKey);

  return weekday
    ? {
        key: weekday.key,
        label: weekday.label,
        order: weekday.order,
      }
    : null;
}

export function resolveAbsenceAcademicContext({ academicYears = [], dateValue, terms = [] }) {
  const parsedDate = parseDateValue(dateValue);

  if (!parsedDate) {
    return {
      academicYear: null,
      error: 'Choose a valid absence date.',
      term: null,
      weekday: null,
    };
  }

  const { activeAcademicYear, activeTerm } = getActiveTerm({
    academicYears,
    referenceDate: parsedDate.toDate(),
    terms,
  });
  const weekday = getAbsenceWeekday(dateValue);

  if (!activeAcademicYear || !activeTerm) {
    return {
      academicYear: null,
      error: 'The selected date is outside configured academic years or terms.',
      term: null,
      weekday,
    };
  }

  if (
    !isDateWithinRange(dateValue, activeAcademicYear.startDate, activeAcademicYear.endDate) ||
    !isDateWithinRange(dateValue, activeTerm.startDate, activeTerm.endDate)
  ) {
    return {
      academicYear: activeAcademicYear,
      error: 'The selected date is outside the active academic year or term range.',
      term: activeTerm,
      weekday,
    };
  }

  return {
    academicYear: activeAcademicYear,
    error: '',
    term: activeTerm,
    weekday,
  };
}

export function validateTeacherAbsenceForm({
  academicContext,
  form,
  teacher,
  timeStructure,
}) {
  if (!normalizeText(form.schoolId)) {
    return 'schoolId is required.';
  }

  if (!teacher?.id) {
    return 'Select a teacher before reporting an absence.';
  }

  if (!normalizeText(form.date)) {
    return 'Absence date is required.';
  }

  if (!timeStructure?.id) {
    return 'Select a time structure before saving the absence.';
  }

  if (!normalizeText(form.reason)) {
    return 'Absence reason is required.';
  }

  if (academicContext?.error) {
    return academicContext.error;
  }

  return '';
}

export function buildTeacherAbsencePayload({
  academicContext,
  affectedLessonCount,
  form,
  teacher,
  timeStructure,
}) {
  return {
    schoolId: normalizeText(form.schoolId),
    teacherId: teacher.id,
    teacherName: teacher.displayName || 'Teacher',
    teacherEmployeeCode: teacher.employeeCode || '',
    date: normalizeText(form.date),
    weekdayKey: academicContext.weekday?.key || '',
    weekdayLabel: academicContext.weekday?.label || '',
    weekdayOrder: academicContext.weekday?.order || 1,
    academicYearId: academicContext.academicYear?.id || '',
    academicYearLabel: academicContext.academicYear?.label || '',
    termId: academicContext.term?.id || '',
    termName: academicContext.term?.name || '',
    timeStructureId: timeStructure.id,
    timeStructureName: timeStructure.name || '',
    reason: normalizeText(form.reason),
    notes: normalizeText(form.notes),
    status: form.status || 'reported',
    affectedLessonCount: Number(affectedLessonCount) || 0,
  };
}
