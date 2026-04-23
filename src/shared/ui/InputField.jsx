export function InputField({ label, ...props }) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      <input className="form-field__control" {...props} />
    </label>
  );
}
