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

async function getCreatedAtValue(documentRef) {
  const snapshot = await getDoc(documentRef);
  return snapshot.exists() ? snapshot.data().createdAt || serverTimestamp() : serverTimestamp();
}

function buildTimetableEntriesQuery({
  ownerId,
  schoolId,
  termId,
  timeStructureId,
  timetableType,
}) {
  if (timetableType === 'teacher') {
    return query(
      collection(db, 'timetableEntries'),
      where('schoolId', '==', schoolId),
      where('teacherIds', 'array-contains', ownerId),
      where('termId', '==', termId),
      where('timeStructureId', '==', timeStructureId),
    );
  }

  if (timetableType === 'room') {
    return query(
      collection(db, 'timetableEntries'),
      where('schoolId', '==', schoolId),
      where('classroomId', '==', ownerId),
      where('termId', '==', termId),
      where('timeStructureId', '==', timeStructureId),
    );
  }

  return query(
    collection(db, 'timetableEntries'),
    where('schoolId', '==', schoolId),
    where('classId', '==', ownerId),
    where('termId', '==', termId),
    where('timeStructureId', '==', timeStructureId),
  );
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
    ),
  );

  return sortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry));
}

export function subscribeTimetableEntriesByScope({
  onChange,
  onError,
  ownerId,
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
      schoolId,
      termId,
      timeStructureId,
      timetableType,
    }),
    (snapshot) => {
      onChange(sortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry)));
    },
    onError,
  );
}

export function subscribeTimetableEntriesByContext({
  onChange,
  onError,
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
    ),
    (snapshot) => {
      onChange(sortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry)));
    },
    onError,
  );
}

export async function listTimetableEntriesByTeacher({
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
    ),
  );

  return sortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry));
}

export async function listTimetableEntriesByRoom({
  classroomId,
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
    ),
  );

  return sortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry));
}

export async function listTimetableEntriesByTimeSlot({
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
    ),
  );

  return sortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry));
}

export async function listTimetableEntriesByContext({
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
    ),
  );

  return sortTimetableEntries(snapshot.docs.map(normalizeTimetableEntry));
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
    batch.set(
      timetable.ref,
      {
        ...timetable.payload,
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
      createdAt: entryCreatedAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();

  const savedEntrySnapshot = await getDoc(entryRef);
  return normalizeTimetableEntry(savedEntrySnapshot);
}

export async function deleteTimetableEntry(entryId) {
  await deleteDoc(doc(db, 'timetableEntries', entryId));
}
