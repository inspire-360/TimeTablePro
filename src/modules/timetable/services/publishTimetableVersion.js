import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';
import {
  buildPublishedEntrySnapshotId,
  buildPublishedSnapshotId,
  getNextPublishedVersionNumber,
  isDraftRecord,
  TIMETABLE_PUBLICATION_STATUS,
} from '../helpers/timetablePublication';

async function getCreatedAtValue(documentRef) {
  const snapshot = await getDoc(documentRef);
  return snapshot.exists() ? snapshot.data().createdAt || serverTimestamp() : serverTimestamp();
}

function getPublishedByDisplayName(profile) {
  return profile?.displayName || profile?.email || 'School administrator';
}

function buildDraftMetadata({
  draftSnapshotId,
  profile,
  publishedVersionNumber,
}) {
  return {
    hasPublishedVersion: true,
    hasUnpublishedChanges: false,
    lastPublishedAt: serverTimestamp(),
    lastPublishedByDisplayName: getPublishedByDisplayName(profile),
    lastPublishedByEmail: profile?.email || '',
    lastPublishedByUserId: profile?.uid || '',
    latestPublishedSnapshotId: draftSnapshotId,
    publicationStatus: TIMETABLE_PUBLICATION_STATUS.DRAFT,
    publishedVersionNumber,
  };
}

function buildPublishedTimetablePayload({
  draftTimetable,
  entryCount,
  profile,
  publishedSnapshotId,
  publishedVersionNumber,
}) {
  return {
    schoolId: draftTimetable.schoolId,
    timetableType: draftTimetable.timetableType,
    ownerId: draftTimetable.ownerId,
    ownerName: draftTimetable.ownerName,
    ownerCode: draftTimetable.ownerCode,
    academicYearId: draftTimetable.academicYearId,
    academicYearLabel: draftTimetable.academicYearLabel,
    termId: draftTimetable.termId,
    termName: draftTimetable.termName,
    timeStructureId: draftTimetable.timeStructureId,
    timeStructureName: draftTimetable.timeStructureName,
    classId: draftTimetable.classId,
    className: draftTimetable.className,
    teacherId: draftTimetable.teacherId,
    teacherName: draftTimetable.teacherName,
    classroomId: draftTimetable.classroomId,
    classroomName: draftTimetable.classroomName,
    status: 'active',
    publicationStatus: TIMETABLE_PUBLICATION_STATUS.PUBLISHED,
    sourceTimetableId: draftTimetable.id,
    versionNumber: publishedVersionNumber,
    entryCount,
    isCurrentPublished: true,
    publishedAt: serverTimestamp(),
    publishedByDisplayName: getPublishedByDisplayName(profile),
    publishedByEmail: profile?.email || '',
    publishedByUserId: profile?.uid || '',
    latestPublishedSnapshotId: publishedSnapshotId,
    publishedVersionNumber,
    hasPublishedVersion: true,
    hasUnpublishedChanges: false,
    lastPublishedAt: serverTimestamp(),
    lastPublishedByDisplayName: getPublishedByDisplayName(profile),
    lastPublishedByEmail: profile?.email || '',
    lastPublishedByUserId: profile?.uid || '',
  };
}

function buildPublishedEntryPayload({
  draftEntry,
  profile,
  publishedSnapshotId,
  publishedVersionNumber,
}) {
  const {
    id: _draftEntryId,
    createdAt: _draftCreatedAt,
    updatedAt: _draftUpdatedAt,
    ...draftEntryData
  } = draftEntry;

  return {
    ...draftEntryData,
    timetableId: publishedSnapshotId,
    sourceTimetableId: draftEntry.sourceTimetableId || draftEntry.timetableId,
    draftEntryId: draftEntry.id,
    publicationStatus: TIMETABLE_PUBLICATION_STATUS.PUBLISHED,
    status: 'active',
    isCurrentPublished: true,
    versionNumber: publishedVersionNumber,
    publishedVersionNumber,
    publishedAt: serverTimestamp(),
    publishedByDisplayName: getPublishedByDisplayName(profile),
    publishedByEmail: profile?.email || '',
    publishedByUserId: profile?.uid || '',
  };
}

export async function publishTimetableVersion({
  entries = [],
  profile,
  timetable,
}) {
  if (!timetable?.id) {
    throw new Error('Save the class timetable before publishing it.');
  }

  if (timetable.timetableType !== 'class') {
    throw new Error('Only class timetable drafts can be published.');
  }

  const draftEntries = entries.filter(isDraftRecord);

  if (draftEntries.length === 0) {
    throw new Error('Add at least one lesson before publishing the timetable.');
  }

  const publishedVersionNumber = getNextPublishedVersionNumber(timetable);
  const publishedSnapshotId = buildPublishedSnapshotId(timetable.id, publishedVersionNumber);
  const previousPublishedSnapshotId = timetable.latestPublishedSnapshotId || '';
  const batch = writeBatch(db);
  const draftTimetableRef = doc(db, 'timetables', timetable.id);
  const draftTimetableCreatedAt = await getCreatedAtValue(draftTimetableRef);
  const publishedTimetableRef = doc(db, 'timetables', publishedSnapshotId);
  const publishedTimetableCreatedAt = await getCreatedAtValue(publishedTimetableRef);

  if (previousPublishedSnapshotId) {
    const previousPublishedTimetableRef = doc(db, 'timetables', previousPublishedSnapshotId);
    const previousPublishedTimetableSnapshot = await getDoc(previousPublishedTimetableRef);

    if (previousPublishedTimetableSnapshot.exists()) {
      batch.set(
        previousPublishedTimetableRef,
        {
          isCurrentPublished: false,
          status: 'inactive',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    const previousPublishedEntriesSnapshot = await getDocs(
      query(
        collection(db, 'timetableEntries'),
        where('timetableId', '==', previousPublishedSnapshotId),
      ),
    );

    previousPublishedEntriesSnapshot.docs.forEach((snapshot) => {
      batch.set(
        snapshot.ref,
        {
          isCurrentPublished: false,
          status: 'inactive',
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
  }

  batch.set(
    draftTimetableRef,
    {
      ...buildDraftMetadata({
        draftSnapshotId: publishedSnapshotId,
        profile,
        publishedVersionNumber,
      }),
      createdAt: draftTimetableCreatedAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  batch.set(
    publishedTimetableRef,
    {
      ...buildPublishedTimetablePayload({
        draftTimetable: timetable,
        entryCount: draftEntries.length,
        profile,
        publishedSnapshotId,
        publishedVersionNumber,
      }),
      createdAt: publishedTimetableCreatedAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const publishedEntryRefs = await Promise.all(
    draftEntries.map(async (draftEntry) => {
      const publishedEntryId = buildPublishedEntrySnapshotId(draftEntry.id, publishedVersionNumber);
      const publishedEntryRef = doc(db, 'timetableEntries', publishedEntryId);

      return {
        createdAt: await getCreatedAtValue(publishedEntryRef),
        payload: buildPublishedEntryPayload({
          draftEntry,
          profile,
          publishedSnapshotId,
          publishedVersionNumber,
        }),
        ref: publishedEntryRef,
      };
    }),
  );

  publishedEntryRefs.forEach((publishedEntry) => {
    batch.set(
      publishedEntry.ref,
      {
        ...publishedEntry.payload,
        createdAt: publishedEntry.createdAt,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  await batch.commit();

  return {
    publishedSnapshotId,
    publishedVersionNumber,
  };
}
