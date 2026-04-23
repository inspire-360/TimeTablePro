import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../../core/firebase/client';
import { DEFAULT_AUTH_ROLE, isValidAuthRole } from '../constants/authRoles';
import { resolveDefaultSchoolId } from '../../schools/constants/defaultSchool';

function normalizeSchoolId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function collectProviderIds(user, existingProviders = []) {
  const nextProviders = user.providerData
    .map((provider) => provider.providerId)
    .filter(Boolean);

  return [...new Set([...existingProviders, ...nextProviders])];
}

function normalizeUserProfile(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    uid: data.uid,
    schoolId: data.schoolId,
    role: data.role,
    displayName: data.displayName,
    email: data.email,
    photoURL: data.photoURL || '',
    providers: Array.isArray(data.providers) ? data.providers : [],
    status: data.status || 'active',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    lastLoginAt: data.lastLoginAt ?? null,
  };
}

function buildCreateProfile(user, profileInput = {}) {
  const schoolId = resolveDefaultSchoolId(normalizeSchoolId(profileInput.schoolId));

  const role = isValidAuthRole(profileInput.role) ? profileInput.role : DEFAULT_AUTH_ROLE;
  const displayName =
    profileInput.displayName?.trim() ||
    user.displayName ||
    user.email?.split('@')[0] ||
    'New User';

  return {
    uid: user.uid,
    schoolId,
    role,
    displayName,
    email: user.email || '',
    photoURL: user.photoURL || '',
    providers: collectProviderIds(user),
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };
}

function buildExistingProfile(user, existingProfile, profileInput = {}) {
  return {
    uid: user.uid,
    schoolId: existingProfile.schoolId,
    role: existingProfile.role,
    displayName:
      profileInput.displayName?.trim() ||
      user.displayName ||
      existingProfile.displayName ||
      'User',
    email: user.email || existingProfile.email || '',
    photoURL: user.photoURL || existingProfile.photoURL || '',
    providers: collectProviderIds(user, existingProfile.providers),
    status: existingProfile.status || 'active',
    createdAt: existingProfile.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };
}

export async function getUserProfile(uid) {
  const userProfileRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userProfileRef);

  if (!snapshot.exists()) {
    return null;
  }

  return normalizeUserProfile(snapshot);
}

export async function syncUserProfile(user, profileInput = {}) {
  const userProfileRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userProfileRef);

  const nextProfile = snapshot.exists()
    ? buildExistingProfile(user, snapshot.data(), profileInput)
    : buildCreateProfile(user, profileInput);

  await setDoc(userProfileRef, nextProfile, { merge: true });

  const syncedSnapshot = await getDoc(userProfileRef);
  return normalizeUserProfile(syncedSnapshot);
}
