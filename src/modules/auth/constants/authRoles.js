export const AUTH_ROLES = [
  'super_admin',
  'school_admin',
  'academic_admin',
  'teacher',
  'student',
];

export const DEFAULT_AUTH_ROLE = 'student';

const roleLabels = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  academic_admin: 'Academic Admin',
  teacher: 'Teacher',
  student: 'Student',
};

export function isValidAuthRole(role) {
  return AUTH_ROLES.includes(role);
}

export function getAuthRoleLabel(role) {
  return roleLabels[role] || role;
}
