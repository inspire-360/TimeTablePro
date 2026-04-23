import { useMemo } from 'react';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { getTimetableTypeEmptyLabel, getTimetableTypeLabel } from '../constants/timetableOptions';

function buildSlotRows(weekdays, timeSlotsByWeekday) {
  const rowCount = weekdays.reduce((highest, weekday) => {
    const slots = timeSlotsByWeekday.get(weekday.key) || [];
    return Math.max(highest, slots.length);
  }, 0);

  return Array.from({ length: rowCount }, (_, index) => index + 1);
}

function buildEntrySubtitle(entry, viewType) {
  if (viewType === 'teacher') {
    return [entry.className, entry.classroomName].filter(Boolean).join(' | ');
  }

  if (viewType === 'room') {
    return [entry.className, entry.teacherDisplay].filter(Boolean).join(' | ');
  }

  return [entry.sectionType === 'subgroup' ? entry.sectionName : '', entry.teacherDisplay, entry.classroomName]
    .filter(Boolean)
    .join(' | ');
}

export function TimetableGrid({
  entries,
  onSelectTimeSlot,
  selectedTimeSlotId,
  timeSlotsByWeekday,
  timetableType,
  weekdays,
}) {
  const slotRows = useMemo(
    () => buildSlotRows(weekdays, timeSlotsByWeekday),
    [timeSlotsByWeekday, weekdays],
  );
  const entryMap = useMemo(() => {
    const nextMap = new Map();

    entries.forEach((entry) => {
      const key = entry.timeSlotId;
      const currentEntries = nextMap.get(key) || [];
      nextMap.set(key, [...currentEntries, entry]);
    });

    return nextMap;
  }, [entries]);

  return (
    <section className="academic-list-card">
      <div className="academic-list-card__header">
        <div>
          <p className="auth-card__eyebrow">Dynamic timetable grid</p>
          <h2 className="academic-list-card__title">{getTimetableTypeLabel(timetableType)}</h2>
        </div>
        <StatusPill tone="info">Entries: {entries.length}</StatusPill>
      </div>

      {weekdays.length === 0 || slotRows.length === 0 ? (
        <p className="academic-empty-state">
          Configure daily schedules and time slots before building the timetable grid.
        </p>
      ) : (
        <div className="timetable-grid-shell">
          <table className="timetable-grid">
            <thead>
              <tr>
                <th>Slot</th>
                {weekdays.map((weekday) => (
                  <th key={weekday.key}>
                    <div className="timetable-grid__day">
                      <strong>{weekday.label}</strong>
                      <span>{(timeSlotsByWeekday.get(weekday.key) || []).length} slots</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slotRows.map((slotIndex) => (
                <tr key={slotIndex}>
                  <th className="timetable-grid__row-label">
                    <strong>Slot {slotIndex}</strong>
                    <span>Dynamic timing</span>
                  </th>

                  {weekdays.map((weekday) => {
                    const weekdaySlots = timeSlotsByWeekday.get(weekday.key) || [];
                    const slot = weekdaySlots[slotIndex - 1] || null;
                    const cellEntries = slot ? entryMap.get(slot.id) || [] : [];
                    const isSelected = Boolean(slot) && selectedTimeSlotId === slot.id;
                    const isTeachingSlot = slot?.slotType === 'teaching';

                    if (!slot) {
                      return (
                        <td key={`${weekday.key}-${slotIndex}`}>
                          <div className="timetable-grid__cell timetable-grid__cell--missing">No slot</div>
                        </td>
                      );
                    }

                    return (
                      <td key={slot.id}>
                        <button
                          type="button"
                          className={`timetable-grid__cell${
                            isSelected ? ' timetable-grid__cell--selected' : ''
                          }${!isTeachingSlot ? ' timetable-grid__cell--support' : ''}`}
                          disabled={!isTeachingSlot}
                          onClick={() => {
                            if (isTeachingSlot) {
                              onSelectTimeSlot(slot.id);
                            }
                          }}
                        >
                          <div className="timetable-grid__cell-head">
                            <strong>
                              {slot.startTime} - {slot.endTime}
                            </strong>
                            <StatusPill tone={isTeachingSlot ? 'neutral' : 'info'}>
                              {slot.slotType}
                            </StatusPill>
                          </div>

                          {cellEntries.length === 0 ? (
                            <span className="timetable-grid__empty">
                              {isTeachingSlot
                                ? getTimetableTypeEmptyLabel(timetableType)
                                : 'Non-teaching block'}
                            </span>
                          ) : (
                            <span className="timetable-grid__entries">
                              {cellEntries.map((entry) => (
                                <span key={entry.id} className="timetable-grid__entry">
                                  <strong>{entry.subjectShortName || entry.subjectName}</strong>
                                  <span>{buildEntrySubtitle(entry, timetableType)}</span>
                                </span>
                              ))}
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
