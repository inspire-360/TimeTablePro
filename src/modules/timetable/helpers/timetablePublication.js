export const TIMETABLE_PUBLICATION_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
};

export const TIMETABLE_PUBLICATION_VIEW_OPTIONS = [
  {
    value: TIMETABLE_PUBLICATION_STATUS.DRAFT,
    label: 'Working draft',
  },
  {
    value: TIMETABLE_PUBLICATION_STATUS.PUBLISHED,
    label: 'Current published',
  },
];

export function normalizePublicationStatus(value) {
  return value === TIMETABLE_PUBLICATION_STATUS.PUBLISHED
    ? TIMETABLE_PUBLICATION_STATUS.PUBLISHED
    : TIMETABLE_PUBLICATION_STATUS.DRAFT;
}

export function isPublishedPublicationView(value) {
  return normalizePublicationStatus(value) === TIMETABLE_PUBLICATION_STATUS.PUBLISHED;
}

export function isPublishedRecord(record) {
  return normalizePublicationStatus(record?.publicationStatus) === TIMETABLE_PUBLICATION_STATUS.PUBLISHED;
}

export function isDraftRecord(record) {
  return !isPublishedRecord(record);
}

export function filterTimetableRecordsByPublication(records = [], publicationView) {
  if (isPublishedPublicationView(publicationView)) {
    return records.filter(isPublishedRecord);
  }

  return records.filter(isDraftRecord);
}

export function buildPublishedSnapshotId(timetableId, versionNumber) {
  return `${String(timetableId || '').trim()}-published-v${versionNumber}`;
}

export function buildPublishedEntrySnapshotId(entryId, versionNumber) {
  return `${String(entryId || '').trim()}-published-v${versionNumber}`;
}

export function getNextPublishedVersionNumber(timetable) {
  const currentVersion = Number(timetable?.publishedVersionNumber) || 0;
  return currentVersion + 1;
}

export function getPublicationViewLabel(publicationView) {
  return (
    TIMETABLE_PUBLICATION_VIEW_OPTIONS.find((option) => option.value === publicationView)?.label ||
    TIMETABLE_PUBLICATION_VIEW_OPTIONS[0].label
  );
}

export function getTimetablePublicationState(timetable) {
  const publishedVersionNumber = Number(timetable?.publishedVersionNumber) || 0;

  if (publishedVersionNumber === 0) {
    return {
      hasPublishedVersion: false,
      label: 'Draft only',
      tone: 'neutral',
    };
  }

  if (timetable?.hasUnpublishedChanges) {
    return {
      hasPublishedVersion: true,
      label: `Draft changes pending | Published v${publishedVersionNumber}`,
      tone: 'warning',
    };
  }

  return {
    hasPublishedVersion: true,
    label: `Published v${publishedVersionNumber}`,
    tone: 'success',
  };
}
