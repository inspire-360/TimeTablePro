import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { AcademicPageShell } from '../../academic/components/AcademicPageShell';
import { listAcademicYearsBySchool } from '../../academic/api/academicYearRepository';
import { listTermsBySchool } from '../../academic/api/termRepository';
import { getActiveTerm } from '../../academic/helpers/getActiveTerm';
import { listMasterDataRecords } from '../../master-data/api/masterDataRepository';
import { listTeacherPlcAssignmentsBySchool } from '../../plc/api/teacherPlcAssignmentRepository';
import { PresenceIndicator } from '../../realtime/components/PresenceIndicator';
import { useEditingSession } from '../../realtime/hooks/useEditingSession';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';
import { listDailySchedulesByTimeStructure } from '../../time-structure/api/dailyScheduleRepository';
import { listTimeSlotsByTimeStructure } from '../../time-structure/api/timeSlotRepository';
import { listTimeStructuresBySchool } from '../../time-structure/api/timeStructureRepository';
import { getWeekdayOptions } from '../../time-structure/constants/timeStructureOptions';
import { listClassOfferingsByClass } from '../../teaching-assignments/api/classOfferingRepository';
import { listCourseAssignmentsByClassOffering } from '../../teaching-assignments/api/courseAssignmentRepository';
import { listSectionsByClassOffering } from '../../teaching-assignments/api/sectionRepository';
import {
  deleteTimetableEntry,
  listTimetableEntriesByTeacher,
  listTimetableEntriesByTimeSlot,
  saveTimetableBundle,
  subscribeTimetableEntriesByContext,
  subscribeTimetableByScope,
  subscribeTimetableEntriesByScope,
} from '../api/timetableRepository';
import { TimetableSuggestionsPanel } from '../components/TimetableSuggestionsPanel';
import { TimetableGrid } from '../components/TimetableGrid';
import { TIMETABLE_TYPE_OPTIONS } from '../constants/timetableOptions';
import { autoPlaceSubject } from '../helpers/autoPlaceSubject';
import { createEntry } from '../helpers/createEntry';
import {
  createConflictResult,
  getPrimaryConflictMessage,
  hasConflictErrors,
  validateTimetableEntryConflicts,
} from '../helpers/conflict';
import {
  createEmptySuggestionResult,
  suggestAvailableSlots,
} from '../helpers/suggestionEngine';

function sortByLabel(records = [], labelBuilder) {
  return [...records].sort((left, right) =>
    labelBuilder(left).localeCompare(labelBuilder(right), undefined, { numeric: true }),
  );
}

function buildWeekdayModel({ dailySchedules, selectedTimeStructure }) {
  if (dailySchedules.length > 0) {
    return dailySchedules.map((dailySchedule) => ({
      key: dailySchedule.weekdayKey,
      label: dailySchedule.weekdayLabel,
      order: dailySchedule.weekdayOrder,
    }));
  }

  return getWeekdayOptions(selectedTimeStructure?.daysPerWeek || 0);
}

function buildTimeSlotMap(timeSlots = []) {
  const nextMap = new Map();

  timeSlots.forEach((slot) => {
    const slots = nextMap.get(slot.weekdayKey) || [];
    nextMap.set(slot.weekdayKey, [...slots, slot]);
  });

  return nextMap;
}

function getFirstTeachingTimeSlot(timeSlots = []) {
  return timeSlots.find((slot) => slot.slotType === 'teaching') || null;
}

function getSelectedScopeId({
  selectedClassId,
  selectedRoomId,
  selectedTeacherId,
  timetableType,
}) {
  if (timetableType === 'teacher') {
    return selectedTeacherId;
  }

  if (timetableType === 'room') {
    return selectedRoomId;
  }

  return selectedClassId;
}

function buildOwnerLabel(record, timetableType) {
  if (!record) {
    return '';
  }

  if (timetableType === 'teacher') {
    return [record.displayName, record.employeeCode].filter(Boolean).join(' | ');
  }

  if (timetableType === 'room') {
    return [record.name, record.building, record.floor].filter(Boolean).join(' | ');
  }

  return [record.name, record.gradeLevel, record.roomLabel].filter(Boolean).join(' | ');
}

function buildEntryDetailLines(entry, timetableType) {
  if (timetableType === 'teacher') {
    return [
      `Class: ${entry.className}`,
      entry.classroomName ? `Room: ${entry.classroomName}` : '',
      entry.sectionType === 'subgroup' ? `Section: ${entry.sectionName}` : '',
    ].filter(Boolean);
  }

  if (timetableType === 'room') {
    return [
      `Class: ${entry.className}`,
      entry.teacherDisplay ? `Teachers: ${entry.teacherDisplay}` : '',
      entry.sectionType === 'subgroup' ? `Section: ${entry.sectionName}` : '',
    ].filter(Boolean);
  }

  return [
    entry.teacherDisplay ? `Teachers: ${entry.teacherDisplay}` : '',
    entry.classroomName ? `Room: ${entry.classroomName}` : '',
    entry.sectionType === 'subgroup' ? `Section: ${entry.sectionName}` : '',
  ].filter(Boolean);
}

function buildTimetableEditingResource({
  schoolClass,
  schoolId,
  term,
  timeStructure,
  timetableType,
}) {
  if (
    timetableType !== 'class' ||
    !schoolId ||
    !schoolClass?.id ||
    !term?.id ||
    !timeStructure?.id
  ) {
    return null;
  }

  return {
    ownerId: schoolClass.id,
    ownerLabel: schoolClass.name || 'Class timetable',
    ownerType: 'class',
    resourceId: [schoolId, 'timetable', schoolClass.id, term.id, timeStructure.id].join('-'),
    resourceLabel: [schoolClass.name || 'Class timetable', term.name || '', timeStructure.name || '']
      .filter(Boolean)
      .join(' | '),
    resourceType: 'timetable',
  };
}

function ConflictIssueGroup({ issues, title, tone }) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <FormMessage tone={tone}>
      <div className="timetable-conflict-group">
        <strong>{title}</strong>
        <ul className="timetable-conflict-list">
          {issues.map((issue) => (
            <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      </div>
    </FormMessage>
  );
}

export function TimetableEditorPage() {
  const { currentSchool, currentSchoolId } = useCurrentSchool();
  const schoolId = currentSchoolId || currentSchool.schoolId || '';
  const [academicYears, setAcademicYears] = useState([]);
  const [terms, setTerms] = useState([]);
  const [timeStructures, setTimeStructures] = useState([]);
  const [dailySchedules, setDailySchedules] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [teacherPlcAssignments, setTeacherPlcAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [classOfferings, setClassOfferings] = useState([]);
  const [sections, setSections] = useState([]);
  const [courseAssignments, setCourseAssignments] = useState([]);
  const [entries, setEntries] = useState([]);
  const [contextEntries, setContextEntries] = useState([]);
  const [workingTimetable, setWorkingTimetable] = useState(null);
  const [timetableType, setTimetableType] = useState('class');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedTimeStructureId, setSelectedTimeStructureId] = useState('');
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedEntryRoomId, setSelectedEntryRoomId] = useState('');
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState('');
  const [status, setStatus] = useState('loading');
  const [detailStatus, setDetailStatus] = useState('idle');
  const [suggestionStatus, setSuggestionStatus] = useState('idle');
  const [conflictStatus, setConflictStatus] = useState('idle');
  const [conflicts, setConflicts] = useState(() => createConflictResult());
  const [isAutoPlacing, setIsAutoPlacing] = useState(false);
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const [error, setError] = useState('');

  const activeClasses = useMemo(
    () =>
      sortByLabel(
        classes.filter((record) => record.status === 'active'),
        (record) => `${record.gradeLevel || ''} ${record.name || ''}`,
      ),
    [classes],
  );
  const activeTeachers = useMemo(
    () =>
      sortByLabel(
        teachers.filter((record) => record.status === 'active'),
        (record) => `${record.displayName || ''} ${record.employeeCode || ''}`,
      ),
    [teachers],
  );
  const activeClassrooms = useMemo(
    () =>
      sortByLabel(
        classrooms.filter((record) => record.status === 'active'),
        (record) => `${record.name || ''} ${record.building || ''}`,
      ),
    [classrooms],
  );
  const selectedClass = useMemo(
    () => activeClasses.find((record) => record.id === selectedClassId) || null,
    [activeClasses, selectedClassId],
  );
  const selectedTeacher = useMemo(
    () => activeTeachers.find((record) => record.id === selectedTeacherId) || null,
    [activeTeachers, selectedTeacherId],
  );
  const selectedRoom = useMemo(
    () => activeClassrooms.find((record) => record.id === selectedRoomId) || null,
    [activeClassrooms, selectedRoomId],
  );
  const selectedOffering = useMemo(
    () => classOfferings.find((offering) => offering.id === selectedOfferingId) || null,
    [classOfferings, selectedOfferingId],
  );
  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) || null,
    [sections, selectedSectionId],
  );
  const selectedEntryRoom = useMemo(
    () => activeClassrooms.find((record) => record.id === selectedEntryRoomId) || null,
    [activeClassrooms, selectedEntryRoomId],
  );
  const selectedTimeStructure = useMemo(
    () => timeStructures.find((timeStructure) => timeStructure.id === selectedTimeStructureId) || null,
    [selectedTimeStructureId, timeStructures],
  );
  const { activeAcademicYear, activeTerm } = useMemo(
    () =>
      getActiveTerm({
        academicYears,
        terms,
      }),
    [academicYears, terms],
  );
  const activeTermId = activeTerm?.id || '';
  const weekdays = useMemo(
    () => buildWeekdayModel({ dailySchedules, selectedTimeStructure }),
    [dailySchedules, selectedTimeStructure],
  );
  const timeSlotsByWeekday = useMemo(() => buildTimeSlotMap(timeSlots), [timeSlots]);
  const flatTimeSlots = useMemo(
    () =>
      weekdays.flatMap((weekday) => {
        const weekdaySlots = timeSlotsByWeekday.get(weekday.key) || [];
        return weekdaySlots;
      }),
    [timeSlotsByWeekday, weekdays],
  );
  const fallbackTimeSlot = useMemo(() => getFirstTeachingTimeSlot(flatTimeSlots), [flatTimeSlots]);
  const effectiveSelectedTimeSlotId = useMemo(() => {
    const matchingSlot = flatTimeSlots.find((slot) => slot.id === selectedTimeSlotId);

    if (matchingSlot?.slotType === 'teaching') {
      return selectedTimeSlotId;
    }

    return fallbackTimeSlot?.id || '';
  }, [fallbackTimeSlot?.id, flatTimeSlots, selectedTimeSlotId]);
  const selectedTimeSlot = useMemo(
    () => flatTimeSlots.find((slot) => slot.id === effectiveSelectedTimeSlotId) || null,
    [effectiveSelectedTimeSlotId, flatTimeSlots],
  );
  const selectedCellEntries = useMemo(
    () => entries.filter((entry) => entry.timeSlotId === effectiveSelectedTimeSlotId),
    [effectiveSelectedTimeSlotId, entries],
  );
  const selectedScopeId = useMemo(
    () =>
      getSelectedScopeId({
        selectedClassId,
        selectedRoomId,
        selectedTeacherId,
        timetableType,
      }),
    [selectedClassId, selectedRoomId, selectedTeacherId, timetableType],
  );
  const sectionAssignments = useMemo(
    () => courseAssignments.filter((assignment) => assignment.sectionId === selectedSectionId),
    [courseAssignments, selectedSectionId],
  );
  const canPreviewConflicts =
    timetableType === 'class' &&
    Boolean(
      selectedClass &&
        selectedOffering &&
        selectedSection &&
        selectedEntryRoom &&
        selectedTimeSlot &&
        selectedTimeSlot.slotType === 'teaching' &&
        selectedTimeStructure &&
        activeAcademicYear &&
        activeTerm &&
        sectionAssignments.length > 0,
    );
  const canSuggestSlots =
    timetableType === 'class' &&
    Boolean(
      selectedClass &&
        selectedOffering &&
        selectedSection &&
        selectedEntryRoom &&
        selectedTimeStructure &&
        activeAcademicYear &&
        activeTerm &&
        sectionAssignments.length > 0,
    );
  const editingResource = useMemo(
    () =>
      buildTimetableEditingResource({
        schoolClass: selectedClass,
        schoolId,
        term: activeTerm,
        timeStructure: selectedTimeStructure,
        timetableType,
      }),
    [activeTerm, schoolId, selectedClass, selectedTimeStructure, timetableType],
  );
  const editingSession = useEditingSession({
    enabled: timetableType === 'class',
    resource: editingResource,
    schoolId,
  });
  const softLockActive = editingSession.softLockActive;
  const suggestionResult = useMemo(() => {
    if (!canSuggestSlots || suggestionStatus === 'loading') {
      return createEmptySuggestionResult();
    }

    return suggestAvailableSlots({
      academicYear: activeAcademicYear,
      assignedTeachers: sectionAssignments,
      classOffering: selectedOffering,
      classroom: selectedEntryRoom,
      contextEntries,
      schoolClass: selectedClass,
      schoolId,
      section: selectedSection,
      term: activeTerm,
      timeSlots: flatTimeSlots,
      timeStructure: selectedTimeStructure,
      teacherPlcAssignments,
    });
  }, [
    activeAcademicYear,
    activeTerm,
    canSuggestSlots,
    contextEntries,
    flatTimeSlots,
    schoolId,
    sectionAssignments,
    selectedClass,
    selectedEntryRoom,
    selectedOffering,
    selectedSection,
    selectedTimeStructure,
    suggestionStatus,
    teacherPlcAssignments,
  ]);

  const refreshDependencies = useCallback(async () => {
    if (!schoolId) {
      setAcademicYears([]);
      setTerms([]);
      setTimeStructures([]);
      setTeacherPlcAssignments([]);
      setClasses([]);
      setTeachers([]);
      setClassrooms([]);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError('');

    try {
      const [
        nextAcademicYears,
        nextTerms,
        nextTimeStructures,
        nextTeacherPlcAssignments,
        nextClasses,
        nextTeachers,
        nextClassrooms,
      ] = await Promise.all([
        listAcademicYearsBySchool(schoolId),
        listTermsBySchool(schoolId),
        listTimeStructuresBySchool(schoolId),
        listTeacherPlcAssignmentsBySchool(schoolId),
        listMasterDataRecords({ collectionName: 'classes', schoolId }),
        listMasterDataRecords({ collectionName: 'teachers', schoolId }),
        listMasterDataRecords({ collectionName: 'classrooms', schoolId }),
      ]);

      const sortedClasses = sortByLabel(
        nextClasses.filter((record) => record.status === 'active'),
        (record) => `${record.gradeLevel || ''} ${record.name || ''}`,
      );
      const sortedTeachers = sortByLabel(
        nextTeachers.filter((record) => record.status === 'active'),
        (record) => `${record.displayName || ''} ${record.employeeCode || ''}`,
      );
      const sortedClassrooms = sortByLabel(
        nextClassrooms.filter((record) => record.status === 'active'),
        (record) => `${record.name || ''} ${record.building || ''}`,
      );

      setAcademicYears(nextAcademicYears);
      setTerms(nextTerms);
      setTimeStructures(nextTimeStructures);
      setTeacherPlcAssignments(nextTeacherPlcAssignments);
      setClasses(nextClasses);
      setTeachers(nextTeachers);
      setClassrooms(nextClassrooms);
      setSelectedClassId((current) => {
        if (current && sortedClasses.some((record) => record.id === current)) {
          return current;
        }

        return sortedClasses[0]?.id || '';
      });
      setSelectedTeacherId((current) => {
        if (current && sortedTeachers.some((record) => record.id === current)) {
          return current;
        }

        return sortedTeachers[0]?.id || '';
      });
      setSelectedRoomId((current) => {
        if (current && sortedClassrooms.some((record) => record.id === current)) {
          return current;
        }

        return sortedClassrooms[0]?.id || '';
      });
      setSelectedEntryRoomId((current) => {
        if (current && sortedClassrooms.some((record) => record.id === current)) {
          return current;
        }

        return sortedClassrooms[0]?.id || '';
      });
      setSelectedTimeStructureId((current) => {
        if (current && nextTimeStructures.some((timeStructure) => timeStructure.id === current)) {
          return current;
        }

        return nextTimeStructures[0]?.id || '';
      });
      setStatus('ready');
    } catch (loadError) {
      setStatus('error');
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load timetable dependencies.',
      );
    }
  }, [schoolId]);

  const refreshClassOfferingData = useCallback(async () => {
    if (!schoolId || !selectedClassId) {
      setClassOfferings([]);
      setSections([]);
      setCourseAssignments([]);
      setSelectedOfferingId('');
      setSelectedSectionId('');
      return;
    }

    setDetailStatus('loading');
    setError('');

    try {
      const nextOfferings = await listClassOfferingsByClass({
        schoolId,
        classId: selectedClassId,
      });

      setClassOfferings(nextOfferings);
      setSelectedOfferingId((current) => {
        if (current && nextOfferings.some((offering) => offering.id === current)) {
          return current;
        }

        return nextOfferings[0]?.id || '';
      });
      setDetailStatus('ready');
    } catch (loadError) {
      setDetailStatus('error');
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load class offerings.',
      );
    }
  }, [schoolId, selectedClassId]);

  const refreshOfferingDetails = useCallback(async () => {
    if (!schoolId || !selectedOfferingId) {
      setSections([]);
      setCourseAssignments([]);
      setSelectedSectionId('');
      return;
    }

    setDetailStatus('loading');
    setError('');

    try {
      const [nextSections, nextAssignments] = await Promise.all([
        listSectionsByClassOffering({
          schoolId,
          classOfferingId: selectedOfferingId,
        }),
        listCourseAssignmentsByClassOffering({
          schoolId,
          classOfferingId: selectedOfferingId,
        }),
      ]);

      setSections(nextSections);
      setCourseAssignments(nextAssignments);
      setSelectedSectionId((current) => {
        if (current && nextSections.some((section) => section.id === current)) {
          return current;
        }

        return nextSections[0]?.id || '';
      });
      setDetailStatus('ready');
    } catch (loadError) {
      setDetailStatus('error');
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load sections and teacher assignments.',
      );
    }
  }, [schoolId, selectedOfferingId]);

  const refreshTimeStructureDetails = useCallback(async () => {
    if (!schoolId || !selectedTimeStructureId) {
      setDailySchedules([]);
      setTimeSlots([]);
      setSelectedTimeSlotId('');
      return;
    }

    setDetailStatus('loading');
    setError('');

    try {
      const [nextDailySchedules, nextTimeSlots] = await Promise.all([
        listDailySchedulesByTimeStructure({
          schoolId,
          timeStructureId: selectedTimeStructureId,
        }),
        listTimeSlotsByTimeStructure({
          schoolId,
          timeStructureId: selectedTimeStructureId,
        }),
      ]);

      setDailySchedules(nextDailySchedules);
      setTimeSlots(nextTimeSlots);
      setDetailStatus('ready');
    } catch (loadError) {
      setDetailStatus('error');
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load daily schedules and time slots.',
      );
    }
  }, [schoolId, selectedTimeStructureId]);

  const runConflictValidation = useCallback(async () => {
    if (!canPreviewConflicts) {
      return {
        conflicts: createConflictResult(),
        nextEntry: null,
      };
    }

    const nextEntry = createEntry({
      academicYear: activeAcademicYear,
      assignedTeachers: sectionAssignments,
      classOffering: selectedOffering,
      classroom: selectedEntryRoom,
      schoolClass: selectedClass,
      schoolId,
      section: selectedSection,
      slot: selectedTimeSlot,
      term: activeTerm,
      timeStructure: selectedTimeStructure,
    });
    const teacherIds = Array.from(new Set(nextEntry.entry.payload.teacherIds));
    const [timeSlotEntries, teacherEntryGroups] = await Promise.all([
      listTimetableEntriesByTimeSlot({
        schoolId,
        termId: activeTermId,
        timeSlotId: selectedTimeSlot.id,
        timeStructureId: selectedTimeStructure.id,
      }),
      Promise.all(
        teacherIds.map(async (teacherId) => ({
          entries: await listTimetableEntriesByTeacher({
            schoolId,
            teacherId,
            termId: activeTermId,
            timeStructureId: selectedTimeStructure.id,
          }),
          teacherId,
        })),
      ),
    ]);
    const teacherEntriesByTeacherId = Object.fromEntries(
      teacherEntryGroups.map((group) => [group.teacherId, group.entries]),
    );
    const nextConflicts = validateTimetableEntryConflicts({
      entry: {
        id: nextEntry.entry.id,
        ...nextEntry.entry.payload,
      },
      teacherEntriesByTeacherId,
      teacherPlcAssignments: teacherPlcAssignments.filter(
        (assignment) =>
          teacherIds.includes(assignment.teacherId) &&
          assignment.timeStructureId === selectedTimeStructure.id,
      ),
      timeSlotEntries,
      timeSlots: flatTimeSlots,
    });

    return {
      conflicts: nextConflicts,
      nextEntry,
    };
  }, [
    activeAcademicYear,
    activeTerm,
    activeTermId,
    canPreviewConflicts,
    flatTimeSlots,
    schoolId,
    sectionAssignments,
    selectedClass,
    selectedEntryRoom,
    selectedOffering,
    selectedSection,
    selectedTimeSlot,
    selectedTimeStructure,
    teacherPlcAssignments,
  ]);

  const refreshConflictPreview = useCallback(async () => {
    if (!canPreviewConflicts) {
      setConflictStatus('idle');
      setConflicts(createConflictResult());
      return;
    }

    setConflictStatus('loading');

    try {
      const nextValidation = await runConflictValidation();
      setConflicts(nextValidation.conflicts);
      setConflictStatus('ready');
    } catch (validationError) {
      setConflicts({
        error: [
          {
            code: 'validation_failed',
            message:
              validationError instanceof Error
                ? validationError.message
                : 'Unable to evaluate timetable conflicts.',
          },
        ],
        warning: [],
        info: [],
      });
      setConflictStatus('ready');
    }
  }, [canPreviewConflicts, runConflictValidation]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshDependencies();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshDependencies]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshClassOfferingData();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshClassOfferingData]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshOfferingDetails();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshOfferingDetails]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshTimeStructureDetails();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshTimeStructureDetails]);

  useEffect(() => {
    let unsubscribe = () => {};
    const timeoutId = window.setTimeout(() => {
      if (!schoolId || !activeTermId || !selectedTimeStructureId) {
        setContextEntries([]);
        setSuggestionStatus('idle');
        return;
      }

      setSuggestionStatus('loading');
      unsubscribe = subscribeTimetableEntriesByContext({
        schoolId,
        termId: activeTermId,
        timeStructureId: selectedTimeStructureId,
        onChange: (nextEntries) => {
          setContextEntries(nextEntries);
          setSuggestionStatus('ready');
        },
        onError: (loadError) => {
          setContextEntries([]);
          setSuggestionStatus('error');
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load smart scheduling data.',
          );
        },
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [activeTermId, schoolId, selectedTimeStructureId]);

  useEffect(() => {
    let unsubscribe = () => {};
    const timeoutId = window.setTimeout(() => {
      if (!schoolId || !activeTermId || !selectedTimeStructureId || !selectedScopeId) {
        setEntries([]);
        return;
      }

      setDetailStatus('loading');
      setError('');
      unsubscribe = subscribeTimetableEntriesByScope({
        ownerId: selectedScopeId,
        schoolId,
        termId: activeTermId,
        timeStructureId: selectedTimeStructureId,
        timetableType,
        onChange: (nextEntries) => {
          setEntries(nextEntries);
          setDetailStatus('ready');
        },
        onError: (loadError) => {
          setEntries([]);
          setDetailStatus('error');
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to live sync timetable entries.',
          );
        },
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [activeTermId, schoolId, selectedScopeId, selectedTimeStructureId, timetableType]);

  useEffect(() => {
    let unsubscribe = () => {};
    const timeoutId = window.setTimeout(() => {
      if (!schoolId || !selectedScopeId || !activeTermId || !selectedTimeStructureId) {
        setWorkingTimetable(null);
        return;
      }

      unsubscribe = subscribeTimetableByScope({
        ownerId: selectedScopeId,
        schoolId,
        termId: activeTermId,
        timeStructureId: selectedTimeStructureId,
        timetableType,
        onChange: (nextTimetable) => {
          setWorkingTimetable(nextTimetable);
        },
        onError: (loadError) => {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to live sync the timetable document.',
          );
        },
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [activeTermId, schoolId, selectedScopeId, selectedTimeStructureId, timetableType]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshConflictPreview();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshConflictPreview]);

  async function handleSaveEntry(event) {
    event.preventDefault();

    if (!selectedClass || !selectedTimeStructure || !activeAcademicYear || !activeTerm) {
      setFeedback({
        tone: 'error',
        message: 'Select a class, active term, and time structure before saving the timetable.',
      });
      return;
    }

    if (softLockActive) {
      setFeedback({
        tone: 'warning',
        message:
          'Another editor is active on this class timetable. Wait for the soft lock to clear before saving.',
      });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      const nextValidation = await runConflictValidation();

      setConflicts(nextValidation.conflicts);

      if (!nextValidation.nextEntry) {
        throw new Error('Complete the timetable form before saving.');
      }

      if (hasConflictErrors(nextValidation.conflicts)) {
        throw new Error(getPrimaryConflictMessage(nextValidation.conflicts));
      }

      await saveTimetableBundle(nextValidation.nextEntry);
      setFeedback({
        tone: 'success',
        message: 'Timetable entry saved successfully.',
      });
    } catch (saveError) {
      setFeedback({
        tone: 'error',
        message:
          saveError instanceof Error ? saveError.message : 'Unable to save timetable entry.',
      });
    }
  }

  async function handleAutoPlaceBestSuggestion() {
    if (suggestionStatus === 'loading') {
      setFeedback({
        tone: 'info',
        message: 'Smart scheduling is still loading the live timetable context.',
      });
      return;
    }

    if (!canSuggestSlots) {
      setFeedback({
        tone: 'error',
        message:
          'Complete the class, subject offering, section, room, active term, and time structure before auto placing.',
      });
      return;
    }

    if (softLockActive) {
      setFeedback({
        tone: 'warning',
        message:
          'Another editor is active on this class timetable. Wait for the soft lock to clear before auto placing.',
      });
      return;
    }

    try {
      setIsAutoPlacing(true);
      setFeedback({ tone: '', message: '' });
      const placement = await autoPlaceSubject({
        suggestionResult,
      });

      setSelectedTimeSlotId(placement.suggestion.slot.id);
      setConflicts(placement.suggestion.conflicts);
      setFeedback({
        tone: 'success',
        message: `Placed ${selectedOffering?.subjectName || 'the subject'} on ${placement.suggestion.slot.weekdayLabel || placement.suggestion.slot.weekdayKey} at ${placement.suggestion.slot.startTime} - ${placement.suggestion.slot.endTime}.`,
      });
    } catch (autoPlaceError) {
      setFeedback({
        tone: 'error',
        message:
          autoPlaceError instanceof Error
            ? autoPlaceError.message
            : 'Unable to auto place the selected subject.',
      });
    } finally {
      setIsAutoPlacing(false);
    }
  }

  async function handleDeleteEntry(entryId) {
    if (softLockActive) {
      setFeedback({
        tone: 'warning',
        message:
          'Another editor is active on this class timetable. Wait for the soft lock to clear before removing lessons.',
      });
      return;
    }

    try {
      setFeedback({ tone: '', message: '' });
      await deleteTimetableEntry(entryId);
      setFeedback({
        tone: 'success',
        message: 'Timetable entry removed successfully.',
      });
    } catch (deleteError) {
      setFeedback({
        tone: 'error',
        message:
          deleteError instanceof Error
            ? deleteError.message
            : 'Unable to remove timetable entry.',
      });
    }
  }

  if (status === 'loading') {
    return <AppLoader label="Loading timetable workspace" />;
  }

  const selectedScopeRecord =
    timetableType === 'teacher'
      ? selectedTeacher
      : timetableType === 'room'
        ? selectedRoom
        : selectedClass;
  const formReady =
    timetableType === 'class' &&
    selectedClass &&
    selectedOffering &&
    selectedSection &&
    selectedEntryRoom &&
    selectedTimeSlot &&
    selectedTimeSlot.slotType === 'teaching' &&
    sectionAssignments.length > 0 &&
    activeAcademicYear &&
    activeTerm &&
    selectedTimeStructure;

  return (
    <AcademicPageShell
      eyebrow="Timetable"
      title="Timetable Editor"
      description="Build class timetables on top of dynamic time slots, then review synchronized teacher and room views from the same school-scoped entry set."
      error={error}
      summary={
        <div className="academic-summary__grid">
          <StatusPill tone="info">Active year: {activeAcademicYear?.label || 'Not set'}</StatusPill>
          <StatusPill tone="info">Active term: {activeTerm?.name || 'Not set'}</StatusPill>
          <StatusPill tone="neutral">
            Structure: {selectedTimeStructure?.name || 'No time structure'}
          </StatusPill>
          <StatusPill tone={workingTimetable ? 'success' : 'neutral'}>
            {workingTimetable ? 'Saved timetable' : 'Draft timetable'}
          </StatusPill>
          <StatusPill tone="neutral">Grid entries: {entries.length}</StatusPill>
          <StatusPill tone={softLockActive ? 'warning' : 'success'}>
            Realtime: {editingSession.status === 'idle' ? 'On' : 'Connected'}
          </StatusPill>
          <StatusPill tone={softLockActive ? 'warning' : 'neutral'}>
            Editors: {editingSession.activeSessions.length}
          </StatusPill>
          <StatusPill tone={suggestionResult.availableCount > 0 ? 'success' : 'neutral'}>
            Suggestions: {suggestionResult.availableCount}
          </StatusPill>
        </div>
      }
    >
      {detailStatus === 'loading' ? <AppLoader label="Loading timetable details" /> : null}
      {suggestionStatus === 'loading' ? <AppLoader label="Loading smart scheduling data" /> : null}

      {!activeAcademicYear || !activeTerm ? (
        <FormMessage tone="info">
          Configure an active academic year and term before editing the timetable.
        </FormMessage>
      ) : null}

      {timeStructures.length === 0 ? (
        <FormMessage tone="info">
          Configure the time structure module before editing the timetable grid.
        </FormMessage>
      ) : null}

      <div className="timetable-stack">
        <section className="academic-form-card">
          <div className="academic-list-card__header">
            <div>
              <p className="auth-card__eyebrow">Working scope</p>
              <h2 className="academic-list-card__title">Timetable Filters</h2>
            </div>
            <StatusPill tone="success">
              {selectedScopeRecord
                ? buildOwnerLabel(selectedScopeRecord, timetableType)
                : 'Choose a timetable scope'}
            </StatusPill>
          </div>

          <div className="settings-grid">
            <SelectField
              label="Timetable type"
              value={timetableType}
              onChange={(event) => setTimetableType(event.target.value)}
            >
              {TIMETABLE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>

            {timetableType === 'teacher' ? (
              <SelectField
                label="Teacher"
                value={selectedTeacherId}
                onChange={(event) => setSelectedTeacherId(event.target.value)}
              >
                <option value="">Select teacher</option>
                {activeTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {buildOwnerLabel(teacher, 'teacher')}
                  </option>
                ))}
              </SelectField>
            ) : timetableType === 'room' ? (
              <SelectField
                label="Room"
                value={selectedRoomId}
                onChange={(event) => setSelectedRoomId(event.target.value)}
              >
                <option value="">Select room</option>
                {activeClassrooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {buildOwnerLabel(room, 'room')}
                  </option>
                ))}
              </SelectField>
            ) : (
              <SelectField
                label="Class"
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
              >
                <option value="">Select class</option>
                {activeClasses.map((classRecord) => (
                  <option key={classRecord.id} value={classRecord.id}>
                    {buildOwnerLabel(classRecord, 'class')}
                  </option>
                ))}
              </SelectField>
            )}

            <SelectField
              label="Time structure"
              value={selectedTimeStructureId}
              onChange={(event) => setSelectedTimeStructureId(event.target.value)}
            >
              <option value="">Select time structure</option>
              {timeStructures.map((timeStructure) => (
                <option key={timeStructure.id} value={timeStructure.id}>
                  {timeStructure.name}
                </option>
              ))}
            </SelectField>

            <div className="timetable-filter-card">
              <span className="form-field__label">Active window</span>
              <div className="timetable-filter-card__body">
                <strong>{activeTerm?.name || 'No active term'}</strong>
                <span>{activeAcademicYear?.label || 'Configure academic year'}</span>
              </div>
            </div>
          </div>
        </section>

        <PresenceIndicator
          activeSessions={editingSession.activeSessions}
          currentUserId={editingSession.currentUserSession?.userId || ''}
          error={editingSession.error}
          otherEditors={editingSession.otherEditors}
          resourceLabel={editingResource?.resourceLabel || ''}
          softLockActive={softLockActive}
          status={editingSession.status}
          supportsEditing={timetableType === 'class'}
        />

        <div className="timetable-layout-grid">
          <div className="timetable-sidebar">
            <section className="academic-form-card">
              <div className="academic-list-card__header">
                <div>
                  <p className="auth-card__eyebrow">Entry editor</p>
                  <h2 className="academic-list-card__title">Create Timetable Entry</h2>
                </div>
                {selectedTimeSlot ? (
                  <StatusPill tone="info">
                    {selectedTimeSlot.weekdayKey} | {selectedTimeSlot.startTime} - {selectedTimeSlot.endTime}
                  </StatusPill>
                ) : (
                  <StatusPill tone="neutral">Select a teaching slot</StatusPill>
                )}
              </div>

              {feedback.message ? <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage> : null}

              {softLockActive && timetableType === 'class' ? (
                <FormMessage tone="warning">
                  Soft lock is active. You can keep reviewing live updates, but lesson changes are
                  temporarily paused.
                </FormMessage>
              ) : null}

              {timetableType !== 'class' ? (
                <FormMessage tone="info">
                  Teacher and room grids are synchronized from class timetable entries to keep one source of truth.
                </FormMessage>
              ) : classOfferings.length === 0 ? (
                <FormMessage tone="info">
                  Create teaching assignments for this class before scheduling its timetable.
                </FormMessage>
              ) : (
                <form className="academic-form" onSubmit={handleSaveEntry}>
                  <SelectField
                    label="Subject offering"
                    value={selectedOfferingId}
                    onChange={(event) => setSelectedOfferingId(event.target.value)}
                  >
                    <option value="">Select subject offering</option>
                    {classOfferings.map((offering) => (
                      <option key={offering.id} value={offering.id}>
                        {[offering.subjectName, offering.subjectCode].filter(Boolean).join(' | ')}
                      </option>
                    ))}
                  </SelectField>

                  <SelectField
                    label="Section"
                    value={selectedSectionId}
                    onChange={(event) => setSelectedSectionId(event.target.value)}
                  >
                    <option value="">Select section</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {[section.name, section.sectionType === 'subgroup' ? 'Subgroup' : 'Full Class']
                          .filter(Boolean)
                          .join(' | ')}
                      </option>
                    ))}
                  </SelectField>

                  <SelectField
                    label="Room"
                    value={selectedEntryRoomId}
                    onChange={(event) => setSelectedEntryRoomId(event.target.value)}
                  >
                    <option value="">Select room</option>
                    {activeClassrooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {buildOwnerLabel(room, 'room')}
                      </option>
                    ))}
                  </SelectField>

                <div className="timetable-helper-card">
                  <span className="form-field__label">Assigned teachers</span>
                  {sectionAssignments.length === 0 ? (
                    <p className="academic-empty-state">
                      This section has no assigned teacher yet.
                      </p>
                    ) : (
                      <div className="academic-summary__grid">
                        {sectionAssignments.map((assignment) => (
                          <StatusPill key={assignment.id} tone="neutral">
                            {assignment.teacherName}
                          </StatusPill>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="timetable-helper-card">
                    <span className="form-field__label">Conflict detection</span>
                    {conflictStatus === 'loading' ? (
                      <FormMessage tone="info">
                        Checking teacher, classroom, class, PLC, and max-hours rules.
                      </FormMessage>
                    ) : null}
                    {conflictStatus !== 'loading' && canPreviewConflicts ? (
                      <div className="timetable-conflict-stack">
                        <ConflictIssueGroup issues={conflicts.error} title="Errors" tone="error" />
                        <ConflictIssueGroup
                          issues={conflicts.warning}
                          title="Warnings"
                          tone="warning"
                        />
                        <ConflictIssueGroup issues={conflicts.info} title="Info" tone="info" />
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={!formReady || softLockActive}
                  >
                    Save lesson
                  </button>
                </form>
              )}
            </section>

            <TimetableSuggestionsPanel
              canSuggest={canSuggestSlots}
              isAutoPlacing={isAutoPlacing}
              isLoading={suggestionStatus === 'loading'}
              onAutoPlaceBest={handleAutoPlaceBestSuggestion}
              onSelectSuggestion={setSelectedTimeSlotId}
              selectedTimeSlotId={effectiveSelectedTimeSlotId}
              softLockActive={softLockActive}
              suggestionResult={suggestionResult}
            />

            <section className="academic-list-card">
              <div className="academic-list-card__header">
                <div>
                  <p className="auth-card__eyebrow">Selected slot</p>
                  <h2 className="academic-list-card__title">Slot Details</h2>
                </div>
                {selectedTimeSlot ? (
                  <StatusPill tone={selectedTimeSlot.slotType === 'teaching' ? 'success' : 'info'}>
                    {selectedTimeSlot.slotType}
                  </StatusPill>
                ) : null}
              </div>

              {selectedTimeSlot ? (
                <div className="timetable-slot-meta">
                  <p>
                    {selectedTimeSlot.weekdayKey} | {selectedTimeSlot.startTime} - {selectedTimeSlot.endTime}
                  </p>
                  <p>slotId: {selectedTimeSlot.id}</p>
                </div>
              ) : (
                <p className="academic-empty-state">Select a teaching slot from the grid.</p>
              )}

              <div className="academic-record-list">
                {selectedCellEntries.length === 0 ? (
                  <p className="academic-empty-state">No lessons are scheduled in this slot.</p>
                ) : (
                  selectedCellEntries.map((entry) => (
                    <article key={entry.id} className="academic-record-card">
                      <div className="academic-record-card__header">
                        <div>
                          <h3>{entry.subjectName}</h3>
                          {buildEntryDetailLines(entry, timetableType).map((line) => (
                            <p key={`${entry.id}-${line}`}>{line}</p>
                          ))}
                        </div>
                        {timetableType === 'class' ? (
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={softLockActive}
                            onClick={() => {
                              void handleDeleteEntry(entry.id);
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <TimetableGrid
            entries={entries}
            onSelectTimeSlot={setSelectedTimeSlotId}
            selectedTimeSlotId={effectiveSelectedTimeSlotId}
            timeSlotsByWeekday={timeSlotsByWeekday}
            timetableType={timetableType}
            weekdays={weekdays}
          />
        </div>
      </div>
    </AcademicPageShell>
  );
}
