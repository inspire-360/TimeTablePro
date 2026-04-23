import { useState } from 'react';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { InputField } from '../../../shared/ui/InputField';
import { StatusPill } from '../../../shared/ui/StatusPill';

export function SectionManager({
  onDeleteSection,
  onSaveSection,
  onSelectSection,
  sections,
  selectedOffering,
  selectedSectionId,
}) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    subgroupLabel: '',
    sortOrder: '2',
    status: 'active',
  });
  const [feedback, setFeedback] = useState({ tone: '', message: '' });

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setFeedback({ tone: '', message: '' });
      const successMessage = await onSaveSection(form);
      setFeedback({ tone: 'success', message: successMessage });
      setForm({
        code: '',
        name: '',
        subgroupLabel: '',
        sortOrder: String(sections.length + 1),
        status: 'active',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to save the subgroup section.',
      });
    }
  }

  async function handleDelete(section) {
    const confirmed = window.confirm(`Delete section "${section.name}"?`);

    if (!confirmed) {
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      const successMessage = await onDeleteSection(section);
      setFeedback({ tone: 'success', message: successMessage });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to delete the section.',
      });
    }
  }

  return (
    <section className="academic-list-card">
      <div className="academic-list-card__header">
        <div>
          <p className="auth-card__eyebrow">sections collection</p>
          <h2 className="academic-list-card__title">Sections</h2>
        </div>
        {selectedOffering ? (
          <StatusPill tone="info">{selectedOffering.subjectName}</StatusPill>
        ) : (
          <StatusPill tone="neutral">No offering selected</StatusPill>
        )}
      </div>

      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      {!selectedOffering ? (
        <p className="academic-empty-state">
          Select a subject offering to manage its full-class and subgroup sections.
        </p>
      ) : (
        <>
          <form className="academic-form" onSubmit={handleSubmit}>
            <div className="settings-grid">
              <InputField
                label="Section code"
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                placeholder="GROUP-A"
              />
              <InputField
                label="Section name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Subgroup A"
              />
              <InputField
                label="Subgroup label"
                value={form.subgroupLabel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subgroupLabel: event.target.value,
                  }))
                }
                placeholder="Group A"
              />
              <InputField
                label="Sort order"
                type="number"
                min="2"
                step="1"
                value={form.sortOrder}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sortOrder: event.target.value,
                  }))
                }
              />
            </div>

            <button type="submit" className="primary-button">
              Add subgroup section
            </button>
          </form>

          <div className="academic-record-list">
            {sections.map((section) => (
              <article
                key={section.id}
                className={`master-data-record-card${
                  selectedSectionId === section.id ? ' master-data-record-card--active' : ''
                }`}
              >
                <button
                  type="button"
                  className="master-data-record-card__content"
                  onClick={() => onSelectSection(section.id)}
                >
                  <div className="master-data-record-card__heading">
                    <div className="master-data-record-card__title-group">
                      <div>
                        <h3>{section.name}</h3>
                        <p>
                          {[section.code, section.subgroupLabel]
                            .filter(Boolean)
                            .join(' | ') || 'No subgroup label'}
                        </p>
                      </div>
                    </div>

                    <div className="academic-record-card__actions">
                      <StatusPill
                        tone={section.sectionType === 'full_class' ? 'success' : 'info'}
                      >
                        {section.sectionType}
                      </StatusPill>
                      {section.isDefault ? (
                        <StatusPill tone="neutral">Default</StatusPill>
                      ) : null}
                    </div>
                  </div>
                </button>

                <div className="academic-record-card__actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onSelectSection(section.id)}
                  >
                    Select
                  </button>
                  {!section.isDefault ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleDelete(section)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
