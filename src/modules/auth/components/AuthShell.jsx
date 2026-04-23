export function AuthShell({ children }) {
  return (
    <div className="auth-screen">
      <section className="auth-screen__intro">
        <div className="auth-screen__intro-panel">
          <p className="auth-screen__eyebrow">Timetable Pro</p>
          <h1 className="auth-screen__title">Authentication foundation for Thai schools</h1>
          <p className="auth-screen__copy">
            This phase only delivers secure sign-in, role-based access, Firestore profile sync,
            and automatic redirect into protected routes.
          </p>

          <div className="auth-screen__highlights" aria-label="Auth capabilities">
            <div>
              <span className="auth-screen__metric">Google</span>
              <p>Popup sign-in for fast teacher and admin access.</p>
            </div>
            <div>
              <span className="auth-screen__metric">Email</span>
              <p>Email/password sign-in and registration with profile creation.</p>
            </div>
            <div>
              <span className="auth-screen__metric">Roles</span>
              <p>super_admin, school_admin, academic_admin, teacher, and student.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="auth-screen__form-area">{children}</section>
    </div>
  );
}
