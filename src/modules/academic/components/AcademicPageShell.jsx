import { NavLink } from 'react-router-dom';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { useAuth } from '../../auth/context/useAuth';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';

function buildSchoolOptions(schools, currentSchool) {
  const options = new Map();

  if (currentSchool?.schoolId) {
    options.set(currentSchool.schoolId, currentSchool);
  }

  schools.forEach((school) => {
    options.set(school.schoolId, school);
  });

  return Array.from(options.values());
}

export function AcademicPageShell({
  children,
  description,
  eyebrow = 'Academic Calendar',
  error,
  summary,
  title,
}) {
  const { profile } = useAuth();
  const { currentSchool, currentSchoolId, schools, setCurrentSchoolId } = useCurrentSchool();
  const schoolOptions = buildSchoolOptions(schools, currentSchool);
  const canViewDashboard = ['super_admin', 'school_admin', 'academic_admin', 'teacher'].includes(
    profile?.role,
  );

  return (
    <div className="academic-shell">
      <section className="academic-card">
        <header className="academic-card__header">
          <div className="academic-card__heading">
            <p className="auth-card__eyebrow">{eyebrow}</p>
            <h1 className="academic-card__title">{title}</h1>
            <p className="academic-card__copy">{description}</p>
          </div>

          <div className="academic-card__header-tools">
            <div className="academic-card__selector">
              <SelectField
                label="Current school"
                value={currentSchoolId || currentSchool.schoolId || ''}
                onChange={(event) => {
                  void setCurrentSchoolId(event.target.value);
                }}
              >
                {schoolOptions.map((school) => (
                  <option key={school.schoolId} value={school.schoolId}>
                    {school.name || school.schoolId}
                  </option>
                ))}
              </SelectField>
            </div>

            <StatusPill tone="info">
              schoolId: {currentSchoolId || currentSchool.schoolId || 'not set'}
            </StatusPill>
          </div>
        </header>

        <nav className="academic-nav" aria-label="Academic pages">
          {canViewDashboard ? (
            <NavLink
              to="/app/dashboard"
              className={({ isActive }) =>
                `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
              }
            >
              Dashboard
            </NavLink>
          ) : null}
          <NavLink
            to="/app/academic-years"
            className={({ isActive }) =>
              `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
            }
          >
            Academic Years
          </NavLink>
          <NavLink
            to="/app/terms"
            className={({ isActive }) =>
              `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
            }
          >
            Terms
          </NavLink>
          <NavLink
            to="/app/time-structure"
            className={({ isActive }) =>
              `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
            }
          >
            Time Structure
          </NavLink>
          <NavLink
            to="/app/plc-policy"
            className={({ isActive }) =>
              `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
            }
          >
            PLC Policy
          </NavLink>
          <NavLink
            to="/app/teacher-workload"
            className={({ isActive }) =>
              `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
            }
          >
            Teacher Workload
          </NavLink>
          <NavLink
            to="/app/master-data"
            className={({ isActive }) =>
              `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
            }
          >
            Master Data
          </NavLink>
          <NavLink
            to="/app/assignments"
            className={({ isActive }) =>
              `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
            }
          >
            Teaching Assignments
          </NavLink>
          <NavLink
            to="/app/timetable"
            className={({ isActive }) =>
              `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
            }
          >
            Timetable
          </NavLink>
          <NavLink
            to="/app/export"
            className={({ isActive }) =>
              `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
            }
          >
            Export
          </NavLink>
          <NavLink
            to="/app/teacher-absences"
            className={({ isActive }) =>
              `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
            }
          >
            Teacher Absences
          </NavLink>
          <NavLink
            to="/app/substitutions"
            className={({ isActive }) =>
              `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
            }
          >
            Substitutions
          </NavLink>
          <NavLink
            to="/app/school-settings"
            className={({ isActive }) =>
              `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
            }
          >
            School Settings
          </NavLink>
        </nav>

        {summary ? <section className="academic-summary">{summary}</section> : null}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}

        <div className="academic-card__body">{children}</div>
      </section>
    </div>
  );
}
