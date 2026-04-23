import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';

function normalizeAcademicYear(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    label: data.label || '',
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    isActive: Boolean(data.isActive),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listAcademicYearsBySchool(schoolId) {
  if (!schoolId) {
    return [];
  }

  const academicYearsQuery = query(
    collection(db, 'academicYears'),
    where('schoolId', '==', schoolId),
    orderBy('startDate', 'desc'),
  );
  const snapshot = await getDocs(academicYearsQuery);

  return snapshot.docs.map(normalizeAcademicYear);
}

async function deactivateAcademicYearsInSchool(batch, schoolId, exceptId = '') {
  const academicYears = await listAcademicYearsBySchool(schoolId);

  academicYears.forEach((academicYear) => {
    if (academicYear.id === exceptId || !academicYear.isActive) {
      return;
    }

    batch.update(doc(db, 'academicYears', academicYear.id), {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function saveAcademicYear({ endDate, id, isActive, label, schoolId, startDate }) {
  const academicYearRef = id
    ? doc(db, 'academicYears', id)
    : doc(collection(db, 'academicYears'));
  const existingSnapshot = await getDoc(academicYearRef);
  const batch = writeBatch(db);

  if (isActive) {
    await deactivateAcademicYearsInSchool(batch, schoolId, academicYearRef.id);
  }

  batch.set(
    academicYearRef,
    {
      schoolId,
      label: label.trim(),
      startDate,
      endDate,
      isActive: Boolean(isActive),
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();

  const savedSnapshot = await getDoc(academicYearRef);
  return normalizeAcademicYear(savedSnapshot);
}

export async function activateAcademicYear(academicYearId, schoolId) {
  const academicYearRef = doc(db, 'academicYears', academicYearId);
  const snapshot = await getDoc(academicYearRef);

  if (!snapshot.exists()) {
    throw new Error('Academic year not found.');
  }

  const academicYear = normalizeAcademicYear(snapshot);

  return saveAcademicYear({
    ...academicYear,
    schoolId,
    isActive: true,
  });
}

export async function touchAcademicYearAsActive(academicYearId, schoolId) {
  const academicYears = await listAcademicYearsBySchool(schoolId);
  const batch = writeBatch(db);

  academicYears.forEach((academicYear) => {
    batch.update(doc(db, 'academicYears', academicYear.id), {
      isActive: academicYear.id === academicYearId,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}
