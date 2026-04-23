import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';
import { buildTimetableId } from '../helpers/createEntry';
import {
  filterTimetableRecordsByPublication,
  isPublishedPublicationView,
  normalizePublicationStatus,
  TIMETABLE_PUBLICATION_STATUS,
} from '../helpers/timetablePublication';

function normalizeTimetable(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    timetableType: data.timetableType || 'class',
    ownerId: data.ownerId || '',
    ownerName: data.ownerName || '',
    ownerCode: data.ownerCode || '',
    academicYearId: data.academicYearId || '',
    academicYearLabel: data.academicYearLabel || '',
    termId: data.termId || '',
    termName: data.termName || '',
    timeStructureId: data.timeStructureId || '',
    timeStructureName: data.timeStructureName || '',
    classId: data.classId || '',
    className: data.className || '',
    teacherId: data.teacherId || '',
    teacherName: data.teacherName || '',
    classroomId: data.classroomId || '',
    classroomName: data.classroomName || '',
    status: data.status || 'active',
    publicationStatus: normalizePublicationStatus(data.publicationStatus),
    hasPublishedVersion: Boolean(data.hasPublishedVersion),
    hasUnpublishedChanges: Boolean(data.hasUnpublishedChanges),
    publishedVersionNumber: Number(data.publishedVersionNumber) || 0,
    versionNumber: Number(data.versionNumber) || 0,
    latestPublishedSnapshotId: data.latestPublishedSnapshotId || '',
    lastPublishedAt: data.lastPublishedAt ?? null,
    lastPublishedByDisplayName: data.lastPublishedByDisplayName || '',
    lastPublishedByEmail: data.lastPublishedByEmail || '',
    lastPublishedByUserId: data.lastPublishedByUserId || '',
    publishedAt: data.publishedAt ?? null,
    publishedByDisplayName: data.publishedByDisplayName || '',
    publishedByEmail: data.publishedByEmail || '',
    publishedByUserId: data.publishedByUserId || '',
    sourceTimetableId: data.sourceTimetableId || '',
    isCurrentPublished: Boolean(data.isCurrentPublished),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function normalizeTimetableEntry(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    timetableId: data.timetableId || '',
    academicYearId: data.academicYearId || '',
    academicYearLabel: data.academicYearLabel || '',
    termId: data.termId || '',
    termName: data.termName || '',
    timeStructureId: data.timeStructureId || '',
    timeStructureName: data.timeStructureName || '',
    dailyScheduleId: data.dailyScheduleId || '',
    timeSlotId: data.timeSlotId || '',
    weekdayKey: data.weekdayKey || '',
    weekdayLabel: data.weekdayLabel || '',
    weekdayOrder: Number(data.weekdayOrder) || 1,
    slotIndex: Number(data.slotIndex) || 1,
    startTime: data.startTime || '',
    endTime: data.endTime || '',
    slotType: data.slotType || 'teaching',
    classId: data.classId || '',
    className: data.className || '',
    classCode: data.classCode || '',
    subjectId: data.subjectId || '',
    subjectName: data.subjectName || '',
    subjectCode: data.subjectCode || '',
    subjectShortName: data.subjectShortName || '',
    subjectType: data.subjectType || 'core',
    learningAreaId: data.learningAreaId || '',
    learningAreaName: data.learningAreaName || '',
    colorToken: data.colorToken || '',
    colorHex: data.colorHex || '',
    classOfferingId: data.classOfferingId || '',
    sectionId: data.sectionId || '',
    sectionName: data.sectionName || '',
    sectionType: data.sectionType || 'full_class',
    teacherIds: Array.isArray(data.teacherIds) ? data.teacherIds : [],
    teacherNames: Array.isArray(data.teacherNames) ? data.teacherNames : [],
    teacherDisplay: data.teacherDisplay || '',
    teacherTimetableIds: Array.isArray(data.teacherTimetableIds) ? data.teacherTimetableIds : [],
    classroomId: data.classroomId || '',
    classroomName: data.classroomName || '',
    classroomCode: data.classroomCode || '',
    roomTimetableId: data.roomTimetableId || '',
    status: data.status || 'active',
    publicationStatus: normalizePublicationStatus(data.publicationStatus),
    versionNumber: Number(data.versionNumber) || 0,
    publishedVersionNumber: Number(data.publishedVersionNumber) || 0,
    sourceTimetableId: data.sourceTimetableId || data.timetableId || '',
    draftEntryId: data.draftEntryId || '',
    isCurrentPublished: Boolean(data.isCurrentPublished),
    publishedAt: data.publishedAt ?? null,
    publishedByDisplayName: data.publishedByDisplayName || '',
    publishedByEmail: data.publishedByEmail || '',
    publishedByUserId: data.publishedByUserId || '',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function sortTimetableEntries(entries = []) {
  return [...entries].sort((left, right) => {
    if (left.weekdayOrder !== right.weekdayOrder) {
      return left.weekdayOrder - right.weekdayOrder;
    }

    if (left.slotIndex !== right.slotIndex) {
      return left.slotIndex - right.slotIndex;
    }

    return String(left.sectionName || '').localeCompare(String(right.sectionName || ''));
  });
}

function filterAndSortTimetableEntries(entries = [], publicationView) {
  const publicationScopedEntries = filterTimetableRecordsByPublication(entries, publicationView);

  return sortTimetableEntries(
    isPublishedPublicationView(publicationView)
      ? publicationScopedEntries.filter((entry) => entry.status === 'active')
      : publicationScopedEntries,
  );
}

async function getCreatedAtValue(documentRef) {
  const snapshot = await getDoc(documentRef);
  return snapshot.exists() ? snapshot.data().createdAt || serverTimestamp() : serverTimestamp();
}

function buildTimetableEntriesQuery({
  ownerId,
  publicationView,
  schoolId,
  termId,
  timeStructureId,
  timetableType,
}) {
  const filters = [
    where('schoolId', '==', schoolId),
    where('termId', '==', termId),
    where('timeStructureId', '==', timeStructureId),
  ];

  if (isPublishedPublicationView(publicationView)) {
    filters.push(where('publicationStatus', '==', TIMETABLE_PUBLICATION_STATUS.PUBLISHED));
    filters.push(where('status', '==', 'active'));
  }

  if (timetableType === 'teacher') {
    return query(collection(db, 'timetableEntries'), where('teacherIds', 'array-contains', ownerId), ...filters);
  }

  if (timetableType === 'room') {
    return query(collection(db, 'timetableEntries'), where('classroomId', '==', ownerId), ...filters);
  }

  return query(collection(db, 'timetableEntries'), where('classId', '==', ownerId), ...filters);
}

export async function getTimetableByScope({
  ownerId,
  schoolId,
  termId,
  timeStructureId,
  timetableType,
}) {
  if (!schoolId || !timetableType || !ownerId || !termId || !timeStructureId) {
    return null;
  }

  const timetableSnapshot = await getDoc(
    doc(
      db,
      'timetables',
      buildTimetableId({
        ownerId,
        schoolId,
        termId,
        timeStructureId,
        timetableType,
      }),
    ),
  );

  return timetableSnapshot.exists() ? normalizeTimetable(timetableSnapshot) : null;
}

export function subscribeTimetableByScope({
  onChange,
  onError,
  ownerId,
  schoolId,
  termId,
  timeStructureId,
  timetableType,
}) {
  if (!schoolId || !timetableType || !ownerId || !termId || !timeStructureId) {
    onChange(null);
    return () => {};
  }

  return onSnapshot(
    doc(
      db,
      'timetables',
      buildTimetableId({
        ownerId,
        schoolId,
        termId,
        timeStructureId,
        timetableType,
      }),
    ),
    (snapshot) => {
      onChange(snapshot.exists() ? normalizeTimetable(snapshot) : null);
    },
    onError,
  );
}

export async function listTimetableEntriesByClass({
  classId,
  publicationView = TIMETABLE_PUBLICATION_STATUS.DRAFT,
  schoolId,
  termId,
  timeStructureId,
}) {
  if (!schoolId || !classId || !termId || !timeStructureId) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'timetableEntries'),
      where('schoolId', '==', schoolId),
      where('classId', '==', classId),
      where('termId', '==', termId),
      where('timeStructureId', '==', timeStructureId),
      ...(isPublishedPublicationView(publicationView)
        ? [
            where('publicationStatus', '==', TIMETABLE_PUBLICATION_STATUS.PUBLISHED),
            where('status', '==', 'active'),
          ]
        : []),
    ),
  );

  return filterAndSortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry), publicationView);
}

export function subscribeTimetableEntriesByScope({
  onChange,
  onError,
  ownerId,
  publicationView = TIMETABLE_PUBLICATION_STATUS.DRAFT,
  schoolId,
  termId,
  timeStructureId,
  timetableType,
}) {
  if (!schoolId || !ownerId || !termId || !timeStructureId) {
    onChange([]);
    return () => {};
  }

  return onSnapshot(
    buildTimetableEntriesQuery({
      ownerId,
      publicationView,
      schoolId,
      termId,
      timeStructureId,
      timetableType,
    }),
    (snapshot) => {
      onChange(
        filterAndSortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry), publicationView),
      );
    },
    onError,
  );
}

export function subscribeTimetableEntriesByContext({
  onChange,
  onError,
  publicationView = TIMETABLE_PUBLICATION_STATUS.DRAFT,
  schoolId,
  termId,
  timeStructureId,
}) {
  if (!schoolId || !termId || !timeStructureId) {
    onChange([]);
    return () => {};
  }

  return onSnapshot(
    query(
      collection(db, 'timetableEntries'),
      where('schoolId', '==', schoolId),
      where('termId', '==', termId),
      where('timeStructureId', '==', timeStructureId),
      ...(isPublishedPublicationView(publicationView)
        ? [
            where('publicationStatus', '==', TIMETABLE_PUBLICATION_STATUS.PUBLISHED),
            where('status', '==', 'active'),
          ]
        : []),
    ),
    (snapshot) => {
      onChange(
        filterAndSortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry), publicationView),
      );
    },
    onError,
  );
}

export async function listTimetableEntriesByTeacher({
  publicationView = TIMETABLE_PUBLICATION_STATUS.DRAFT,
  schoolId,
  teacherId,
  termId,
  timeStructureId,
}) {
  if (!schoolId || !teacherId || !termId || !timeStructureId) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'timetableEntries'),
      where('schoolId', '==', schoolId),
      where('teacherIds', 'array-contains', teacherId),
      where('termId', '==', termId),
      where('timeStructureId', '==', timeStructureId),
      ...(isPublishedPublicationView(publicationView)
        ? [
            where('publicationStatus', '==', TIMETABLE_PUBLICATION_STATUS.PUBLISHED),
            where('status', '==', 'active'),
          ]
        : []),
    ),
  );

  return filterAndSortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry), publicationView);
}

export async function listTimetableEntriesByRoom({
  classroomId,
  publicationView = TIMETABLE_PUBLICATION_STATUS.DRAFT,
  schoolId,
  termId,
  timeStructureId,
}) {
  if (!schoolId || !classroomId || !termId || !timeStructureId) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'timetableEntries'),
      where('schoolId', '==', schoolId),
      where('classroomId', '==', classroomId),
      where('termId', '==', termId),
      where('timeStructureId', '==', timeStructureId),
      ...(isPublishedPublicationView(publicationView)
        ? [
            where('publicationStatus', '==', TIMETABLE_PUBLICATION_STATUS.PUBLISHED),
            where('status', '==', 'active'),
          ]
        : []),
    ),
  );

  return filterAndSortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry), publicationView);
}

export async function listTimetableEntriesByTimeSlot({
  publicationView = TIMETABLE_PUBLICATION_STATUS.DRAFT,
  schoolId,
  termId,
  timeSlotId,
  timeStructureId,
}) {
  if (!schoolId || !termId || !timeSlotId || !timeStructureId) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'timetableEntries'),
      where('schoolId', '==', schoolId),
      where('termId', '==', termId),
      where('timeSlotId', '==', timeSlotId),
      where('timeStructureId', '==', timeStructureId),
      ...(isPublishedPublicationView(publicationView)
        ? [
            where('publicationStatus', '==', TIMETABLE_PUBLICATION_STATUS.PUBLISHED),
            where('status', '==', 'active'),
          ]
        : []),
    ),
  );

  return filterAndSortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry), publicationView);
}

export async function listTimetableEntriesByContext({
  publicationView = TIMETABLE_PUBLICATION_STATUS.DRAFT,
  schoolId,
  termId,
  timeStructureId,
}) {
  if (!schoolId || !termId || !timeStructureId) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'timetableEntries'),
      where('schoolId', '==', schoolId),
      where('termId', '==', termId),
      where('timeStructureId', '==', timeStructureId),
      ...(isPublishedPublicationView(publicationView)
        ? [
            where('publicationStatus', '==', TIMETABLE_PUBLICATION_STATUS.PUBLISHED),
            where('status', '==', 'active'),
          ]
        : []),
    ),
  );

  return filterAndSortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry), publicationView);
}

export async function saveTimetableBundle({ entry, timetablePayloads = [] }) {
  if (!entry?.id || !entry?.payload) {
    throw new Error('A valid timetable entry is required before saving.');
  }

  const batch = writeBatch(db);
  const uniqueTimetables = new Map();

  timetablePayloads.forEach((timetable) => {
    if (timetable?.id && timetable?.payload) {
      uniqueTimetables.set(timetable.id, timetable.payload);
    }
  });

  const timetableEntries = await Promise.all(
    Array.from(uniqueTimetables.entries()).map(async ([id, payload]) => {
      const timetableRef = doc(db, 'timetables', id);
      return {
        createdAt: await getCreatedAtValue(timetableRef),
        id,
        payload,
        ref: timetableRef,
      };
    }),
  );
  const entryRef = doc(db, 'timetableEntries', entry.id);
  const entryCreatedAt = await getCreatedAtValue(entryRef);

  timetableEntries.forEach((timetable) => {
    const isClassTimetable = timetable.payload.timetableType === 'class';

    batch.set(
      timetable.ref,
      {
        ...timetable.payload,
        publicationStatus: normalizePublicationStatus(timetable.payload.publicationStatus),
        ...(isClassTimetable
          ? {
              hasUnpublishedChanges: true,
            }
          : {}),
        createdAt: timetable.createdAt,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  batch.set(
    entryRef,
    {
      ...entry.payload,
      publicationStatus: normalizePublicationStatus(entry.payload.publicationStatus),
      createdAt: entryCreatedAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();

  const savedEntrySnapshot = await getDoc(entryRef);
  return normalizeTimetableEntry(savedEntrySnapshot);
}

export async function deleteTimetableEntry(target) {
  const entryId = typeof target === 'string' ? target : target?.entryId;
  const timetableId = typeof target === 'string' ? '' : target?.timetableId || '';

  if (!entryId) {
    throw new Error('A timetable entry id is required before deleting.');
  }

  if (!timetableId) {
    await deleteDoc(doc(db, 'timetableEntries', entryId));
    return;
  }

  const batch = writeBatch(db);

  batch.delete(doc(db, 'timetableEntries', entryId));
  batch.set(
    doc(db, 'timetables', timetableId),
    {
      hasUnpublishedChanges: true,
      publicationStatus: TIMETABLE_PUBLICATION_STATUS.DRAFT,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();
}
