import { useState } from 'react';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { MasterDataFieldRenderer } from './MasterDataFieldRenderer';

function buildFormState({
  config,
  dependencies,
  schoolId,
  selectedRecord,
}) {
  return config.buildInitialValues({
    dependencies,
    record: selectedRecord,
    schoolId,
  });
}

export function MasterDataFormCard({
  config,
  dependencies,
  schoolId,
  selectedRecord,
  onSave,
}) {
  const [form, setForm] = useState(() =>
    buildFormState({
      config,
      dependencies,
      schoolId,
      selectedRecord,
    }),
  );
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const dependencyNotice = config.getDependencyNotice?.({ dependencies }) || '';

  async function handleSubmit(event) {
    event.preventDefault();

    const validationMessage = config.validate(form, {
      dependencies,
      schoolId,
    });

    if (validationMessage) {
      setFeedback({ tone: 'error', message: validationMessage });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      const successMessage = await onSave(form);
      setFeedback({
        tone: 'success',
        message: successMessage,
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : `Unable to save the ${config.singularLabel.toLowerCase()}.`,
      });
    }
  }

  return (
    <section className="academic-form-card">
      {dependencyNotice ? <FormMessage tone="info">{dependencyNotice}</FormMessage> : null}
      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      <form className="academic-form" onSubmit={handleSubmit}>
        <div className="settings-grid">
          {config.fields.map((field) => (
            <MasterDataFieldRenderer
              key={field.name}
              context={{ config, dependencies, form, schoolId }}
              field={field}
              form={form}
              onChange={(fieldName, value) =>
                setForm((current) => ({
                  ...current,
                  [fieldName]: value,
                }))
              }
            />
          ))}
        </div>

        <button type="submit" className="primary-button">
          {selectedRecord?.id
            ? `Update ${config.singularLabel.toLowerCase()}`
            : `Create ${config.singularLabel.toLowerCase()}`}
        </button>
      </form>
    </section>
  );
}
