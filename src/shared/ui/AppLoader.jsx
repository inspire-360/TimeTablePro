export function AppLoader({ label }) {
  return (
    <div className="loader-shell">
      <div className="loader-panel">
        <span className="loader-spinner" aria-hidden="true" />
        <p className="loader-panel__eyebrow">Please wait</p>
        <h2>{label}</h2>
      </div>
    </div>
  );
}
