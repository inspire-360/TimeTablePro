import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/context/useAuth';
import {
  buildEditingSessionId,
  EDITING_SESSION_HEARTBEAT_MS,
  isEditingSessionActive,
  removeEditingSession,
  subscribeEditingSessions,
  upsertEditingSession,
} from '../api/editingSessionRepository';

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

export function useEditingSession({ enabled, resource, schoolId }) {
  const { profile, user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isReady = Boolean(
    enabled &&
      schoolId &&
      resource?.resourceId &&
      resource?.resourceType &&
      user?.uid,
  );
  const sessionId = isReady
    ? buildEditingSessionId({
        resourceId: resource.resourceId,
        userId: user.uid,
      })
    : '';

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    const timeoutId = window.setTimeout(() => {
      if (!isReady) {
        setSessions([]);
        setStatus('idle');
        setError('');
        return;
      }

      setSessions([]);
      setStatus('loading');
      setError('');
      unsubscribe = subscribeEditingSessions({
        schoolId,
        resourceId: resource.resourceId,
        resourceType: resource.resourceType,
        onChange: (nextSessions) => {
          setSessions(nextSessions);
          setStatus('ready');
          setError('');
        },
        onError: (snapshotError) => {
          setStatus('error');
          setError(getErrorMessage(snapshotError, 'Unable to load the live editing presence.'));
        },
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [isReady, resource?.resourceId, resource?.resourceType, schoolId]);

  useEffect(() => {
    if (!isReady || !sessionId) {
      return undefined;
    }

    let disposed = false;

    async function writeHeartbeat() {
      try {
        await upsertEditingSession({
          schoolId,
          resourceId: resource.resourceId,
          resourceLabel: resource.resourceLabel,
          resourceType: resource.resourceType,
          ownerId: resource.ownerId,
          ownerLabel: resource.ownerLabel,
          ownerType: resource.ownerType,
          userId: user.uid,
          userDisplayName:
            profile?.displayName?.trim() ||
            user.displayName ||
            user.email ||
            'User',
          userEmail: profile?.email || user.email || '',
          userPhotoURL: profile?.photoURL || user.photoURL || '',
          userRole: profile?.role || '',
        });
      } catch (heartbeatError) {
        if (!disposed) {
          setError(getErrorMessage(heartbeatError, 'Unable to keep your editing session active.'));
        }
      }
    }

    function handlePageLeave() {
      void removeEditingSession(sessionId);
    }

    void writeHeartbeat();

    const intervalId = window.setInterval(() => {
      void writeHeartbeat();
    }, EDITING_SESSION_HEARTBEAT_MS);

    window.addEventListener('beforeunload', handlePageLeave);
    window.addEventListener('pagehide', handlePageLeave);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener('beforeunload', handlePageLeave);
      window.removeEventListener('pagehide', handlePageLeave);
      void removeEditingSession(sessionId);
    };
  }, [
    isReady,
    profile?.displayName,
    profile?.email,
    profile?.photoURL,
    profile?.role,
    resource?.ownerId,
    resource?.ownerLabel,
    resource?.ownerType,
    resource?.resourceId,
    resource?.resourceLabel,
    resource?.resourceType,
    schoolId,
    sessionId,
    user?.displayName,
    user?.email,
    user?.photoURL,
    user?.uid,
  ]);

  const activeSessions = useMemo(
    () => sessions.filter((session) => isEditingSessionActive(session, { nowMs })),
    [nowMs, sessions],
  );
  const currentUserSession = useMemo(
    () => activeSessions.find((session) => session.userId === user?.uid) || null,
    [activeSessions, user?.uid],
  );
  const otherEditors = useMemo(
    () => activeSessions.filter((session) => session.userId !== user?.uid),
    [activeSessions, user?.uid],
  );

  return {
    activeSessions: isReady ? activeSessions : [],
    currentUserSession: isReady ? currentUserSession : null,
    error,
    otherEditors: isReady ? otherEditors : [],
    softLockActive: isReady && otherEditors.length > 0,
    status: isReady ? status : 'idle',
  };
}
