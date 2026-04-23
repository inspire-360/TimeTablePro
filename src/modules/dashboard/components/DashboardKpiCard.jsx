import { StatusPill } from '../../../shared/ui/StatusPill';

function formatValue(value) {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }

  return value || '0';
}

export function DashboardKpiCard({ description = '', label, tone = 'neutral', value }) {
  return (
    <article className={`dashboard-kpi-card dashboard-kpi-card--${tone}`}>
      <div className="dashboard-kpi-card__top">
        <StatusPill tone={tone}>{label}</StatusPill>
      </div>
      <strong className="dashboard-kpi-card__value">{formatValue(value)}</strong>
      {description ? <p className="dashboard-kpi-card__description">{description}</p> : null}
    </article>
  );
}
