function parseDateValue(value) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function isDateWithinRange(referenceDate, startDate, endDate) {
  if (!startDate || !endDate) {
    return false;
  }

  return referenceDate >= startDate && referenceDate <= endDate;
}

function sortByStartDate(items, direction = 'asc') {
  return [...items].sort((left, right) => {
    const leftTime = parseDateValue(left.startDate)?.getTime() || 0;
    const rightTime = parseDateValue(right.startDate)?.getTime() || 0;

    return direction === 'asc' ? leftTime - rightTime : rightTime - leftTime;
  });
}

export function getActiveTerm({
  academicYears = [],
  referenceDate = new Date(),
  terms = [],
} = {}) {
  const yearById = new Map(academicYears.map((academicYear) => [academicYear.id, academicYear]));
  const explicitActiveTerm = terms.find((term) => term.isActive);
  const explicitActiveYear = academicYears.find((academicYear) => academicYear.isActive) || null;

  if (explicitActiveTerm) {
    return {
      activeAcademicYear: yearById.get(explicitActiveTerm.academicYearId) || explicitActiveYear,
      activeTerm: explicitActiveTerm,
    };
  }

  let activeAcademicYear =
    explicitActiveYear ||
    academicYears.find((academicYear) =>
      isDateWithinRange(
        referenceDate,
        parseDateValue(academicYear.startDate),
        parseDateValue(academicYear.endDate),
      ),
    ) ||
    sortByStartDate(academicYears, 'desc')[0] ||
    null;

  const termsInActiveYear = activeAcademicYear
    ? terms.filter((term) => term.academicYearId === activeAcademicYear.id)
    : [];

  let activeTerm =
    termsInActiveYear.find((term) => term.isActive) ||
    termsInActiveYear.find((term) =>
      isDateWithinRange(referenceDate, parseDateValue(term.startDate), parseDateValue(term.endDate)),
    ) ||
    sortByStartDate(termsInActiveYear, 'asc')[0] ||
    null;

  if (!activeAcademicYear && activeTerm) {
    activeAcademicYear = yearById.get(activeTerm.academicYearId) || null;
  }

  if (!activeTerm && !activeAcademicYear) {
    activeTerm = sortByStartDate(terms, 'asc')[0] || null;

    if (activeTerm) {
      activeAcademicYear = yearById.get(activeTerm.academicYearId) || null;
    }
  }

  return {
    activeAcademicYear,
    activeTerm,
  };
}
