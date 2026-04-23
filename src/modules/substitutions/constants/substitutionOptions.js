export const ABSENCE_REASON_OPTIONS = [
  { value: 'sick_leave', label: 'Sick Leave' },
  { value: 'personal_leave', label: 'Personal Leave' },
  { value: 'official_duty', label: 'Official Duty' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
];

export const ABSENCE_STATUS_OPTIONS = [
  { value: 'reported', label: 'Reported' },
  { value: 'approved', label: 'Approved' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const SUBSTITUTION_STATUS_OPTIONS = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function getAbsenceReasonLabel(value) {
  return ABSENCE_REASON_OPTIONS.find((option) => option.value === value)?.label || value || 'Other';
}

export function getAbsenceStatusLabel(value) {
  return ABSENCE_STATUS_OPTIONS.find((option) => option.value === value)?.label || value || 'Reported';
}

export function getSubstitutionStatusLabel(value) {
  return SUBSTITUTION_STATUS_OPTIONS.find((option) => option.value === value)?.label || value || 'Assigned';
}
