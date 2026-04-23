import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';

export const EDITING_SESSION_HEARTBEAT_MS = 30000;
export const EDITING_SESSION_TTL_MS = 90000;

function normalizeEditingSession(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId || '',
    resourceType: data.resourceType || '',
    resourceId: data.resourceId || '',
    resourceLabel: data.resourceLabel || '',
    ownerType: data.ownerType || '',
    ownerId: data.ownerId || '',
    ownerLabel: data.ownerLabel || '',
    userId: data.userId || '',
    userDisplayName: data.userDisplayName || '',
    userEmail: data.userEmail || '',
    userPhotoURL: data.userPhotoURL || '',
    userRole: data.userRole || '',
    lockMode: data.lockMode || 'soft',
    heartbeatAtMs: Number(data.heartbeatAtMs) || 0,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export function buildEditingSessionId({ resourceId, userId }) {
  return [resourceId, userId].filter(Boolean).join('--');
}

export function isEditingSessionActive(
  session,
  { nowMs = Date.now(), ttlMs = EDITING_SESSION_TTL_MS } = {},
) {
  if (!session?.heartbeatAtMs) {
    return false;
  }

  return nowMs - session.heartbeatAtMs <= ttlMs;
}

export async function upsertEditingSession({
  heartbeatAtMs = Date.now(),
  ownerId,
  ownerLabel,
  ownerType,
  resourceId,
  resourceLabel,
  resourceType,
  schoolId,
  userEmail,
  userId,
  userDisplayName,
  userPhotoURL,
  userRole,
}) {
  if (!schoolId || !resourceType || !resourceId || !userId) {
    throw new Error('A valid realtime editing scope is required before starting an editing session.');
  }

  const sessionId = buildEditingSessionId({
    resourceId,
    userId,
  });
  const sessionRef = doc(db, 'editingSessions', sessionId);
  const existingSnapshot = await getDoc(sessionRef);

  await setDoc(
    sessionRef,
    {
      schoolId,
      resourceType,
      resourceId,
      resourceLabel: resourceLabel || '',
      ownerType: ownerType || '',
      ownerId: ownerId || '',
      ownerLabel: ownerLabel || '',
      userId,
      userDisplayName: userDisplayName || 'User',
      userEmail: userEmail || '',
      userPhotoURL: userPhotoURL || '',
      userRole: userRole || '',
      lockMode: 'soft',
      heartbeatAtMs,
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return sessionId;
}

export async function removeEditingSession(sessionId) {
  if (!sessionId) {
    return;
  }

  await deleteDoc(doc(db, 'editingSessions', sessionId));
}

export function subscribeEditingSessions({
  onChange,
  onError,
  resourceId,
  resourceType,
  schoolId,
}) {
  if (!schoolId || !resourceType || !resourceId) {
    onChange([]);
    return () => {};
  }

  const sessionsQuery = query(
    collection(db, 'editingSessions'),
    where('schoolId', '==', schoolId),
    where('resourceType', '==', resourceType),
    where('resourceId', '==', resourceId),
    orderBy('updatedAt', 'desc'),
  );

  return onSnapshot(
    sessionsQuery,
    (snapshot) => {
      onChange(snapshot.docs.map(normalizeEditingSession));
    },
    onError,
  );
}
