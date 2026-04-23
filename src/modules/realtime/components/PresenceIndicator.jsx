import { FormMessage } from '../../../shared/ui/FormMessage';
import { StatusPill } from '../../../shared/ui/StatusPill';

function getInitials(label) {
  const words = String(label || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 'U';
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

function PresencePerson({ isCurrentUser, session }) {
  return (
    <article className="presence-indicator__person">
      {session.userPhotoURL ? (
        <img
          alt={session.userDisplayName || 'Editor'}
          className="presence-indicator__avatar"
          src={session.userPhotoURL}
        />
      ) : (
        <div className="presence-indicator__avatar presence-indicator__avatar--placeholder">
          {getInitials(session.userDisplayName)}
        </div>
      )}

      <div className="presence-indicator__person-copy">
        <strong>{session.userDisplayName || 'Editor'}</strong>
        <span>
          {[session.userRole || '', isCurrentUser ? 'You' : 'Active now']
            .filter(Boolean)
            .join(' | ')}
        </span>
      </div>
    </article>
  );
}

export function PresenceIndicator({
  activeSessions,
  currentUserId = '',
  error,
  otherEditors,
  resourceLabel,
  softLockActive,
  status,
  supportsEditing = true,
}) {
  if (!supportsEditing) {
    return (
      <div className="presence-indicator presence-indicator--neutral">
        <div className="presence-indicator__header">
          <div>
            <p className="auth-card__eyebrow">Realtime presence</p>
            <h3 className="academic-list-card__title">Live Updates Enabled</h3>
          </div>
          <StatusPill tone="info">Read-only view</StatusPill>
        </div>

        <p className="presence-indicator__helper">
          Teacher and room views refresh live from class timetable changes. Switch to class view to
          start an editing session.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`presence-indicator${
        softLockActive
          ? ' presence-indicator--warning'
          : activeSessions.length > 0
            ? ' presence-indicator--success'
            : ' presence-indicator--neutral'
      }`}
    >
      <div className="presence-indicator__header">
        <div>
          <p className="auth-card__eyebrow">Realtime presence</p>
          <h3 className="academic-list-card__title">Editing Session</h3>
          <p className="presence-indicator__helper">
            {resourceLabel || 'Select a class, active term, and time structure to start live editing.'}
          </p>
          {otherEditors.length > 0 ? (
            <p className="presence-indicator__helper">
              Other active editors: {otherEditors.length}
            </p>
          ) : null}
        </div>

        <StatusPill tone={softLockActive ? 'warning' : activeSessions.length > 0 ? 'success' : 'neutral'}>
          {softLockActive
            ? 'Soft lock active'
            : activeSessions.length > 0
              ? 'Live editors online'
              : 'No active editors'}
        </StatusPill>
      </div>

      {status === 'loading' ? (
        <FormMessage tone="info">Connecting to live timetable presence.</FormMessage>
      ) : null}

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      {softLockActive ? (
        <FormMessage tone="warning">
          Another editor is active on this class timetable. Live updates continue, but saving and
          removing lessons are paused until the soft lock clears.
        </FormMessage>
      ) : null}

      {activeSessions.length === 0 ? (
        <p className="presence-indicator__empty">
          Nobody is actively editing this timetable right now.
        </p>
      ) : (
        <div className="presence-indicator__list">
          {activeSessions.map((session) => (
            <PresencePerson
              key={session.id}
              isCurrentUser={Boolean(currentUserId) && session.userId === currentUserId}
              session={session}
            />
          ))}
        </div>
      )}
    </div>
  );
}
