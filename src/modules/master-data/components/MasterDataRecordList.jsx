import { useState } from 'react';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { StatusPill } from '../../../shared/ui/StatusPill';

export function MasterDataRecordList({
  config,
  dependencies,
  onDeleteRecord,
  onSelectNew,
  onSelectRecord,
  records,
  selectedRecordId,
}) {
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const [pendingDeleteId, setPendingDeleteId] = useState('');

  async function handleDelete(record) {
    const confirmed = window.confirm(
      `Delete ${config.singularLabel.toLowerCase()} "${record.name || record.displayName || record.code || 'record'}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setPendingDeleteId(record.id);
      setFeedback({ tone: '', message: '' });
      const successMessage = await onDeleteRecord(record);
      setFeedback({ tone: 'success', message: successMessage });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : `Unable to delete the ${config.singularLabel.toLowerCase()}.`,
      });
    } finally {
      setPendingDeleteId('');
    }
  }

  return (
    <section className="academic-list-card">
      <div className="academic-list-card__header">
        <div>
          <p className="auth-card__eyebrow">{config.collectionLabel}</p>
          <h2 className="academic-list-card__title">{config.title}</h2>
        </div>
        <button type="button" className="secondary-button" onClick={onSelectNew}>
          New {config.singularLabel.toLowerCase()}
        </button>
      </div>

      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      <div className="academic-record-list">
        {records.length === 0 ? (
          <p className="academic-empty-state">
            No {config.navLabel.toLowerCase()} have been created for this school yet.
          </p>
        ) : (
          records.map((record) => {
            const summary = config.buildRecordSummary(record, { dependencies });
            const isActive = selectedRecordId === record.id;

            return (
              <article
                key={record.id}
                className={`master-data-record-card${
                  isActive ? ' master-data-record-card--active' : ''
                }`}
              >
                <button
                  type="button"
                  className="master-data-record-card__content"
                  onClick={() => onSelectRecord(record.id)}
                >
                  <div className="master-data-record-card__heading">
                    <div className="master-data-record-card__title-group">
                      {summary.colorHex ? (
                        <span
                          className="master-data-color-dot"
                          style={{ backgroundColor: summary.colorHex }}
                          aria-hidden="true"
                        />
                      ) : null}
                      <div>
                        <h3>{summary.title}</h3>
                        {summary.subtitle ? <p>{summary.subtitle}</p> : null}
                      </div>
                    </div>

                    <div className="academic-record-card__actions">
                      {summary.badges?.map((badge) => (
                        <StatusPill key={`${record.id}-${badge.label}`} tone={badge.tone}>
                          {badge.label}
                        </StatusPill>
                      ))}
                    </div>
                  </div>

                  {summary.lines?.map((line) => (
                    <p key={`${record.id}-${line}`}>{line}</p>
                  ))}
                </button>

                <div className="academic-record-card__actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onSelectRecord(record.id)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void handleDelete(record)}
                    disabled={pendingDeleteId === record.id}
                  >
                    {pendingDeleteId === record.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
