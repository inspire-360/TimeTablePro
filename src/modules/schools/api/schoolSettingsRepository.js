import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../../core/firebase/client';

function normalizeSignature(signature = {}, schoolId, index) {
  return {
    id: signature.id || `signature-${index + 1}`,
    schoolId,
    name: (signature.name || '').trim(),
    title: (signature.title || '').trim(),
    imageUrl: (signature.imageUrl || '').trim(),
    sortOrder: Number.isFinite(signature.sortOrder) ? signature.sortOrder : index,
  };
}

function normalizeSchoolSettings(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    signatures: Array.isArray(data.signatures)
      ? data.signatures.map((signature, index) =>
          normalizeSignature(signature, data.schoolId, index),
        )
      : [],
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export function createDraftSchoolSettings(schoolId = '') {
  return {
    id: schoolId,
    schoolId,
    signatures: [],
    createdAt: null,
    updatedAt: null,
  };
}

export async function getSchoolSettingsById(schoolId) {
  if (!schoolId) {
    return createDraftSchoolSettings('');
  }

  const snapshot = await getDoc(doc(db, 'schoolSettings', schoolId));
  return snapshot.exists() ? normalizeSchoolSettings(snapshot) : createDraftSchoolSettings(schoolId);
}

export function subscribeSchoolSettingsById({ onChange, onError, schoolId }) {
  if (!schoolId) {
    onChange(createDraftSchoolSettings(''));
    return () => {};
  }

  return onSnapshot(
    doc(db, 'schoolSettings', schoolId),
    (snapshot) => {
      onChange(
        snapshot.exists()
          ? normalizeSchoolSettings(snapshot)
          : createDraftSchoolSettings(schoolId),
      );
    },
    onError,
  );
}

export async function upsertSchoolSettings({ schoolId, signatures }) {
  const schoolSettingsRef = doc(db, 'schoolSettings', schoolId);
  const currentSnapshot = await getDoc(schoolSettingsRef);
  const normalizedSignatures = signatures
    .map((signature, index) => normalizeSignature(signature, schoolId, index))
    .filter((signature) => signature.name || signature.title || signature.imageUrl);

  await setDoc(
    schoolSettingsRef,
    {
      schoolId,
      signatures: normalizedSignatures,
      createdAt: currentSnapshot.exists()
        ? currentSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const savedSnapshot = await getDoc(schoolSettingsRef);
  return normalizeSchoolSettings(savedSnapshot);
}
