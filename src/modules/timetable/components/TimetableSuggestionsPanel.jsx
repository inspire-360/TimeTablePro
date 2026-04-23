import { AppLoader } from '../../../shared/ui/AppLoader';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { StatusPill } from '../../../shared/ui/StatusPill';

function buildSuggestionTone(suggestion) {
  if (suggestion.availability.warningCount > 0) {
    return 'warning';
  }

  return 'success';
}

export function TimetableSuggestionsPanel({
  canSuggest,
  isAutoPlacing,
  isLoading,
  onAutoPlaceBest,
  onSelectSuggestion,
  selectedTimeSlotId,
  softLockActive,
  suggestionResult,
}) {
  const topSuggestions = suggestionResult.suggestions.slice(0, 6);
  const bestSuggestion = topSuggestions[0] || null;

  return (
    <section className="academic-list-card">
      <div className="academic-list-card__header">
        <div>
          <p className="auth-card__eyebrow">Smart scheduling</p>
          <h2 className="academic-list-card__title">Suggested Slots</h2>
        </div>
        <StatusPill tone={bestSuggestion ? 'success' : 'neutral'}>
          {suggestionResult.availableCount} available
        </StatusPill>
      </div>

      {!canSuggest ? (
        <FormMessage tone="info">
          Select a class, subject offering, section, room, active term, and time structure to
          generate smart scheduling suggestions.
        </FormMessage>
      ) : null}

      {isLoading ? <AppLoader label="Ranking available teaching slots" /> : null}

      {softLockActive ? (
        <FormMessage tone="warning">
          Suggestions remain visible during a soft lock, but auto placement is paused while another
          editor is active.
        </FormMessage>
      ) : null}

      {canSuggest && !isLoading ? (
        <div className="timetable-suggestions-summary">
          <StatusPill tone="info">Teaching slots: {suggestionResult.totalTeachingSlots}</StatusPill>
          <StatusPill tone="warning">Blocked: {suggestionResult.blockedCount}</StatusPill>
          <StatusPill tone="neutral">
            Review set: {topSuggestions.length === 0 ? 0 : topSuggestions.length}
          </StatusPill>
        </div>
      ) : null}

      {bestSuggestion ? (
        <div className="timetable-suggestions-actions">
          <button
            type="button"
            className="primary-button"
            disabled={isAutoPlacing || softLockActive}
            onClick={() => {
              void onAutoPlaceBest();
            }}
          >
            {isAutoPlacing ? 'Placing...' : 'Auto Place Best Slot'}
          </button>
        </div>
      ) : null}

      {canSuggest && !isLoading && topSuggestions.length === 0 ? (
        <FormMessage tone="warning">
          No conflict-free teaching slot is available for the selected subject and room in the
          current timetable context.
        </FormMessage>
      ) : null}

      {topSuggestions.length > 0 ? (
        <div className="timetable-suggestions-list">
          {topSuggestions.map((suggestion) => {
            const isSelected = selectedTimeSlotId === suggestion.slot.id;

            return (
              <article
                key={suggestion.id}
                className={`timetable-suggestion-card${
                  isSelected ? ' timetable-suggestion-card--selected' : ''
                }`}
              >
                <div className="timetable-suggestion-card__header">
                  <div>
                    <h3>
                      {suggestion.weekdayLabel || suggestion.slot.weekdayKey} |{' '}
                      {suggestion.slot.startTime} - {suggestion.slot.endTime}
                    </h3>
                    <p>{suggestion.label}</p>
                  </div>
                  <div className="academic-record-card__actions">
                    <StatusPill tone={buildSuggestionTone(suggestion)}>
                      Score: {suggestion.score}
                    </StatusPill>
                    {isSelected ? <StatusPill tone="info">Selected</StatusPill> : null}
                  </div>
                </div>

                <div className="academic-summary__grid">
                  <StatusPill tone={suggestion.availability.teacherAvailable ? 'success' : 'error'}>
                    Teacher free
                  </StatusPill>
                  <StatusPill tone={suggestion.availability.roomAvailable ? 'success' : 'error'}>
                    Room free
                  </StatusPill>
                  <StatusPill tone={suggestion.availability.plcAvailable ? 'success' : 'error'}>
                    PLC clear
                  </StatusPill>
                  <StatusPill tone={suggestion.availability.classAvailable ? 'success' : 'error'}>
                    Class free
                  </StatusPill>
                </div>

                <p className="timetable-suggestion-card__copy">
                  {suggestion.reasons.join(' | ')}
                </p>

                {suggestion.conflicts.warning[0]?.message ? (
                  <FormMessage tone="warning">
                    {suggestion.conflicts.warning[0].message}
                  </FormMessage>
                ) : null}

                <div className="timetable-suggestion-card__actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onSelectSuggestion(suggestion.slot.id)}
                  >
                    {isSelected ? 'Using This Slot' : 'Use This Slot'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
