import { Link } from 'react-router-dom';

export function DashboardSectionCard({
  actionHref = '',
  actionLabel = '',
  children,
  description = '',
  eyebrow = '',
  title,
}) {
  return (
    <section className="dashboard-section-card">
      <header className="dashboard-section-card__header">
        <div className="dashboard-section-card__heading">
          {eyebrow ? <p className="auth-card__eyebrow">{eyebrow}</p> : null}
          <h2 className="academic-list-card__title">{title}</h2>
          {description ? <p className="academic-card__copy">{description}</p> : null}
        </div>

        {actionHref && actionLabel ? (
          <Link className="dashboard-section-card__action" to={actionHref}>
            {actionLabel}
          </Link>
        ) : null}
      </header>

      <div className="dashboard-section-card__body">{children}</div>
    </section>
  );
}
