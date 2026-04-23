export const SLOT_TYPE_OPTIONS = [
  { value: 'teaching', label: 'Teaching' },
  { value: 'break', label: 'Break' },
  { value: 'lunch', label: 'Lunch' },
];

export const WEEKDAY_OPTIONS = [
  { key: 'monday', label: 'Monday', order: 1 },
  { key: 'tuesday', label: 'Tuesday', order: 2 },
  { key: 'wednesday', label: 'Wednesday', order: 3 },
  { key: 'thursday', label: 'Thursday', order: 4 },
  { key: 'friday', label: 'Friday', order: 5 },
  { key: 'saturday', label: 'Saturday', order: 6 },
  { key: 'sunday', label: 'Sunday', order: 7 },
];

export function getWeekdayOptions(daysPerWeek = 5) {
  const safeDaysPerWeek = Math.min(Math.max(Number(daysPerWeek) || 0, 0), 7);
  return WEEKDAY_OPTIONS.slice(0, safeDaysPerWeek);
}

export function getWeekdayByKey(weekdayKey) {
  return WEEKDAY_OPTIONS.find((weekday) => weekday.key === weekdayKey) || null;
}
