export const AUTH_ROLES = [
  'super_admin',
  'school_admin',
  'academic_admin',
  'teacher',
  'student',
];

export const DEFAULT_AUTH_ROLE = 'student';

const roleLabels = {
  super_admin: 'ผู้ดูแลระบบสูงสุด',
  school_admin: 'ผู้ดูแลโรงเรียน',
  academic_admin: 'ฝ่ายวิชาการ',
  teacher: 'ครูผู้สอน',
  student: 'นักเรียน',
};

export function isValidAuthRole(role) {
  return AUTH_ROLES.includes(role);
}

export function getAuthRoleLabel(role) {
  return roleLabels[role] || role;
}
