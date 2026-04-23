export function SelectField({ children, label, ...props }) {
  return (
    <label className="form-field">
      <span className="form-field__label">{label}</span>
      <select className="form-field__control" {...props}>
        {children}
      </select>
    </label>
  );
}
