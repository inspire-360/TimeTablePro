import { NavLink } from 'react-router-dom';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { useAuth } from '../../auth/context/useAuth';
import { getAuthRoleLabel } from '../../auth/constants/authRoles';
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
  eyebrow = 'ระบบงานวิชาการ',
  error,
  summary,
  title,
}) {
  const { logout, profile } = useAuth();
  const { currentSchool, currentSchoolId, schools, setCurrentSchoolId } = useCurrentSchool();
  const schoolOptions = buildSchoolOptions(schools, currentSchool);
  const canViewDashboard = ['super_admin', 'school_admin', 'academic_admin', 'teacher'].includes(
    profile?.role,
  );
  const navigationItems = [
    ...(canViewDashboard
      ? [
          {
            label: 'แดชบอร์ด',
            to: '/app/dashboard',
          },
        ]
      : []),
    {
      label: 'ปีการศึกษา',
      to: '/app/academic-years',
    },
    {
      label: 'ภาคเรียน',
      to: '/app/terms',
    },
    {
      label: 'โครงสร้างเวลา',
      to: '/app/time-structure',
    },
    {
      label: 'นโยบาย PLC',
      to: '/app/plc-policy',
    },
    {
      label: 'ภาระงานครู',
      to: '/app/teacher-workload',
    },
    {
      label: 'ข้อมูลหลัก',
      to: '/app/master-data',
    },
    {
      label: 'มอบหมายการสอน',
      to: '/app/assignments',
    },
    {
      label: 'ตารางสอน',
      to: '/app/timetable',
    },
    {
      label: 'ส่งออกเอกสาร',
      to: '/app/export',
    },
    {
      label: 'ครูลา',
      to: '/app/teacher-absences',
    },
    {
      label: 'สอนแทน',
      to: '/app/substitutions',
    },
    {
      label: 'ตั้งค่าโรงเรียน',
      to: '/app/school-settings',
    },
  ];

  return (
    <div className="academic-shell">
      <header className="app-navbar">
        <NavLink to="/app/dashboard" className="app-navbar__brand">
          <span className="app-navbar__brand-mark">TP</span>
          <span>
            <strong>Timetable Pro</strong>
            <small>{currentSchool.name || 'ระบบจัดตารางเรียน'}</small>
          </span>
        </NavLink>

        <div className="app-navbar__tools">
          <div className="app-navbar__school">
            <SelectField
              label="โรงเรียน"
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

          <div className="app-navbar__user">
            <span>{profile?.displayName || profile?.email || 'ผู้ใช้งาน'}</span>
            <small>{getAuthRoleLabel(profile?.role)}</small>
          </div>

          <button type="button" className="secondary-button" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <section className="academic-card">
        <header className="academic-card__header">
          <div className="academic-card__heading">
            <p className="auth-card__eyebrow">{eyebrow}</p>
            <h1 className="academic-card__title">{title}</h1>
            <p className="academic-card__copy">{description}</p>
          </div>

          <div className="academic-card__header-tools">
            <StatusPill tone="info">
              โรงเรียน: {currentSchool.name || currentSchoolId || currentSchool.schoolId || 'ยังไม่ตั้งค่า'}
            </StatusPill>
          </div>
        </header>

        <nav className="academic-nav" aria-label="เมนูหลัก">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `academic-nav__link${isActive ? ' academic-nav__link--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {summary ? <section className="academic-summary">{summary}</section> : null}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}

        <div className="academic-card__body">{children}</div>
      </section>
    </div>
  );
}
