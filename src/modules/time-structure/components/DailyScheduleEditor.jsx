import { StatusPill } from '../../../shared/ui/StatusPill';
import { getWeekdayOptions } from '../constants/timeStructureOptions';

function buildScheduleMap(dailySchedules) {
  return new Map(dailySchedules.map((dailySchedule) => [dailySchedule.weekdayKey, dailySchedule]));
}

export function DailyScheduleEditor({
  dailySchedules,
  selectedWeekdayKey,
  timeStructure,
  onSelectWeekday,
}) {
  const visibleWeekdays = getWeekdayOptions(timeStructure.daysPerWeek);
  const scheduleMap = buildScheduleMap(dailySchedules);

  return (
    <section className="academic-list-card">
      <div className="academic-list-card__header">
        <div>
          <p className="auth-card__eyebrow">dailySchedules collection</p>
          <h2 className="academic-list-card__title">Weekday schedules</h2>
        </div>
        <StatusPill tone="neutral">
          daysPerWeek: {timeStructure.daysPerWeek}
        </StatusPill>
      </div>

      <div className="weekday-grid">
        {visibleWeekdays.map((weekday) => {
          const dailySchedule = scheduleMap.get(weekday.key);
          const isActive = selectedWeekdayKey === weekday.key;

          return (
            <button
              key={weekday.key}
              type="button"
              className={`weekday-card${isActive ? ' weekday-card--active' : ''}`}
              onClick={() => onSelectWeekday(weekday.key)}
            >
              <div className="weekday-card__heading">
                <h3>{weekday.label}</h3>
                {dailySchedule?.slotCount ? (
                  <StatusPill tone="success">{dailySchedule.slotCount} slots</StatusPill>
                ) : (
                  <StatusPill tone="neutral">Not set</StatusPill>
                )}
              </div>
              <p>
                Teaching slots:{' '}
                <strong>{dailySchedule?.teachingSlotCount || 0}</strong> /{' '}
                {timeStructure.periodsPerDay}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
