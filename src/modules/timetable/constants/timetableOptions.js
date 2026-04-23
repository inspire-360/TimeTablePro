export const TIMETABLE_TYPE_OPTIONS = [
  { value: 'class', label: 'Class Timetable' },
  { value: 'teacher', label: 'Teacher Timetable' },
  { value: 'room', label: 'Room Timetable' },
];

export function getTimetableTypeLabel(timetableType) {
  const matchedOption = TIMETABLE_TYPE_OPTIONS.find((option) => option.value === timetableType);
  return matchedOption?.label || 'Timetable';
}

export function getTimetableTypeEmptyLabel(timetableType) {
  if (timetableType === 'teacher' || timetableType === 'room') {
    return 'Free';
  }

  return 'Available';
}
