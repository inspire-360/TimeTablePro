export const DEFAULT_INTERNAL_SCHOOL_ID =
  import.meta.env.VITE_DEFAULT_SCHOOL_ID?.trim() || 'main-school';

export const DEFAULT_INTERNAL_SCHOOL_NAME =
  import.meta.env.VITE_DEFAULT_SCHOOL_NAME?.trim() || 'โรงเรียนของฉัน';

export function resolveDefaultSchoolId(value) {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  return normalizedValue || DEFAULT_INTERNAL_SCHOOL_ID;
}
