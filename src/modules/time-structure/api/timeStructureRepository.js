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
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';

function normalizeTimeStructure(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    name: data.name || '',
    daysPerWeek: Number(data.daysPerWeek) || 5,
    periodsPerDay: Number(data.periodsPerDay) || 7,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listTimeStructuresBySchool(schoolId) {
  if (!schoolId) {
    return [];
  }

  const timeStructuresQuery = query(
    collection(db, 'timeStructures'),
    where('schoolId', '==', schoolId),
    orderBy('updatedAt', 'desc'),
  );
  const snapshot = await getDocs(timeStructuresQuery);

  return snapshot.docs.map(normalizeTimeStructure);
}

export async function saveTimeStructure({
  daysPerWeek,
  id,
  name,
  periodsPerDay,
  schoolId,
}) {
  const timeStructureRef = id
    ? doc(db, 'timeStructures', id)
    : doc(collection(db, 'timeStructures'));
  const existingSnapshot = await getDoc(timeStructureRef);

  await setDoc(
    timeStructureRef,
    {
      schoolId,
      name: name.trim(),
      daysPerWeek: Number(daysPerWeek),
      periodsPerDay: Number(periodsPerDay),
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const savedSnapshot = await getDoc(timeStructureRef);
  return normalizeTimeStructure(savedSnapshot);
}
