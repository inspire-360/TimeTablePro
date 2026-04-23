import { saveTimetableBundle } from '../api/timetableRepository';
import { getPrimaryConflictMessage, hasConflictErrors } from './conflict';
import { getBestSlotSuggestion } from './suggestionEngine';

export async function autoPlaceSubject({
  saveBundle = saveTimetableBundle,
  suggestionResult,
}) {
  const bestSuggestion = getBestSlotSuggestion(suggestionResult);

  if (!bestSuggestion) {
    throw new Error('No available teaching slot was found for the selected subject.');
  }

  if (!bestSuggestion.bundle?.entry?.id) {
    throw new Error('The suggested slot is missing timetable payload data.');
  }

  if (hasConflictErrors(bestSuggestion.conflicts)) {
    throw new Error(getPrimaryConflictMessage(bestSuggestion.conflicts));
  }

  const savedEntry = await saveBundle(bestSuggestion.bundle);

  return {
    savedEntry,
    suggestion: bestSuggestion,
  };
}
