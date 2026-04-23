export function FormMessage({ children, tone = 'info' }) {
  return <div className={`form-message form-message--${tone}`}>{children}</div>;
}
