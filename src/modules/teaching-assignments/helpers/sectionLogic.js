export const SECTION_TYPE_OPTIONS = [
  { value: 'full_class', label: 'Full Class' },
  { value: 'subgroup', label: 'Subgroup' },
];

export function buildClassOfferingId({ schoolId, classId, subjectId }) {
  return `${schoolId}-${classId}-${subjectId}`;
}

export function buildFullClassSectionId(classOfferingId) {
  return `${classOfferingId}-full-class`;
}

export function buildCourseAssignmentId({ sectionId, teacherId }) {
  return `${sectionId}-${teacherId}`;
}

export function sortSections(sections = []) {
  return [...sections].sort((left, right) => {
    if (left.sectionType === 'full_class' && right.sectionType !== 'full_class') {
      return -1;
    }

    if (left.sectionType !== 'full_class' && right.sectionType === 'full_class') {
      return 1;
    }

    const leftSortOrder = Number(left.sortOrder) || 0;
    const rightSortOrder = Number(right.sortOrder) || 0;

    if (leftSortOrder !== rightSortOrder) {
      return leftSortOrder - rightSortOrder;
    }

    return String(left.name || '').localeCompare(String(right.name || ''));
  });
}

export function getDefaultFullClassSection(sections = []) {
  return sections.find((section) => section.sectionType === 'full_class') || null;
}

export function buildDefaultFullClassSection({ classOffering }) {
  if (!classOffering?.id) {
    throw new Error('Class offering is required before creating the default full-class section.');
  }

  return {
    id: buildFullClassSectionId(classOffering.id),
    schoolId: classOffering.schoolId,
    classOfferingId: classOffering.id,
    classId: classOffering.classId,
    className: classOffering.className,
    subjectId: classOffering.subjectId,
    subjectName: classOffering.subjectName,
    sectionType: 'full_class',
    code: 'FULL',
    name: 'Full Class',
    subgroupLabel: '',
    sortOrder: 1,
    isDefault: true,
    status: 'active',
  };
}

export function buildNextSubgroupSortOrder(sections = []) {
  const highestSortOrder = sections.reduce(
    (highest, section) => Math.max(highest, Number(section.sortOrder) || 0),
    1,
  );

  return highestSortOrder + 1;
}

export function createSectionDraft(sections = []) {
  return {
    code: '',
    name: '',
    subgroupLabel: '',
    status: 'active',
    sortOrder: String(buildNextSubgroupSortOrder(sections)),
  };
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeCode(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/\s+/g, '-');
}

export function validateSubgroupSectionForm({ form, sections = [] }) {
  if (!normalizeText(form.code)) {
    return 'Section code is required.';
  }

  if (!normalizeText(form.name)) {
    return 'Section name is required.';
  }

  const normalizedSortOrder = Number(form.sortOrder);

  if (!Number.isInteger(normalizedSortOrder) || normalizedSortOrder < 2) {
    return 'Subgroup sort order must be a whole number starting from 2.';
  }

  const normalizedCode = normalizeCode(form.code);
  const duplicateSection = sections.find(
    (section) => normalizeCode(section.code) === normalizedCode,
  );

  if (duplicateSection) {
    return 'Section code must be unique within the selected subject offering.';
  }

  return '';
}

export function buildSubgroupSectionPayload({
  classOffering,
  form,
}) {
  return {
    schoolId: classOffering.schoolId,
    classOfferingId: classOffering.id,
    classId: classOffering.classId,
    className: classOffering.className,
    subjectId: classOffering.subjectId,
    subjectName: classOffering.subjectName,
    sectionType: 'subgroup',
    code: normalizeCode(form.code),
    name: normalizeText(form.name),
    subgroupLabel: normalizeText(form.subgroupLabel),
    sortOrder: Number(form.sortOrder),
    isDefault: false,
    status: form.status || 'active',
  };
}

export function canDeleteSection(section) {
  return section?.sectionType === 'subgroup';
}

export function formatSectionScope(section) {
  return section?.sectionType === 'subgroup' ? 'Subgroup' : 'Full Class';
}
