import { getLearningAreaColor } from '../constants/learningAreaColors';

export function ColorTokenField({
  label,
  onChange,
  options,
  value,
}) {
  const selectedColor = getLearningAreaColor(value);

  return (
    <div className="form-field">
      <span className="form-field__label">{label}</span>

      <div className="color-token-grid">
        {options.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              className={`color-token-card${isActive ? ' color-token-card--active' : ''}`}
              onClick={() => onChange(option.value)}
            >
              <span
                className="color-token-card__swatch"
                style={{ backgroundColor: option.hex }}
                aria-hidden="true"
              />
              <span className="color-token-card__content">
                <strong>{option.label}</strong>
                <span>{option.hex}</span>
              </span>
            </button>
          );
        })}
      </div>

      <p className="plc-helper-text">
        Selected color: <code>{selectedColor.hex}</code>
      </p>
    </div>
  );
}
