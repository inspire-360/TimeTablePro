import dayjs from 'dayjs';
import { listAcademicYearsBySchool } from '../../academic/api/academicYearRepository';
import { listTermsBySchool } from '../../academic/api/termRepository';
import { getActiveTerm } from '../../academic/helpers/getActiveTerm';
import { listMasterDataRecords } from '../../master-data/api/masterDataRepository';
import { listDailySchedulesByTimeStructure } from '../../time-structure/api/dailyScheduleRepository';
import { listTimeSlotsByTimeStructure } from '../../time-structure/api/timeSlotRepository';
import { listTimeStructuresBySchool } from '../../time-structure/api/timeStructureRepository';
import { getWeekdayOptions } from '../../time-structure/constants/timeStructureOptions';
import {
  listTimetableEntriesByClass,
  listTimetableEntriesByTeacher,
} from '../../timetable/api/timetableRepository';
import { exportTimetableCsv } from './timetableCsvExporter';
import { generateTimetablePdf } from './timetablePdfGenerator';

export const EXPORT_DOCUMENT_TYPE_OPTIONS = [
  { value: 'class', label: 'Class Timetable' },
  { value: 'teacher', label: 'Teacher Timetable' },
];

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function sanitizeFilePart(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/gi, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function buildWeekdayModel({ dailySchedules, selectedTimeStructure }) {
  if (dailySchedules.length > 0) {
    return dailySchedules.map((dailySchedule) => ({
      key: dailySchedule.weekdayKey,
      label: dailySchedule.weekdayLabel,
      order: dailySchedule.weekdayOrder,
    }));
  }

  return getWeekdayOptions(selectedTimeStructure?.daysPerWeek || 0);
}

function buildTimeSlotMap(timeSlots = []) {
  const nextMap = new Map();

  timeSlots.forEach((slot) => {
    const weekdaySlots = nextMap.get(slot.weekdayKey) || [];
    nextMap.set(slot.weekdayKey, [...weekdaySlots, slot]);
  });

  return nextMap;
}

function buildSlotRows(weekdays, timeSlotsByWeekday) {
  const rowCount = weekdays.reduce((highest, weekday) => {
    const slots = timeSlotsByWeekday.get(weekday.key) || [];
    return Math.max(highest, slots.length);
  }, 0);

  return Array.from({ length: rowCount }, (_, index) => index + 1);
}

function buildEntriesByTimeSlot(entries = []) {
  const nextMap = new Map();

  entries.forEach((entry) => {
    const currentEntries = nextMap.get(entry.timeSlotId) || [];
    nextMap.set(entry.timeSlotId, [...currentEntries, entry]);
  });

  return nextMap;
}

function getDocumentTypeLabel(documentType) {
  return (
    EXPORT_DOCUMENT_TYPE_OPTIONS.find((option) => option.value === documentType)?.label ||
    'Timetable'
  );
}

export function buildOwnerOptionLabel(owner, documentType) {
  if (!owner) {
    return '';
  }

  if (documentType === 'teacher') {
    return [owner.displayName || owner.name || 'Teacher', owner.employeeCode || '']
      .filter(Boolean)
      .join(' | ');
  }

  return [owner.name || 'Class', owner.gradeLevel || '', owner.roomLabel || '']
    .filter(Boolean)
    .join(' | ');
}

export function buildTimetableCellSubtitle(entry, documentType) {
  if (documentType === 'teacher') {
    return [entry.className, entry.classroomName].filter(Boolean).join(' | ');
  }

  return [
    entry.sectionType === 'subgroup' ? entry.sectionName : '',
    entry.teacherDisplay,
    entry.classroomName,
  ]
    .filter(Boolean)
    .join(' | ');
}

export function getTimetableCellEmptyLabel(documentType) {
  return documentType === 'teacher' ? 'Free' : 'Available';
}

function buildOwnerRecord({ classes, documentType, ownerId, teachers }) {
  return documentType === 'teacher'
    ? teachers.find((teacher) => teacher.id === ownerId) || null
    : classes.find((classRecord) => classRecord.id === ownerId) || null;
}

function buildExportFileName(documentData, extension) {
  const schoolPart = sanitizeFilePart(documentData.school.name || documentData.school.schoolId);
  const typePart = sanitizeFilePart(documentData.documentType);
  const ownerPart = sanitizeFilePart(documentData.owner.name || documentData.owner.displayName);
  const termPart = sanitizeFilePart(documentData.term.name || 'term');

  return [schoolPart, typePart, ownerPart, termPart].filter(Boolean).join('-') + `.${extension}`;
}

export async function loadTimetableExportDependencies({ schoolId }) {
  if (!schoolId) {
    return {
      academicYears: [],
      classes: [],
      teachers: [],
      terms: [],
      timeStructures: [],
    };
  }

  const [academicYears, terms, timeStructures, classes, teachers] = await Promise.all([
    listAcademicYearsBySchool(schoolId),
    listTermsBySchool(schoolId),
    listTimeStructuresBySchool(schoolId),
    listMasterDataRecords({ collectionName: 'classes', schoolId }),
    listMasterDataRecords({ collectionName: 'teachers', schoolId }),
  ]);

  return {
    academicYears,
    classes: classes.filter((record) => record.status === 'active'),
    teachers: teachers.filter((record) => record.status === 'active'),
    terms,
    timeStructures,
  };
}

export async function loadTimetableExportDocument({
  academicYears = [],
  classes = [],
  currentSchoolSettings,
  documentType,
  ownerId,
  school,
  schoolId,
  teachers = [],
  termId,
  terms = [],
  timeStructureId,
  timeStructures = [],
}) {
  if (!schoolId) {
    throw new Error('schoolId is required before exporting a timetable.');
  }

  if (!documentType) {
    throw new Error('Choose a document type before exporting.');
  }

  if (!termId) {
    throw new Error('Choose a term before exporting.');
  }

  if (!timeStructureId) {
    throw new Error('Choose a time structure before exporting.');
  }

  if (!ownerId) {
    throw new Error('Choose a class or teacher before exporting.');
  }

  const selectedTimeStructure =
    timeStructures.find((timeStructure) => timeStructure.id === timeStructureId) || null;
  const selectedTerm = terms.find((term) => term.id === termId) || null;
  const selectedOwner = buildOwnerRecord({
    classes,
    documentType,
    ownerId,
    teachers,
  });

  if (!selectedTimeStructure) {
    throw new Error('The selected time structure could not be found.');
  }

  if (!selectedTerm) {
    throw new Error('The selected term could not be found.');
  }

  if (!selectedOwner) {
    throw new Error('The selected export owner could not be found.');
  }

  const [dailySchedules, timeSlots, entries] = await Promise.all([
    listDailySchedulesByTimeStructure({
      schoolId,
      timeStructureId: selectedTimeStructure.id,
    }),
    listTimeSlotsByTimeStructure({
      schoolId,
      timeStructureId: selectedTimeStructure.id,
    }),
    documentType === 'teacher'
      ? listTimetableEntriesByTeacher({
          schoolId,
          teacherId: ownerId,
          termId: selectedTerm.id,
          timeStructureId: selectedTimeStructure.id,
        })
      : listTimetableEntriesByClass({
          classId: ownerId,
          schoolId,
          termId: selectedTerm.id,
          timeStructureId: selectedTimeStructure.id,
        }),
  ]);

  const weekdays = buildWeekdayModel({
    dailySchedules,
    selectedTimeStructure,
  });
  const timeSlotsByWeekday = buildTimeSlotMap(timeSlots);
  const slotRows = buildSlotRows(weekdays, timeSlotsByWeekday);
  const entriesByTimeSlot = buildEntriesByTimeSlot(entries);
  const { activeAcademicYear } = getActiveTerm({
    academicYears,
    terms,
  });
  const selectedAcademicYear =
    academicYears.find((academicYear) => academicYear.id === selectedTerm.academicYearId) ||
    activeAcademicYear ||
    null;

  return {
    academicYear: selectedAcademicYear,
    createdAtLabel: dayjs().format('DD/MM/YYYY HH:mm'),
    documentLabel: getDocumentTypeLabel(documentType),
    documentTitle: `${getDocumentTypeLabel(documentType)} Export`,
    documentType,
    entries,
    entriesByTimeSlot,
    owner: {
      id: selectedOwner.id,
      label: buildOwnerOptionLabel(selectedOwner, documentType),
      name: selectedOwner.name || selectedOwner.displayName || '',
    },
    school: {
      affiliation: school?.affiliation || '',
      logoUrl: school?.logoUrl || '',
      name: school?.name || schoolId,
      schoolId,
    },
    schoolSettings: currentSchoolSettings || {
      schoolId,
      signatures: [],
    },
    slotRows,
    term: selectedTerm,
    timeSlots,
    timeSlotsByWeekday,
    timeStructure: selectedTimeStructure,
    weekdays,
  };
}

export async function exportTimetableDocument({
  documentData,
  format,
  previewElement,
}) {
  if (!documentData) {
    throw new Error('No timetable document is available to export.');
  }

  if (format === 'pdf') {
    if (!previewElement) {
      throw new Error('PDF export requires a rendered preview.');
    }

    await generateTimetablePdf({
      fileName: buildExportFileName(documentData, 'pdf'),
      sourceElement: previewElement,
    });
    return;
  }

  if (format === 'csv') {
    exportTimetableCsv({
      documentData,
      fileName: buildExportFileName(documentData, 'csv'),
    });
    return;
  }

  throw new Error('Unsupported export format.');
}

export function getRecommendedExportType(profileRole) {
  return profileRole === 'teacher' ? 'teacher' : 'class';
}

export function findMatchingTeacherRecord(profile, teachers = []) {
  const normalizedEmail = normalizeEmail(profile?.email);
  const normalizedDisplayName = normalizeName(profile?.displayName);

  if (normalizedEmail) {
    const emailMatch = teachers.find(
      (teacher) => normalizeEmail(teacher.email) === normalizedEmail,
    );

    if (emailMatch) {
      return emailMatch;
    }
  }

  if (normalizedDisplayName) {
    const nameMatch = teachers.find(
      (teacher) => normalizeName(teacher.displayName) === normalizedDisplayName,
    );

    if (nameMatch) {
      return nameMatch;
    }
  }

  return null;
}
