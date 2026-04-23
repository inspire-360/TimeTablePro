import { getDefaultAcademicYearLabel } from '../../../shared/utils/date';
import { getActiveTerm } from './getActiveTerm';

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getAcademicYearGregorianStart(referenceDate = new Date()) {
  const month = referenceDate.getMonth();
  return month >= 4 ? referenceDate.getFullYear() : referenceDate.getFullYear() - 1;
}

export function createDefaultAcademicYearValues(schoolId, referenceDate = new Date()) {
  const startYear = getAcademicYearGregorianStart(referenceDate);
  const endYear = startYear + 1;
  const label = getDefaultAcademicYearLabel(referenceDate);

  return {
    id: '',
    schoolId,
    label,
    startDate: formatDateInput(new Date(startYear, 4, 1)),
    endDate: formatDateInput(new Date(endYear, 2, 31)),
    isActive: false,
  };
}

function createDefaultTermDateRange(termNumber, academicYear) {
  if (!academicYear?.startDate || !academicYear?.endDate) {
    return {
      startDate: '',
      endDate: '',
    };
  }

  const academicYearStart = new Date(`${academicYear.startDate}T00:00:00`);
  const academicYearEnd = new Date(`${academicYear.endDate}T00:00:00`);
  const startYear = academicYearStart.getFullYear();
  const endYear = academicYearEnd.getFullYear();

  if (termNumber === 1) {
    return {
      startDate: formatDateInput(new Date(startYear, 4, 1)),
      endDate: formatDateInput(new Date(startYear, 8, 30)),
    };
  }

  if (termNumber === 2) {
    return {
      startDate: formatDateInput(new Date(startYear, 10, 1)),
      endDate: formatDateInput(new Date(endYear, 2, 31)),
    };
  }

  return {
    startDate: academicYear.startDate,
    endDate: academicYear.endDate,
  };
}

export function createDefaultTermValues({
  academicYears = [],
  referenceDate = new Date(),
  schoolId,
  terms = [],
}) {
  const { activeAcademicYear } = getActiveTerm({
    academicYears,
    terms,
    referenceDate,
  });
  const fallbackAcademicYear =
    activeAcademicYear || academicYears[0] || createDefaultAcademicYearValues(schoolId, referenceDate);
  const termsInAcademicYear = terms.filter(
    (term) => term.academicYearId === fallbackAcademicYear.id,
  );
  const nextTermNumber =
    termsInAcademicYear.length > 0
      ? Math.max(...termsInAcademicYear.map((term) => Number(term.termNumber) || 0)) + 1
      : 1;
  const nextDateRange = createDefaultTermDateRange(nextTermNumber, fallbackAcademicYear);

  return {
    id: '',
    schoolId,
    academicYearId: fallbackAcademicYear.id || '',
    name: `Term ${nextTermNumber}`,
    termNumber: nextTermNumber,
    startDate: nextDateRange.startDate,
    endDate: nextDateRange.endDate,
    isActive: false,
  };
}
