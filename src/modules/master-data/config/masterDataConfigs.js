import {
  DEFAULT_LEARNING_AREA_COLOR_TOKEN,
  LEARNING_AREA_COLOR_OPTIONS,
  getLearningAreaColor,
} from '../constants/learningAreaColors';
import {
  ACTIVITY_CATEGORY_OPTIONS,
  GRADE_LEVEL_OPTIONS,
  STATUS_OPTIONS,
  SUBJECT_TYPE_OPTIONS,
} from '../constants/masterDataOptions';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeCode(value) {
  return normalizeText(value).toUpperCase();
}

function findRecordById(records = [], recordId = '') {
  return records.find((record) => record.id === recordId) || null;
}

function buildName(title, firstName, lastName) {
  return [normalizeText(title), normalizeText(firstName), normalizeText(lastName)]
    .filter(Boolean)
    .join(' ');
}

function buildSummaryBadges(records = [], extraBadges = []) {
  const activeCount = records.filter((record) => record.status === 'active').length;

  return [
    { tone: 'info', label: `Records: ${records.length}` },
    { tone: 'neutral', label: `Active: ${activeCount}` },
    ...extraBadges,
  ];
}

function getOptionLabel(options = [], value = '') {
  return options.find((option) => option.value === value)?.label || value || 'Not set';
}

function buildTeacherOptionLabel(teacher) {
  return [teacher.displayName || teacher.name || 'Teacher', teacher.employeeCode || '']
    .filter(Boolean)
    .join(' | ');
}

function buildClassOptionLabel(classRecord) {
  return [classRecord.name || 'Class', classRecord.gradeLevel || '', classRecord.roomLabel || '']
    .filter(Boolean)
    .join(' | ');
}

function validateRequiredFields(form, fieldEntries) {
  const missingField = fieldEntries.find(([fieldName]) => !normalizeText(form[fieldName]));

  if (!missingField) {
    return '';
  }

  return `${missingField[1]} is required.`;
}

function validateOptionalPositiveInteger(value, label) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return `${label} must be a whole number greater than 0.`;
  }

  return '';
}

const baseFields = [
  {
    name: 'schoolId',
    label: 'School ID',
    type: 'text',
    readOnly: true,
  },
];

const statusField = {
  name: 'status',
  label: 'Status',
  type: 'select',
  options: STATUS_OPTIONS,
};

export const MASTER_DATA_ENTITY_CONFIGS = {
  learningAreas: {
    entityKey: 'learningAreas',
    collectionName: 'learningAreas',
    collectionLabel: 'learningAreas collection',
    route: '/app/master-data/learning-areas',
    navLabel: 'Learning Areas',
    singularLabel: 'Learning area',
    title: 'Learning Areas',
    description:
      'Manage school-scoped learning areas and the shared color system used by subjects.',
    schema: [
      { name: 'schoolId', type: 'string', required: true },
      { name: 'code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { name: 'colorToken', type: 'string', required: true },
      { name: 'colorHex', type: 'string', required: true },
      { name: 'sortOrder', type: 'number', required: true },
      { name: 'status', type: 'string', required: true },
    ],
    dependencies: [],
    fields: [
      ...baseFields,
      {
        name: 'code',
        label: 'Learning area code',
        type: 'text',
        placeholder: 'SCI',
      },
      {
        name: 'name',
        label: 'Learning area name',
        type: 'text',
        placeholder: 'Science',
      },
      {
        name: 'sortOrder',
        label: 'Sort order',
        type: 'number',
        min: '0',
        step: '1',
      },
      statusField,
      {
        name: 'colorToken',
        label: 'Color system',
        type: 'palette',
        fullWidth: true,
        options: LEARNING_AREA_COLOR_OPTIONS,
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        fullWidth: true,
        rows: 4,
        placeholder: 'Optional notes for curriculum grouping or reporting.',
      },
    ],
    buildInitialValues({ schoolId, record }) {
      const color = getLearningAreaColor(record?.colorToken || DEFAULT_LEARNING_AREA_COLOR_TOKEN);

      return {
        id: record?.id || '',
        schoolId,
        code: record?.code || '',
        name: record?.name || '',
        description: record?.description || '',
        colorToken: color.value,
        colorHex: color.hex,
        sortOrder: String(record?.sortOrder ?? 0),
        status: record?.status || 'active',
      };
    },
    validate(form) {
      const requiredError = validateRequiredFields(form, [
        ['schoolId', 'School ID'],
        ['code', 'Learning area code'],
        ['name', 'Learning area name'],
      ]);

      if (requiredError) {
        return requiredError;
      }

      if (!Number.isInteger(Number(form.sortOrder)) || Number(form.sortOrder) < 0) {
        return 'Sort order must be a whole number greater than or equal to 0.';
      }

      return '';
    },
    toPayload({ form }) {
      const color = getLearningAreaColor(form.colorToken);

      return {
        schoolId: normalizeText(form.schoolId),
        code: normalizeCode(form.code),
        name: normalizeText(form.name),
        description: normalizeText(form.description),
        colorToken: color.value,
        colorHex: color.hex,
        sortOrder: Number(form.sortOrder) || 0,
        status: form.status,
      };
    },
    buildRecordSummary(record) {
      return {
        title: record.name || 'Untitled learning area',
        subtitle: [record.code || '', `Sort ${record.sortOrder ?? 0}`]
          .filter(Boolean)
          .join(' | '),
        lines: [record.description || `Color token: ${record.colorToken || 'not set'}`],
        badges: [
          { tone: record.status === 'active' ? 'success' : 'neutral', label: record.status || 'active' },
        ],
        colorHex: record.colorHex || getLearningAreaColor(record.colorToken).hex,
      };
    },
    buildSummaryBadges({ records }) {
      return buildSummaryBadges(records, [
        { tone: 'success', label: `Colors: ${records.length > 0 ? 'synced' : 'palette ready'}` },
      ]);
    },
  },
  subjects: {
    entityKey: 'subjects',
    collectionName: 'subjects',
    collectionLabel: 'subjects collection',
    route: '/app/master-data/subjects',
    navLabel: 'Subjects',
    singularLabel: 'Subject',
    title: 'Subjects',
    description:
      'Manage school-scoped subjects with learning-area colors and core or elective classification.',
    schema: [
      { name: 'schoolId', type: 'string', required: true },
      { name: 'code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'shortName', type: 'string', required: false },
      { name: 'learningAreaId', type: 'string', required: true },
      { name: 'learningAreaName', type: 'string', required: true },
      { name: 'subjectType', type: 'string', required: true },
      { name: 'colorToken', type: 'string', required: true },
      { name: 'colorHex', type: 'string', required: true },
      { name: 'status', type: 'string', required: true },
    ],
    dependencies: ['learningAreas'],
    fields: [
      ...baseFields,
      {
        name: 'code',
        label: 'Subject code',
        type: 'text',
        placeholder: 'SCI101',
      },
      {
        name: 'name',
        label: 'Subject name',
        type: 'text',
        placeholder: 'Integrated Science',
      },
      {
        name: 'shortName',
        label: 'Short name',
        type: 'text',
        placeholder: 'Science',
      },
      {
        name: 'learningAreaId',
        label: 'Learning area',
        type: 'select',
        getOptions: ({ dependencies }) =>
          (dependencies.learningAreas || []).map((learningArea) => ({
            value: learningArea.id,
            label: [learningArea.code, learningArea.name].filter(Boolean).join(' | '),
          })),
        placeholder: 'Select learning area',
      },
      {
        name: 'subjectType',
        label: 'Subject type',
        type: 'select',
        options: SUBJECT_TYPE_OPTIONS,
      },
      statusField,
    ],
    getDependencyNotice({ dependencies }) {
      if ((dependencies.learningAreas || []).length === 0) {
        return 'Create at least one learning area first so subjects can inherit the area color system.';
      }

      return '';
    },
    buildInitialValues({ schoolId, record }) {
      return {
        id: record?.id || '',
        schoolId,
        code: record?.code || '',
        name: record?.name || '',
        shortName: record?.shortName || '',
        learningAreaId: record?.learningAreaId || '',
        subjectType: record?.subjectType || 'core',
        status: record?.status || 'active',
      };
    },
    validate(form, { dependencies }) {
      const requiredError = validateRequiredFields(form, [
        ['schoolId', 'School ID'],
        ['code', 'Subject code'],
        ['name', 'Subject name'],
        ['learningAreaId', 'Learning area'],
      ]);

      if (requiredError) {
        return requiredError;
      }

      if (!findRecordById(dependencies.learningAreas, form.learningAreaId)) {
        return 'Choose a valid learning area.';
      }

      return '';
    },
    toPayload({ dependencies, form }) {
      const learningArea = findRecordById(dependencies.learningAreas, form.learningAreaId);

      if (!learningArea) {
        throw new Error('Choose a learning area before saving the subject.');
      }

      return {
        schoolId: normalizeText(form.schoolId),
        code: normalizeCode(form.code),
        name: normalizeText(form.name),
        shortName: normalizeText(form.shortName),
        learningAreaId: learningArea.id,
        learningAreaName: learningArea.name || '',
        subjectType: form.subjectType,
        colorToken: learningArea.colorToken || DEFAULT_LEARNING_AREA_COLOR_TOKEN,
        colorHex:
          learningArea.colorHex ||
          getLearningAreaColor(learningArea.colorToken).hex,
        status: form.status,
      };
    },
    buildRecordSummary(record) {
      return {
        title: record.name || 'Untitled subject',
        subtitle: [record.code || '', record.learningAreaName || 'No learning area']
          .filter(Boolean)
          .join(' | '),
        lines: [
          [record.shortName || '', getOptionLabel(SUBJECT_TYPE_OPTIONS, record.subjectType)]
            .filter(Boolean)
            .join(' | '),
        ],
        badges: [
          { tone: 'info', label: getOptionLabel(SUBJECT_TYPE_OPTIONS, record.subjectType) },
          { tone: record.status === 'active' ? 'success' : 'neutral', label: record.status || 'active' },
        ],
        colorHex: record.colorHex || getLearningAreaColor(record.colorToken).hex,
      };
    },
    buildSummaryBadges({ records, dependencies }) {
      const coreCount = records.filter((record) => record.subjectType === 'core').length;
      const electiveCount = records.filter((record) => record.subjectType === 'elective').length;

      return buildSummaryBadges(records, [
        { tone: 'info', label: `Learning areas: ${(dependencies.learningAreas || []).length}` },
        { tone: 'neutral', label: `Core: ${coreCount}` },
        { tone: 'neutral', label: `Elective: ${electiveCount}` },
      ]);
    },
  },
  teachers: {
    entityKey: 'teachers',
    collectionName: 'teachers',
    collectionLabel: 'teachers collection',
    route: '/app/master-data/teachers',
    navLabel: 'Teachers',
    singularLabel: 'Teacher',
    title: 'Teachers',
    description:
      'Manage school-scoped teacher master data for staffing, homeroom assignment, and future timetable ownership.',
    schema: [
      { name: 'schoolId', type: 'string', required: true },
      { name: 'employeeCode', type: 'string', required: true },
      { name: 'title', type: 'string', required: false },
      { name: 'firstName', type: 'string', required: true },
      { name: 'lastName', type: 'string', required: true },
      { name: 'displayName', type: 'string', required: true },
      { name: 'email', type: 'string', required: false },
      { name: 'phone', type: 'string', required: false },
      { name: 'status', type: 'string', required: true },
    ],
    dependencies: [],
    fields: [
      ...baseFields,
      {
        name: 'employeeCode',
        label: 'Employee code',
        type: 'text',
        placeholder: 'T-001',
      },
      {
        name: 'title',
        label: 'Title',
        type: 'text',
        placeholder: 'ครู',
      },
      {
        name: 'firstName',
        label: 'First name',
        type: 'text',
        placeholder: 'Somsri',
      },
      {
        name: 'lastName',
        label: 'Last name',
        type: 'text',
        placeholder: 'Phasuk',
      },
      {
        name: 'email',
        label: 'Email',
        type: 'email',
        placeholder: 'teacher@school.ac.th',
      },
      {
        name: 'phone',
        label: 'Phone',
        type: 'tel',
        placeholder: '08x-xxx-xxxx',
      },
      statusField,
    ],
    buildInitialValues({ schoolId, record }) {
      return {
        id: record?.id || '',
        schoolId,
        employeeCode: record?.employeeCode || '',
        title: record?.title || '',
        firstName: record?.firstName || '',
        lastName: record?.lastName || '',
        email: record?.email || '',
        phone: record?.phone || '',
        status: record?.status || 'active',
      };
    },
    validate(form) {
      const requiredError = validateRequiredFields(form, [
        ['schoolId', 'School ID'],
        ['employeeCode', 'Employee code'],
        ['firstName', 'First name'],
        ['lastName', 'Last name'],
      ]);

      if (requiredError) {
        return requiredError;
      }

      return '';
    },
    toPayload({ form }) {
      return {
        schoolId: normalizeText(form.schoolId),
        employeeCode: normalizeCode(form.employeeCode),
        title: normalizeText(form.title),
        firstName: normalizeText(form.firstName),
        lastName: normalizeText(form.lastName),
        displayName: buildName(form.title, form.firstName, form.lastName),
        email: normalizeText(form.email),
        phone: normalizeText(form.phone),
        status: form.status,
      };
    },
    buildRecordSummary(record) {
      return {
        title: record.displayName || 'Unnamed teacher',
        subtitle: [record.employeeCode || '', record.email || 'No email']
          .filter(Boolean)
          .join(' | '),
        lines: [record.phone || 'No phone number'],
        badges: [
          { tone: record.status === 'active' ? 'success' : 'neutral', label: record.status || 'active' },
        ],
      };
    },
    buildSummaryBadges({ records }) {
      return buildSummaryBadges(records);
    },
  },
  students: {
    entityKey: 'students',
    collectionName: 'students',
    collectionLabel: 'students collection',
    route: '/app/master-data/students',
    navLabel: 'Students',
    singularLabel: 'Student',
    title: 'Students',
    description:
      'Manage school-scoped student master data with class placement ready for future timetable and reporting features.',
    schema: [
      { name: 'schoolId', type: 'string', required: true },
      { name: 'studentCode', type: 'string', required: true },
      { name: 'title', type: 'string', required: false },
      { name: 'firstName', type: 'string', required: true },
      { name: 'lastName', type: 'string', required: true },
      { name: 'displayName', type: 'string', required: true },
      { name: 'classId', type: 'string', required: true },
      { name: 'className', type: 'string', required: true },
      { name: 'studentNumber', type: 'number', required: false },
      { name: 'status', type: 'string', required: true },
    ],
    dependencies: ['classes'],
    fields: [
      ...baseFields,
      {
        name: 'studentCode',
        label: 'Student code',
        type: 'text',
        placeholder: 'ST-001',
      },
      {
        name: 'title',
        label: 'Title',
        type: 'text',
        placeholder: 'เด็กหญิง',
      },
      {
        name: 'firstName',
        label: 'First name',
        type: 'text',
        placeholder: 'Nida',
      },
      {
        name: 'lastName',
        label: 'Last name',
        type: 'text',
        placeholder: 'Sukjai',
      },
      {
        name: 'classId',
        label: 'Class',
        type: 'select',
        getOptions: ({ dependencies }) =>
          (dependencies.classes || []).map((classRecord) => ({
            value: classRecord.id,
            label: buildClassOptionLabel(classRecord),
          })),
        placeholder: 'Select class',
      },
      {
        name: 'studentNumber',
        label: 'Student number',
        type: 'number',
        min: '1',
        step: '1',
      },
      statusField,
    ],
    getDependencyNotice({ dependencies }) {
      if ((dependencies.classes || []).length === 0) {
        return 'Create at least one class first so students can be placed into homerooms.';
      }

      return '';
    },
    buildInitialValues({ schoolId, record }) {
      return {
        id: record?.id || '',
        schoolId,
        studentCode: record?.studentCode || '',
        title: record?.title || '',
        firstName: record?.firstName || '',
        lastName: record?.lastName || '',
        classId: record?.classId || '',
        studentNumber:
          record?.studentNumber === null || record?.studentNumber === undefined
            ? ''
            : String(record.studentNumber),
        status: record?.status || 'active',
      };
    },
    validate(form, { dependencies }) {
      const requiredError = validateRequiredFields(form, [
        ['schoolId', 'School ID'],
        ['studentCode', 'Student code'],
        ['firstName', 'First name'],
        ['lastName', 'Last name'],
        ['classId', 'Class'],
      ]);

      if (requiredError) {
        return requiredError;
      }

      if (!findRecordById(dependencies.classes, form.classId)) {
        return 'Choose a valid class.';
      }

      const studentNumberError = validateOptionalPositiveInteger(
        form.studentNumber,
        'Student number',
      );

      if (studentNumberError) {
        return studentNumberError;
      }

      return '';
    },
    toPayload({ dependencies, form }) {
      const classRecord = findRecordById(dependencies.classes, form.classId);

      if (!classRecord) {
        throw new Error('Choose a class before saving the student.');
      }

      const normalizedStudentNumber = normalizeText(form.studentNumber);

      return {
        schoolId: normalizeText(form.schoolId),
        studentCode: normalizeCode(form.studentCode),
        title: normalizeText(form.title),
        firstName: normalizeText(form.firstName),
        lastName: normalizeText(form.lastName),
        displayName: buildName(form.title, form.firstName, form.lastName),
        classId: classRecord.id,
        className: classRecord.name || '',
        studentNumber: normalizedStudentNumber ? Number(normalizedStudentNumber) : null,
        status: form.status,
      };
    },
    buildRecordSummary(record) {
      return {
        title: record.displayName || 'Unnamed student',
        subtitle: [record.studentCode || '', record.className || 'No class']
          .filter(Boolean)
          .join(' | '),
        lines: [
          record.studentNumber ? `Student no. ${record.studentNumber}` : 'Student number not set',
        ],
        badges: [
          { tone: record.status === 'active' ? 'success' : 'neutral', label: record.status || 'active' },
        ],
      };
    },
    buildSummaryBadges({ records, dependencies }) {
      return buildSummaryBadges(records, [
        { tone: 'info', label: `Classes: ${(dependencies.classes || []).length}` },
      ]);
    },
  },
  classes: {
    entityKey: 'classes',
    collectionName: 'classes',
    collectionLabel: 'classes collection',
    route: '/app/master-data/classes',
    navLabel: 'Classes',
    singularLabel: 'Class',
    title: 'Classes',
    description:
      'Manage school-scoped class groups with Thai grade-level options and optional homeroom teacher assignment.',
    schema: [
      { name: 'schoolId', type: 'string', required: true },
      { name: 'code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'gradeLevel', type: 'string', required: true },
      { name: 'roomLabel', type: 'string', required: false },
      { name: 'homeRoomTeacherId', type: 'string', required: false },
      { name: 'homeRoomTeacherName', type: 'string', required: false },
      { name: 'status', type: 'string', required: true },
    ],
    dependencies: ['teachers'],
    fields: [
      ...baseFields,
      {
        name: 'code',
        label: 'Class code',
        type: 'text',
        placeholder: 'P1-1',
      },
      {
        name: 'name',
        label: 'Class name',
        type: 'text',
        placeholder: 'P1/1',
      },
      {
        name: 'gradeLevel',
        label: 'Grade level',
        type: 'select',
        options: GRADE_LEVEL_OPTIONS,
      },
      {
        name: 'roomLabel',
        label: 'Room label',
        type: 'text',
        placeholder: '1',
      },
      {
        name: 'homeRoomTeacherId',
        label: 'Homeroom teacher',
        type: 'select',
        getOptions: ({ dependencies }) =>
          (dependencies.teachers || []).map((teacher) => ({
            value: teacher.id,
            label: buildTeacherOptionLabel(teacher),
          })),
        placeholder: 'Optional homeroom teacher',
      },
      statusField,
    ],
    buildInitialValues({ schoolId, record }) {
      return {
        id: record?.id || '',
        schoolId,
        code: record?.code || '',
        name: record?.name || '',
        gradeLevel: record?.gradeLevel || '',
        roomLabel: record?.roomLabel || '',
        homeRoomTeacherId: record?.homeRoomTeacherId || '',
        status: record?.status || 'active',
      };
    },
    validate(form, { dependencies }) {
      const requiredError = validateRequiredFields(form, [
        ['schoolId', 'School ID'],
        ['code', 'Class code'],
        ['name', 'Class name'],
        ['gradeLevel', 'Grade level'],
      ]);

      if (requiredError) {
        return requiredError;
      }

      if (
        normalizeText(form.homeRoomTeacherId) &&
        !findRecordById(dependencies.teachers, form.homeRoomTeacherId)
      ) {
        return 'Choose a valid homeroom teacher.';
      }

      return '';
    },
    toPayload({ dependencies, form }) {
      const teacher = normalizeText(form.homeRoomTeacherId)
        ? findRecordById(dependencies.teachers, form.homeRoomTeacherId)
        : null;

      return {
        schoolId: normalizeText(form.schoolId),
        code: normalizeCode(form.code),
        name: normalizeText(form.name),
        gradeLevel: form.gradeLevel,
        roomLabel: normalizeText(form.roomLabel),
        homeRoomTeacherId: teacher?.id || '',
        homeRoomTeacherName: teacher?.displayName || '',
        status: form.status,
      };
    },
    buildRecordSummary(record) {
      return {
        title: record.name || 'Unnamed class',
        subtitle: [record.code || '', getOptionLabel(GRADE_LEVEL_OPTIONS, record.gradeLevel)]
          .filter(Boolean)
          .join(' | '),
        lines: [
          [record.roomLabel ? `Room ${record.roomLabel}` : '', record.homeRoomTeacherName || 'No homeroom teacher']
            .filter(Boolean)
            .join(' | '),
        ],
        badges: [
          { tone: record.status === 'active' ? 'success' : 'neutral', label: record.status || 'active' },
        ],
      };
    },
    buildSummaryBadges({ records, dependencies }) {
      return buildSummaryBadges(records, [
        { tone: 'info', label: `Teachers: ${(dependencies.teachers || []).length}` },
      ]);
    },
  },
  classrooms: {
    entityKey: 'classrooms',
    collectionName: 'classrooms',
    collectionLabel: 'classrooms collection',
    route: '/app/master-data/classrooms',
    navLabel: 'Classrooms',
    singularLabel: 'Classroom',
    title: 'Classrooms',
    description:
      'Manage school-scoped physical classrooms with location and capacity details for future scheduling use.',
    schema: [
      { name: 'schoolId', type: 'string', required: true },
      { name: 'code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'building', type: 'string', required: false },
      { name: 'floor', type: 'string', required: false },
      { name: 'capacity', type: 'number', required: false },
      { name: 'status', type: 'string', required: true },
    ],
    dependencies: [],
    fields: [
      ...baseFields,
      {
        name: 'code',
        label: 'Classroom code',
        type: 'text',
        placeholder: 'LAB-1',
      },
      {
        name: 'name',
        label: 'Classroom name',
        type: 'text',
        placeholder: 'Science Lab 1',
      },
      {
        name: 'building',
        label: 'Building',
        type: 'text',
        placeholder: 'Building A',
      },
      {
        name: 'floor',
        label: 'Floor',
        type: 'text',
        placeholder: '2',
      },
      {
        name: 'capacity',
        label: 'Capacity',
        type: 'number',
        min: '1',
        step: '1',
      },
      statusField,
    ],
    buildInitialValues({ schoolId, record }) {
      return {
        id: record?.id || '',
        schoolId,
        code: record?.code || '',
        name: record?.name || '',
        building: record?.building || '',
        floor: record?.floor || '',
        capacity:
          record?.capacity === null || record?.capacity === undefined
            ? ''
            : String(record.capacity),
        status: record?.status || 'active',
      };
    },
    validate(form) {
      const requiredError = validateRequiredFields(form, [
        ['schoolId', 'School ID'],
        ['code', 'Classroom code'],
        ['name', 'Classroom name'],
      ]);

      if (requiredError) {
        return requiredError;
      }

      const capacityError = validateOptionalPositiveInteger(form.capacity, 'Capacity');

      if (capacityError) {
        return capacityError;
      }

      return '';
    },
    toPayload({ form }) {
      const normalizedCapacity = normalizeText(form.capacity);

      return {
        schoolId: normalizeText(form.schoolId),
        code: normalizeCode(form.code),
        name: normalizeText(form.name),
        building: normalizeText(form.building),
        floor: normalizeText(form.floor),
        capacity: normalizedCapacity ? Number(normalizedCapacity) : null,
        status: form.status,
      };
    },
    buildRecordSummary(record) {
      return {
        title: record.name || 'Unnamed classroom',
        subtitle: [record.code || '', record.building || 'No building']
          .filter(Boolean)
          .join(' | '),
        lines: [
          [record.floor ? `Floor ${record.floor}` : '', record.capacity ? `Capacity ${record.capacity}` : 'Capacity not set']
            .filter(Boolean)
            .join(' | '),
        ],
        badges: [
          { tone: record.status === 'active' ? 'success' : 'neutral', label: record.status || 'active' },
        ],
      };
    },
    buildSummaryBadges({ records }) {
      return buildSummaryBadges(records);
    },
  },
  activities: {
    entityKey: 'activities',
    collectionName: 'activities',
    collectionLabel: 'activities collection',
    route: '/app/master-data/activities',
    navLabel: 'Activities',
    singularLabel: 'Activity',
    title: 'Activities',
    description:
      'Manage school-scoped activities such as clubs, assemblies, sports, and enrichment programs.',
    schema: [
      { name: 'schoolId', type: 'string', required: true },
      { name: 'code', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'category', type: 'string', required: true },
      { name: 'description', type: 'string', required: false },
      { name: 'status', type: 'string', required: true },
    ],
    dependencies: [],
    fields: [
      ...baseFields,
      {
        name: 'code',
        label: 'Activity code',
        type: 'text',
        placeholder: 'CLUB-ART',
      },
      {
        name: 'name',
        label: 'Activity name',
        type: 'text',
        placeholder: 'Art Club',
      },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: ACTIVITY_CATEGORY_OPTIONS,
      },
      statusField,
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        fullWidth: true,
        rows: 4,
        placeholder: 'Optional notes for advisors or future scheduling rules.',
      },
    ],
    buildInitialValues({ schoolId, record }) {
      return {
        id: record?.id || '',
        schoolId,
        code: record?.code || '',
        name: record?.name || '',
        category: record?.category || ACTIVITY_CATEGORY_OPTIONS[0].value,
        description: record?.description || '',
        status: record?.status || 'active',
      };
    },
    validate(form) {
      return validateRequiredFields(form, [
        ['schoolId', 'School ID'],
        ['code', 'Activity code'],
        ['name', 'Activity name'],
        ['category', 'Category'],
      ]);
    },
    toPayload({ form }) {
      return {
        schoolId: normalizeText(form.schoolId),
        code: normalizeCode(form.code),
        name: normalizeText(form.name),
        category: form.category,
        description: normalizeText(form.description),
        status: form.status,
      };
    },
    buildRecordSummary(record) {
      return {
        title: record.name || 'Unnamed activity',
        subtitle: [record.code || '', getOptionLabel(ACTIVITY_CATEGORY_OPTIONS, record.category)]
          .filter(Boolean)
          .join(' | '),
        lines: [record.description || 'No additional description'],
        badges: [
          { tone: 'info', label: getOptionLabel(ACTIVITY_CATEGORY_OPTIONS, record.category) },
          { tone: record.status === 'active' ? 'success' : 'neutral', label: record.status || 'active' },
        ],
      };
    },
    buildSummaryBadges({ records }) {
      return buildSummaryBadges(records);
    },
  },
};

export const MASTER_DATA_SCHEMAS = Object.fromEntries(
  Object.entries(MASTER_DATA_ENTITY_CONFIGS).map(([entityKey, config]) => [
    entityKey,
    config.schema,
  ]),
);

export const MASTER_DATA_NAV_ITEMS = Object.values(MASTER_DATA_ENTITY_CONFIGS).map((config) => ({
  entityKey: config.entityKey,
  label: config.navLabel,
  route: config.route,
}));

export function getMasterDataConfig(entityKey) {
  return MASTER_DATA_ENTITY_CONFIGS[entityKey] || null;
}
