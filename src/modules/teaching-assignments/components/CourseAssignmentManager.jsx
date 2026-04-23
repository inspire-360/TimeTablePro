import { useState } from 'react';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';

export function CourseAssignmentManager({
  assignments,
  onAddAssignment,
  onDeleteAssignment,
  selectedOffering,
  selectedSection,
  teachers,
}) {
  const [teacherId, setTeacherId] = useState('');
  const [feedback, setFeedback] = useState({ tone: '', message: '' });

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedSection) {
      setFeedback({ tone: 'error', message: 'Select a section before adding subject teachers.' });
      return;
    }

    if (!teacherId) {
      setFeedback({ tone: 'error', message: 'Select a teacher before saving the course assignment.' });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      const successMessage = await onAddAssignment(teacherId);
      setFeedback({ tone: 'success', message: successMessage });
      setTeacherId('');
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to save the course assignment.',
      });
    }
  }

  async function handleDelete(assignment) {
    const confirmed = window.confirm(
      `Remove ${assignment.teacherName} from section "${assignment.sectionName}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      const successMessage = await onDeleteAssignment(assignment);
      setFeedback({ tone: 'success', message: successMessage });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'Unable to delete the course assignment.',
      });
    }
  }

  return (
    <section className="academic-list-card">
      <div className="academic-list-card__header">
        <div>
          <p className="auth-card__eyebrow">courseAssignments collection</p>
          <h2 className="academic-list-card__title">Subject Teachers</h2>
        </div>
        {selectedSection ? (
          <StatusPill tone="info">{selectedSection.name}</StatusPill>
        ) : (
          <StatusPill tone="neutral">No section selected</StatusPill>
        )}
      </div>

      {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

      {!selectedOffering ? (
        <p className="academic-empty-state">
          Select a subject offering to assign teachers.
        </p>
      ) : !selectedSection ? (
        <p className="academic-empty-state">
          Select a section first. Multiple teachers can be assigned to the same subject section.
        </p>
      ) : (
        <>
          <form className="academic-form" onSubmit={handleSubmit}>
            <SelectField
              label="Subject teacher"
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              <option value="">Select teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {[teacher.displayName || 'Teacher', teacher.employeeCode || '']
                    .filter(Boolean)
                    .join(' | ')}
                </option>
              ))}
            </SelectField>

            <button type="submit" className="primary-button">
              Add subject teacher
            </button>
          </form>

          <div className="academic-record-list">
            {assignments.length === 0 ? (
              <p className="academic-empty-state">
                No teachers have been assigned to this section yet.
              </p>
            ) : (
              assignments.map((assignment) => (
                <article key={assignment.id} className="academic-record-card">
                  <div className="academic-record-card__header">
                    <div>
                      <h3>{assignment.teacherName}</h3>
                      <p>
                        {[assignment.teacherEmployeeCode, assignment.sectionName]
                          .filter(Boolean)
                          .join(' | ')}
                      </p>
                    </div>

                    <div className="academic-record-card__actions">
                      <StatusPill tone="info">{assignment.assignmentRole}</StatusPill>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleDelete(assignment)}
                      >
                        Remove
                      </button>
                    </div>
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
