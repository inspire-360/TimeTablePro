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
import { touchAcademicYearAsActive } from './academicYearRepository';

function normalizeTerm(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    academicYearId: data.academicYearId,
    name: data.name || '',
    termNumber: Number(data.termNumber) || 1,
    startDate: data.startDate || '',
    endDate: data.endDate || '',
    isActive: Boolean(data.isActive),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listTermsBySchool(schoolId) {
  if (!schoolId) {
    return [];
  }

  const termsQuery = query(
    collection(db, 'terms'),
    where('schoolId', '==', schoolId),
    orderBy('startDate', 'asc'),
  );
  const snapshot = await getDocs(termsQuery);

  return snapshot.docs.map(normalizeTerm);
}

async function deactivateTermsInSchool(batch, schoolId, exceptId = '') {
  const terms = await listTermsBySchool(schoolId);

  terms.forEach((term) => {
    if (term.id === exceptId || !term.isActive) {
      return;
    }

    batch.update(doc(db, 'terms', term.id), {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function saveTerm({
  academicYearId,
  endDate,
  id,
  isActive,
  name,
  schoolId,
  startDate,
  termNumber,
}) {
  const termRef = id ? doc(db, 'terms', id) : doc(collection(db, 'terms'));
  const existingSnapshot = await getDoc(termRef);
  const batch = writeBatch(db);

  if (isActive) {
    await deactivateTermsInSchool(batch, schoolId, termRef.id);
  }

  batch.set(
    termRef,
    {
      schoolId,
      academicYearId,
      name: name.trim(),
      termNumber: Number(termNumber),
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

  if (isActive) {
    await touchAcademicYearAsActive(academicYearId, schoolId);
  }

  const savedSnapshot = await getDoc(termRef);
  return normalizeTerm(savedSnapshot);
}

export async function activateTerm(termId, schoolId) {
  const termRef = doc(db, 'terms', termId);
  const snapshot = await getDoc(termRef);

  if (!snapshot.exists()) {
    throw new Error('Term not found.');
  }

  const term = normalizeTerm(snapshot);

  return saveTerm({
    ...term,
    schoolId,
    isActive: true,
  });
}
