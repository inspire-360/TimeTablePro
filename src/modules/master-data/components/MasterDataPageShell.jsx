import { NavLink } from 'react-router-dom';
import { AcademicPageShell } from '../../academic/components/AcademicPageShell';
import { MASTER_DATA_NAV_ITEMS } from '../config/masterDataConfigs';

export function MasterDataPageShell({
  children,
  description,
  error,
  summary,
  title,
}) {
  return (
    <AcademicPageShell
      eyebrow="Master Data"
      title={title}
      description={description}
      error={error}
      summary={summary}
    >
      <div className="master-data-stack">
        <nav className="master-data-nav" aria-label="Master data pages">
          {MASTER_DATA_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.entityKey}
              to={item.route}
              className={({ isActive }) =>
                `master-data-nav__link${isActive ? ' master-data-nav__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {children}
      </div>
    </AcademicPageShell>
  );
}
