import { useState } from 'react';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';

export function OfferingManager({
  classOfferings,
  onCreateOffering,
  onDeleteOffering,
  onSelectOffering,
  selectedClass,
  selectedOfferingId,
  subjects,
}) {
  const [form, setForm] = useState({
    subjectId: '',
    status: 'active',
  });
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const activeSubjects = subjects.filter((subject) => subject.status === 'active');

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedClass) {
      setFeedback({ tone: 'error', message: 'Select a class before adding subject offerings.' });
      return;
    }

    if (!form.subjectId) {
      setFeedback({ tone: 'error', message: 'Select a subject before saving the class offering.' });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      const successMessage = await onCreateOffering(form);
      setFeedback({ tone: 'success', message: successMessage });
      setForm({
        subjectId: '',
        status: 'active',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to save the class offering.',
      });
    }
  }

  async function handleDelete(offering) {
    const confirmed = window.confirm(
      `Delete subject offering "${offering.subjectName}" from ${offering.className}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      const successMessage = await onDeleteOffering(offering);
      setFeedback({ tone: 'success', message: successMessage });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to delete the class offering.',
      });
    }
  }

  return (
    <section className="academic-list-card">
      <div className="academic-list-card__header">
        <div>
          <p className="auth-card__eyebrow">classOfferings collection</p>
          <h2 className="academic-list-card__title">Subject Offerings</h2>
        </div>
        <StatusPill tone="info">{classOfferings.length} offerings</StatusPill>
      </div>

      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      {!selectedClass ? (
        <p className="academic-empty-state">
          Select a class to manage its subject offerings and section assignments.
        </p>
      ) : (
        <>
          <form className="academic-form" onSubmit={handleSubmit}>
            <div className="settings-grid">
              <SelectField
                label="Subject"
                value={form.subjectId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subjectId: event.target.value,
                  }))
                }
              >
                <option value="">Select subject</option>
                {activeSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {[subject.code, subject.name, subject.subjectType]
                      .filter(Boolean)
                      .join(' | ')}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Status"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </SelectField>
            </div>

            <button type="submit" className="primary-button">
              Save subject offering
            </button>
          </form>

          <div className="academic-record-list">
            {classOfferings.length === 0 ? (
              <p className="academic-empty-state">
                No subject offerings have been created for this class yet.
              </p>
            ) : (
              classOfferings.map((offering) => (
                <article
                  key={offering.id}
                  className={`master-data-record-card${
                    selectedOfferingId === offering.id ? ' master-data-record-card--active' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="master-data-record-card__content"
                    onClick={() => onSelectOffering(offering.id)}
                  >
                    <div className="master-data-record-card__heading">
                      <div className="master-data-record-card__title-group">
                        {offering.colorHex ? (
                          <span
                            className="master-data-color-dot"
                            style={{ backgroundColor: offering.colorHex }}
                            aria-hidden="true"
                          />
                        ) : null}
                        <div>
                          <h3>{offering.subjectName}</h3>
                          <p>
                            {[offering.subjectCode, offering.learningAreaName]
                              .filter(Boolean)
                              .join(' | ')}
                          </p>
                        </div>
                      </div>

                      <div className="academic-record-card__actions">
                        <StatusPill tone="info">{offering.subjectType}</StatusPill>
                        <StatusPill
                          tone={offering.status === 'active' ? 'success' : 'neutral'}
                        >
                          {offering.status}
                        </StatusPill>
                      </div>
                    </div>
                  </button>

                  <div className="academic-record-card__actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => onSelectOffering(offering.id)}
                    >
                      Manage
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleDelete(offering)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
