export function TextareaField({ label, rows = 4, ...props }) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      <textarea className="form-field__control textarea-field__control" rows={rows} {...props} />
    </label>
  );
}
