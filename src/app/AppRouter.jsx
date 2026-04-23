import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLoader } from '../shared/ui/AppLoader';
import { ProtectedRoute } from '../modules/auth/components/ProtectedRoute';
import { useAuth } from '../modules/auth/context/useAuth';

const LoginPage = lazy(() =>
  import('../modules/auth/pages/LoginPage').then((module) => ({
    default: module.LoginPage,
  })),
);

const DashboardPage = lazy(() =>
  import('../modules/dashboard/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);

const ExportPage = lazy(() =>
  import('../modules/exports/pages/ExportPage').then((module) => ({
    default: module.ExportPage,
  })),
);

const SchoolSettingsPage = lazy(() =>
  import('../modules/schools/pages/SchoolSettingsPage').then((module) => ({
    default: module.SchoolSettingsPage,
  })),
);

const AcademicYearPage = lazy(() =>
  import('../modules/academic/pages/AcademicYearPage').then((module) => ({
    default: module.AcademicYearPage,
  })),
);

const TermPage = lazy(() =>
  import('../modules/academic/pages/TermPage').then((module) => ({
    default: module.TermPage,
  })),
);

const TimeStructurePage = lazy(() =>
  import('../modules/time-structure/pages/TimeStructurePage').then((module) => ({
    default: module.TimeStructurePage,
  })),
);

const PlcPolicySettingsPage = lazy(() =>
  import('../modules/plc/pages/PlcPolicySettingsPage').then((module) => ({
    default: module.PlcPolicySettingsPage,
  })),
);

const TeacherWorkloadPage = lazy(() =>
  import('../modules/plc/pages/TeacherWorkloadPage').then((module) => ({
    default: module.TeacherWorkloadPage,
  })),
);

const LearningAreasPage = lazy(() =>
  import('../modules/master-data/pages/LearningAreasPage').then((module) => ({
    default: module.LearningAreasPage,
  })),
);

const SubjectsPage = lazy(() =>
  import('../modules/master-data/pages/SubjectsPage').then((module) => ({
    default: module.SubjectsPage,
  })),
);

const TeachersPage = lazy(() =>
  import('../modules/master-data/pages/TeachersPage').then((module) => ({
    default: module.TeachersPage,
  })),
);

const StudentsPage = lazy(() =>
  import('../modules/master-data/pages/StudentsPage').then((module) => ({
    default: module.StudentsPage,
  })),
);

const ClassesPage = lazy(() =>
  import('../modules/master-data/pages/ClassesPage').then((module) => ({
    default: module.ClassesPage,
  })),
);

const ClassroomsPage = lazy(() =>
  import('../modules/master-data/pages/ClassroomsPage').then((module) => ({
    default: module.ClassroomsPage,
  })),
);

const ActivitiesPage = lazy(() =>
  import('../modules/master-data/pages/ActivitiesPage').then((module) => ({
    default: module.ActivitiesPage,
  })),
);

const AssignmentPage = lazy(() =>
  import('../modules/teaching-assignments/pages/AssignmentPage').then((module) => ({
    default: module.AssignmentPage,
  })),
);

const TimetableEditorPage = lazy(() =>
  import('../modules/timetable/pages/TimetableEditorPage').then((module) => ({
    default: module.TimetableEditorPage,
  })),
);

const AbsencePage = lazy(() =>
  import('../modules/substitutions/pages/AbsencePage').then((module) => ({
    default: module.AbsencePage,
  })),
);

const SubstitutePage = lazy(() =>
  import('../modules/substitutions/pages/SubstitutePage').then((module) => ({
    default: module.SubstitutePage,
  })),
);

function AppEntryRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AppLoader label="กำลังตรวจสอบการเข้าสู่ระบบ" />;
  }

  return <Navigate replace to={isAuthenticated ? '/app/dashboard' : '/login'} />;
}

export function AppRouter() {
  return (
    <Suspense fallback={<AppLoader label="กำลังเตรียมระบบงานวิชาการ" />}>
      <Routes>
        <Route path="/" element={<AppEntryRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Navigate replace to="/app/dashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={['super_admin', 'school_admin', 'academic_admin', 'teacher']}
            >
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/school-settings"
          element={
            <ProtectedRoute>
              <SchoolSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/academic-years"
          element={
            <ProtectedRoute>
              <AcademicYearPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/terms"
          element={
            <ProtectedRoute>
              <TermPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/time-structure"
          element={
            <ProtectedRoute>
              <TimeStructurePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/plc-policy"
          element={
            <ProtectedRoute>
              <PlcPolicySettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/teacher-workload"
          element={
            <ProtectedRoute>
              <TeacherWorkloadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/master-data"
          element={
            <ProtectedRoute>
              <Navigate replace to="/app/master-data/learning-areas" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/master-data/learning-areas"
          element={
            <ProtectedRoute>
              <LearningAreasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/master-data/subjects"
          element={
            <ProtectedRoute>
              <SubjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/master-data/teachers"
          element={
            <ProtectedRoute>
              <TeachersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/master-data/students"
          element={
            <ProtectedRoute>
              <StudentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/master-data/classes"
          element={
            <ProtectedRoute>
              <ClassesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/master-data/classrooms"
          element={
            <ProtectedRoute>
              <ClassroomsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/master-data/activities"
          element={
            <ProtectedRoute>
              <ActivitiesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/assignments"
          element={
            <ProtectedRoute>
              <AssignmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/timetable"
          element={
            <ProtectedRoute>
              <TimetableEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/export"
          element={
            <ProtectedRoute
              allowedRoles={['super_admin', 'school_admin', 'academic_admin', 'teacher']}
            >
              <ExportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/teacher-absences"
          element={
            <ProtectedRoute>
              <AbsencePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/substitutions"
          element={
            <ProtectedRoute>
              <SubstitutePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </Suspense>
  );
}
