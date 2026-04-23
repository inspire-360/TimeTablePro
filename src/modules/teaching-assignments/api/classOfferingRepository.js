import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';

function normalizeClassOffering(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    classId: data.classId,
    className: data.className || '',
    classCode: data.classCode || '',
    gradeLevel: data.gradeLevel || '',
    subjectId: data.subjectId,
    subjectName: data.subjectName || '',
    subjectCode: data.subjectCode || '',
    subjectShortName: data.subjectShortName || '',
    subjectType: data.subjectType || 'core',
    learningAreaId: data.learningAreaId || '',
    learningAreaName: data.learningAreaName || '',
    colorToken: data.colorToken || '',
    colorHex: data.colorHex || '',
    status: data.status || 'active',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listClassOfferingsByClass({ schoolId, classId }) {
  if (!schoolId || !classId) {
    return [];
  }

  const classOfferingsQuery = query(
    collection(db, 'classOfferings'),
    where('schoolId', '==', schoolId),
    where('classId', '==', classId),
    orderBy('updatedAt', 'desc'),
  );
  const snapshot = await getDocs(classOfferingsQuery);

  return snapshot.docs.map(normalizeClassOffering);
}

export async function saveClassOffering({ id, payload }) {
  const classOfferingRef = doc(db, 'classOfferings', id);
  const existingSnapshot = await getDoc(classOfferingRef);

  await setDoc(
    classOfferingRef,
    {
      ...payload,
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const savedSnapshot = await getDoc(classOfferingRef);
  return normalizeClassOffering(savedSnapshot);
}

export async function deleteClassOfferingCascade({ classOfferingId }) {
  const sectionsSnapshot = await getDocs(
    query(
      collection(db, 'sections'),
      where('classOfferingId', '==', classOfferingId),
    ),
  );
  const courseAssignmentsSnapshot = await getDocs(
    query(
      collection(db, 'courseAssignments'),
      where('classOfferingId', '==', classOfferingId),
    ),
  );
  const batch = writeBatch(db);

  sectionsSnapshot.docs.forEach((snapshot) => {
    batch.delete(doc(db, 'sections', snapshot.id));
  });
  courseAssignmentsSnapshot.docs.forEach((snapshot) => {
    batch.delete(doc(db, 'courseAssignments', snapshot.id));
  });
  batch.delete(doc(db, 'classOfferings', classOfferingId));

  await batch.commit();
}
