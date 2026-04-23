import { useState } from 'react';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';

export function HomeroomTeacherCard({
  onSave,
  selectedClass,
  selectedTeacherId,
  teachers,
}) {
  const [homeRoomTeacherId, setHomeRoomTeacherId] = useState(selectedTeacherId || '');
  const [feedback, setFeedback] = useState({ tone: '', message: '' });

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedClass) {
      setFeedback({ tone: 'error', message: 'Select a class before assigning a homeroom teacher.' });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      const successMessage = await onSave(homeRoomTeacherId);
      setFeedback({ tone: 'success', message: successMessage });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to save the homeroom teacher assignment.',
      });
    }
  }

  return (
    <section className="academic-form-card">
      <div className="academic-list-card__header">
        <div>
          <p className="auth-card__eyebrow">Class homeroom</p>
          <h2 className="academic-list-card__title">Homeroom Teacher</h2>
        </div>
        {selectedClass ? (
          <StatusPill tone="info">{selectedClass.name}</StatusPill>
        ) : (
          <StatusPill tone="neutral">No class selected</StatusPill>
        )}
      </div>

      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      {!selectedClass ? (
        <p className="academic-empty-state">
          Choose a class first. The homeroom teacher continues to be stored on the class record.
        </p>
      ) : (
        <form className="academic-form" onSubmit={handleSubmit}>
          <SelectField
            label="Homeroom teacher"
            value={homeRoomTeacherId}
            onChange={(event) => setHomeRoomTeacherId(event.target.value)}
          >
            <option value="">No homeroom teacher assigned</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {[teacher.displayName || 'Teacher', teacher.employeeCode || '']
                  .filter(Boolean)
                  .join(' | ')}
              </option>
            ))}
          </SelectField>

          <button type="submit" className="primary-button">
            Save homeroom teacher
          </button>
        </form>
      )}
    </section>
  );
}
