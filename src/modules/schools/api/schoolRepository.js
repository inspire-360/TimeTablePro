import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';

function normalizeSchool(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    name: data.name || '',
    logoUrl: data.logoUrl || '',
    affiliation: data.affiliation || '',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export function createDraftSchool(schoolId = '') {
  return {
    id: schoolId,
    schoolId,
    name: '',
    logoUrl: '',
    affiliation: '',
    createdAt: null,
    updatedAt: null,
  };
}

export async function listSchools() {
  const schoolsQuery = query(collection(db, 'schools'), orderBy('name', 'asc'));
  const snapshot = await getDocs(schoolsQuery);

  return snapshot.docs.map(normalizeSchool);
}

export async function getSchoolById(schoolId) {
  if (!schoolId) {
    return null;
  }

  const snapshot = await getDoc(doc(db, 'schools', schoolId));
  return snapshot.exists() ? normalizeSchool(snapshot) : null;
}

export function subscribeSchools({ onChange, onError }) {
  const schoolsQuery = query(collection(db, 'schools'), orderBy('name', 'asc'));

  return onSnapshot(
    schoolsQuery,
    (snapshot) => {
      onChange(snapshot.docs.map(normalizeSchool));
    },
    onError,
  );
}

export function subscribeSchoolById({ onChange, onError, schoolId }) {
  if (!schoolId) {
    onChange(null);
    return () => {};
  }

  return onSnapshot(
    doc(db, 'schools', schoolId),
    (snapshot) => {
      onChange(snapshot.exists() ? normalizeSchool(snapshot) : null);
    },
    onError,
  );
}

export async function upsertSchool({ affiliation, logoUrl, name, schoolId }) {
  const schoolRef = doc(db, 'schools', schoolId);
  const currentSnapshot = await getDoc(schoolRef);

  await setDoc(
    schoolRef,
    {
      schoolId,
      name: name.trim(),
      logoUrl: logoUrl.trim(),
      affiliation: affiliation.trim(),
      createdAt: currentSnapshot.exists()
        ? currentSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const savedSnapshot = await getDoc(schoolRef);
  return normalizeSchool(savedSnapshot);
}
