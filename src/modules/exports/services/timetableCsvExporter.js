function buildTimetableCellSubtitle(entry, documentType) {
  if (documentType === 'teacher') {
    return [entry.className, entry.classroomName].filter(Boolean).join(' | ');
  }

  return [
    entry.sectionType === 'subgroup' ? entry.sectionName : '',
    entry.teacherDisplay,
    entry.classroomName,
  ]
    .filter(Boolean)
    .join(' | ');
}

function getTimetableCellEmptyLabel(documentType) {
  return documentType === 'teacher' ? 'Free' : 'Available';
}

function buildTimeSlotLabel(slot) {
  if (!slot) {
    return '';
  }

  return `${slot.startTime} - ${slot.endTime}`;
}

function buildTimetableCsvCellContent({ cellEntries = [], documentType, slot }) {
  if (!slot) {
    return '';
  }

  if (cellEntries.length === 0) {
    return slot.slotType === 'teaching'
      ? getTimetableCellEmptyLabel(documentType)
      : slot.slotType;
  }

  return cellEntries
    .map((entry) =>
      [
        entry.subjectShortName || entry.subjectName,
        buildTimetableCellSubtitle(entry, documentType),
      ]
        .filter(Boolean)
        .join(' | '),
    )
    .join('\n');
}

function buildTimetableCsvRows(documentData) {
  const rows = [
    ['School', documentData.school.name],
    ['School ID', documentData.school.schoolId],
    ['Affiliation', documentData.school.affiliation || ''],
    ['Document', documentData.documentLabel],
    ['Owner', documentData.owner.label],
    ['Academic Year', documentData.academicYear?.label || ''],
    ['Term', documentData.term.name || ''],
    ['Time Structure', documentData.timeStructure.name || ''],
    ['Exported At', documentData.createdAtLabel],
    [],
  ];

  rows.push([
    'Slot',
    'Time',
    'Type',
    ...documentData.weekdays.map((weekday) => weekday.label),
  ]);

  documentData.slotRows.forEach((slotIndex) => {
    const firstAvailableSlot =
      documentData.weekdays
        .map((weekday) => (documentData.timeSlotsByWeekday.get(weekday.key) || [])[slotIndex - 1])
        .find(Boolean) || null;

    rows.push([
      `Slot ${slotIndex}`,
      buildTimeSlotLabel(firstAvailableSlot),
      firstAvailableSlot?.slotType || '',
      ...documentData.weekdays.map((weekday) => {
        const slot =
          (documentData.timeSlotsByWeekday.get(weekday.key) || [])[slotIndex - 1] || null;
        const cellEntries = slot ? documentData.entriesByTimeSlot.get(slot.id) || [] : [];

        return buildTimetableCsvCellContent({
          cellEntries,
          documentType: documentData.documentType,
          slot,
        });
      }),
    ]);
  });

  return rows;
}

function escapeCsvValue(value) {
  const normalizedValue = String(value ?? '');

  if (/[",\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`;
  }

  return normalizedValue;
}

function downloadTextFile({ content, fileName, mimeType }) {
  const blob = new Blob([content], {
    type: mimeType,
  });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(objectUrl);
}

export function exportTimetableCsv({ documentData, fileName }) {
  const rows = buildTimetableCsvRows(documentData);
  const csvContent = `\uFEFF${rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
    .join('\r\n')}`;

  downloadTextFile({
    content: csvContent,
    fileName,
    mimeType: 'text/csv;charset=utf-8;',
  });
}
