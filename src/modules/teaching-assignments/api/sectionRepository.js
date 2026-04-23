import {
  collection,
  deleteDoc,
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
import {
  buildDefaultFullClassSection,
  getDefaultFullClassSection,
  sortSections,
} from '../helpers/sectionLogic';

function normalizeSection(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    classOfferingId: data.classOfferingId,
    classId: data.classId || '',
    className: data.className || '',
    subjectId: data.subjectId || '',
    subjectName: data.subjectName || '',
    sectionType: data.sectionType || 'full_class',
    code: data.code || '',
    name: data.name || '',
    subgroupLabel: data.subgroupLabel || '',
    sortOrder: Number(data.sortOrder) || 1,
    isDefault: Boolean(data.isDefault),
    status: data.status || 'active',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listSectionsByClassOffering({ classOfferingId, schoolId }) {
  if (!schoolId || !classOfferingId) {
    return [];
  }

  const sectionsQuery = query(
    collection(db, 'sections'),
    where('schoolId', '==', schoolId),
    where('classOfferingId', '==', classOfferingId),
    orderBy('sortOrder', 'asc'),
  );
  const snapshot = await getDocs(sectionsQuery);

  return sortSections(snapshot.docs.map(normalizeSection));
}

export async function saveSection({ id, payload }) {
  const sectionRef = id ? doc(db, 'sections', id) : doc(collection(db, 'sections'));
  const existingSnapshot = await getDoc(sectionRef);

  await setDoc(
    sectionRef,
    {
      ...payload,
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const savedSnapshot = await getDoc(sectionRef);
  return normalizeSection(savedSnapshot);
}

export async function ensureDefaultFullClassSection({
  classOffering,
  sections,
}) {
  const defaultSection = getDefaultFullClassSection(sections);

  if (defaultSection) {
    return defaultSection;
  }

  return saveSection({
    id: buildDefaultFullClassSection({ classOffering }).id,
    payload: buildDefaultFullClassSection({ classOffering }),
  });
}

export async function deleteSectionCascade({ sectionId }) {
  const courseAssignmentsSnapshot = await getDocs(
    query(
      collection(db, 'courseAssignments'),
      where('sectionId', '==', sectionId),
    ),
  );
  const batch = writeBatch(db);

  courseAssignmentsSnapshot.docs.forEach((snapshot) => {
    batch.delete(doc(db, 'courseAssignments', snapshot.id));
  });
  batch.delete(doc(db, 'sections', sectionId));

  await batch.commit();
}

export async function deleteSection(section) {
  await deleteDoc(doc(db, 'sections', section.id));
}
