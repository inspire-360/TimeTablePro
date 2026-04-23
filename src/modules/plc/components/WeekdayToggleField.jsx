export function WeekdayToggleField({
  disabled = false,
  helper = '',
  label,
  onToggle,
  selectedKeys = [],
  weekdays = [],
}) {
  const selectedKeySet = new Set(selectedKeys);

  return (
    <div className="form-field">
      <span className="form-field__label">{label}</span>

      <div className="plc-chip-grid">
        {weekdays.map((weekday) => {
          const isActive = selectedKeySet.has(weekday.key);

          return (
            <button
              key={weekday.key}
              type="button"
              className={`plc-chip${isActive ? ' plc-chip--active' : ''}`}
              onClick={() => onToggle(weekday.key)}
              disabled={disabled}
            >
              {weekday.label}
            </button>
          );
        })}
      </div>

      {helper ? <p className="plc-helper-text">{helper}</p> : null}
    </div>
  );
}
