export function formatThaiDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

export function getDefaultAcademicYearLabel(referenceDate = new Date()) {
  const thaiYear = referenceDate.getFullYear() + 543;
  const month = referenceDate.getMonth();

  return String(month >= 4 ? thaiYear : thaiYear - 1);
}
