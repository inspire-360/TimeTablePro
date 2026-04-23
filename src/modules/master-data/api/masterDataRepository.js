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
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';

function normalizeMasterDataRecord(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    ...data,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listMasterDataRecords({ collectionName, schoolId }) {
  if (!schoolId) {
    return [];
  }

  const recordsQuery = query(
    collection(db, collectionName),
    where('schoolId', '==', schoolId),
    orderBy('updatedAt', 'desc'),
  );
  const snapshot = await getDocs(recordsQuery);

  return snapshot.docs.map(normalizeMasterDataRecord);
}

export async function saveMasterDataRecord({
  collectionName,
  id,
  payload,
}) {
  const recordRef = id ? doc(db, collectionName, id) : doc(collection(db, collectionName));
  const existingSnapshot = await getDoc(recordRef);

  await setDoc(
    recordRef,
    {
      ...payload,
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const savedSnapshot = await getDoc(recordRef);
  return normalizeMasterDataRecord(savedSnapshot);
}

export async function deleteMasterDataRecord({ collectionName, id }) {
  await deleteDoc(doc(db, collectionName, id));
}
