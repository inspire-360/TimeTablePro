import { DashboardKpiCard } from './DashboardKpiCard';

export function DashboardKpiGrid({ items = [] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="dashboard-kpi-grid" aria-label="Dashboard KPIs">
      {items.map((item) => (
        <DashboardKpiCard
          key={item.label}
          description={item.description}
          label={item.label}
          tone={item.tone}
          value={item.value}
        />
      ))}
    </section>
  );
}
