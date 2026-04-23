import { listAcademicYearsBySchool } from '../../academic/api/academicYearRepository';
import { listTermsBySchool } from '../../academic/api/termRepository';
import { getActiveTerm } from '../../academic/helpers/getActiveTerm';
import { listMasterDataRecords } from '../../master-data/api/masterDataRepository';
import { listPlcPoliciesBySchool } from '../../plc/api/plcPolicyRepository';
import { listTeacherPlcAssignmentsBySchool } from '../../plc/api/teacherPlcAssignmentRepository';
import { listTeacherWorkloadPoliciesBySchool } from '../../plc/api/teacherWorkloadPolicyRepository';
import { listTeacherAbsencesBySchool } from '../../substitutions/api/teacherAbsenceRepository';
import { listSubstitutionsBySchool } from '../../substitutions/api/substitutionRepository';
import { listTimeStructuresBySchool } from '../../time-structure/api/timeStructureRepository';
import { listTimeSlotsByTimeStructure } from '../../time-structure/api/timeSlotRepository';
import { listTimetableEntriesByContext } from '../../timetable/api/timetableRepository';

const MASTER_DATA_COLLECTIONS = [
  'learningAreas',
  'subjects',
  'teachers',
  'students',
  'classes',
  'classrooms',
  'activities',
];
const ADMIN_ROLES = new Set(['super_admin', 'school_admin']);
const WARNING_THRESHOLD_RATIO = 0.9;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeName(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function parseTimeToMinutes(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return 0;
  }

  const [hoursText, minutesText] = value.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }

  return hours * 60 + minutes;
}

function calculateDurationMinutes(startTime, endTime) {
  return Math.max(parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime), 0);
}

function formatMinutes(minutes) {
  const safeMinutes = Math.max(Math.round(Number(minutes) || 0), 0);
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function formatHours(value) {
  const safeValue = Number(value) || 0;

  if (Number.isInteger(safeValue)) {
    return `${safeValue}h`;
  }

  return `${safeValue.toFixed(1)}h`;
}

function formatPercent(value) {
  const safeValue = Math.max(Math.round(Number(value) || 0), 0);
  return `${safeValue}%`;
}

function uniqueCount(values = []) {
  return new Set(values.filter(Boolean)).size;
}

function sumDurationMinutes(items = []) {
  return items.reduce((total, item) => total + (Number(item.durationMinutes) || 0), 0);
}

function createIssueBuckets() {
  return {
    error: [],
    warning: [],
    info: [],
    keys: {
      error: new Set(),
      warning: new Set(),
      info: new Set(),
    },
  };
}

function addIssue(buckets, severity, { key, ...issue }) {
  const dedupeKey = key || `${issue.code}:${issue.message}`;

  if (buckets.keys[severity].has(dedupeKey)) {
    return;
  }

  buckets.keys[severity].add(dedupeKey);
  buckets[severity].push(issue);
}

function finalizeIssues(buckets) {
  const sortIssues = (issues = []) =>
    [...issues].sort((left, right) => {
      if ((right.count || 1) !== (left.count || 1)) {
        return (right.count || 1) - (left.count || 1);
      }

      return left.message.localeCompare(right.message);
    });

  return {
    error: sortIssues(buckets.error),
    warning: sortIssues(buckets.warning),
    info: sortIssues(buckets.info),
    errorCount: buckets.error.length,
    warningCount: buckets.warning.length,
    infoCount: buckets.info.length,
  };
}

function buildSlotLabel(record) {
  const timeRange =
    record.startTime && record.endTime
      ? `${record.startTime} - ${record.endTime}`
      : 'Time not set';

  return [record.timeStructureName || '', record.weekdayLabel || '', timeRange]
    .filter(Boolean)
    .join(' | ');
}

function formatEntryReference(entry) {
  return [entry.subjectName || 'Subject', entry.className || 'Class', entry.sectionName || '']
    .filter(Boolean)
    .join(' | ');
}

function createTimeSlotDurationMap(timeSlots = []) {
  return new Map(
    timeSlots
      .filter((timeSlot) => timeSlot.slotType === 'teaching')
      .map((timeSlot) => [
        timeSlot.id,
        calculateDurationMinutes(timeSlot.startTime, timeSlot.endTime),
      ]),
  );
}

function sumTeachingCapacityMinutes(timeSlots = [], weekdayKey = '') {
  return timeSlots.reduce((total, timeSlot) => {
    if (timeSlot.slotType !== 'teaching') {
      return total;
    }

    if (weekdayKey && timeSlot.weekdayKey !== weekdayKey) {
      return total;
    }

    return total + calculateDurationMinutes(timeSlot.startTime, timeSlot.endTime);
  }, 0);
}

function getUniqueTeachingMinutes(entries = [], timeSlotDurationMap, weekdayKey = '') {
  const uniqueSlotIds = new Set();
  let totalMinutes = 0;

  entries.forEach((entry) => {
    if (entry.status === 'inactive' || entry.slotType !== 'teaching') {
      return;
    }

    if (weekdayKey && entry.weekdayKey !== weekdayKey) {
      return;
    }

    if (!entry.timeSlotId || uniqueSlotIds.has(entry.timeSlotId)) {
      return;
    }

    uniqueSlotIds.add(entry.timeSlotId);
    totalMinutes +=
      timeSlotDurationMap.get(entry.timeSlotId) ||
      calculateDurationMinutes(entry.startTime, entry.endTime);
  });

  return totalMinutes;
}

function intervalsOverlap(left, right) {
  const leftStart = parseTimeToMinutes(left.startTime);
  const leftEnd = parseTimeToMinutes(left.endTime);
  const rightStart = parseTimeToMinutes(right.startTime);
  const rightEnd = parseTimeToMinutes(right.endTime);

  return leftStart < rightEnd && rightStart < leftEnd;
}

function getTeacherNameFromEntry(entry, teacherId) {
  const teacherIndex = entry.teacherIds.findIndex((candidateId) => candidateId === teacherId);
  return entry.teacherNames[teacherIndex] || entry.teacherDisplay || 'Teacher';
}

function prioritizeTeachers(teachers = []) {
  return [...teachers].sort((left, right) => {
    if (left.status === 'active' && right.status !== 'active') {
      return -1;
    }

    if (left.status !== 'active' && right.status === 'active') {
      return 1;
    }

    return (left.displayName || '').localeCompare(right.displayName || '');
  });
}

function findTeacherByProfile(profile, teachers = []) {
  const orderedTeachers = prioritizeTeachers(teachers);
  const email = normalizeEmail(profile?.email);
  const name = normalizeName(profile?.displayName);

  if (email) {
    const emailMatches = orderedTeachers.filter(
      (teacher) => normalizeEmail(teacher.email) === email,
    );

    if (emailMatches.length > 0) {
      return emailMatches[0];
    }
  }

  if (name) {
    const nameMatches = orderedTeachers.filter(
      (teacher) => normalizeName(teacher.displayName) === name,
    );

    if (nameMatches.length > 0) {
      return nameMatches[0];
    }
  }

  return null;
}

function findMasterTeacherMatches({ email, name, teachers = [] }) {
  const orderedTeachers = prioritizeTeachers(teachers);
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeName(name);

  if (normalizedEmail) {
    const emailMatches = orderedTeachers.filter(
      (teacher) => normalizeEmail(teacher.email) === normalizedEmail,
    );

    if (emailMatches.length > 0) {
      return [emailMatches[0]];
    }
  }

  if (normalizedName) {
    const nameMatches = orderedTeachers.filter(
      (teacher) => normalizeName(teacher.displayName) === normalizedName,
    );

    if (nameMatches.length === 1) {
      return nameMatches;
    }
  }

  return [];
}

function buildPlcAssignmentsByMasterTeacherId({ teacherPlcAssignments, teachers }) {
  const assignmentsByTeacherId = new Map();

  teachers.forEach((teacher) => {
    assignmentsByTeacherId.set(teacher.id, []);
  });

  teacherPlcAssignments.forEach((assignment) => {
    findMasterTeacherMatches({
      email: assignment.teacherEmail,
      name: assignment.teacherName,
      teachers,
    }).forEach((teacher) => {
      const currentAssignments = assignmentsByTeacherId.get(teacher.id) || [];
      currentAssignments.push(assignment);
      assignmentsByTeacherId.set(teacher.id, currentAssignments);
    });
  });

  return assignmentsByTeacherId;
}

function getFilteredActiveEntries(timetableEntries = []) {
  return timetableEntries.filter(
    (entry) => entry.status !== 'inactive' && entry.slotType === 'teaching',
  );
}

function addTeacherLoadIssues({
  buckets,
  entries,
  plcAssignments = [],
  teacherId,
  teacherName,
  timeSlots,
  timeStructureName,
}) {
  if (!teacherId || entries.length === 0 || timeSlots.length === 0) {
    return;
  }

  const durationMap = createTimeSlotDurationMap(timeSlots);
  const weeklyCapacityMinutes = sumTeachingCapacityMinutes(timeSlots);
  const weeklyTeachingMinutes = getUniqueTeachingMinutes(entries, durationMap);
  const weekdayKeys = Array.from(
    new Set(timeSlots.map((timeSlot) => timeSlot.weekdayKey).filter(Boolean)),
  );

  if (weeklyCapacityMinutes > 0 && weeklyTeachingMinutes > weeklyCapacityMinutes) {
    addIssue(buckets, 'error', {
      key: `teacher-load-weekly-error:${teacherId}:${entries[0]?.timeStructureId || ''}`,
      code: 'max_hours_weekly',
      message: `${teacherName} exceeds weekly teaching capacity in ${timeStructureName || 'the active time structure'} (${formatMinutes(weeklyTeachingMinutes)} / ${formatMinutes(weeklyCapacityMinutes)}).`,
    });
  } else if (
    weeklyCapacityMinutes > 0 &&
    weeklyTeachingMinutes >= weeklyCapacityMinutes * WARNING_THRESHOLD_RATIO
  ) {
    addIssue(buckets, 'warning', {
      key: `teacher-load-weekly-warning:${teacherId}:${entries[0]?.timeStructureId || ''}`,
      code: 'max_hours_weekly_warning',
      message: `${teacherName} is near weekly teaching capacity in ${timeStructureName || 'the active time structure'} (${formatMinutes(weeklyTeachingMinutes)} / ${formatMinutes(weeklyCapacityMinutes)}).`,
    });
  }

  weekdayKeys.forEach((weekdayKey) => {
    const dailyCapacityMinutes = sumTeachingCapacityMinutes(timeSlots, weekdayKey);
    const dailyTeachingMinutes = getUniqueTeachingMinutes(entries, durationMap, weekdayKey);
    const weekdayLabel =
      entries.find((entry) => entry.weekdayKey === weekdayKey)?.weekdayLabel || weekdayKey;

    if (dailyCapacityMinutes > 0 && dailyTeachingMinutes > dailyCapacityMinutes) {
      addIssue(buckets, 'error', {
        key: `teacher-load-daily-error:${teacherId}:${entries[0]?.timeStructureId || ''}:${weekdayKey}`,
        code: 'max_hours_daily',
        message: `${teacherName} exceeds ${weekdayLabel} teaching capacity in ${timeStructureName || 'the active time structure'} (${formatMinutes(dailyTeachingMinutes)} / ${formatMinutes(dailyCapacityMinutes)}).`,
      });
    } else if (
      dailyCapacityMinutes > 0 &&
      dailyTeachingMinutes >= dailyCapacityMinutes * WARNING_THRESHOLD_RATIO
    ) {
      addIssue(buckets, 'warning', {
        key: `teacher-load-daily-warning:${teacherId}:${entries[0]?.timeStructureId || ''}:${weekdayKey}`,
        code: 'max_hours_daily_warning',
        message: `${teacherName} is near ${weekdayLabel} teaching capacity in ${timeStructureName || 'the active time structure'} (${formatMinutes(dailyTeachingMinutes)} / ${formatMinutes(dailyCapacityMinutes)}).`,
      });
    }
  });

  addIssue(buckets, 'info', {
    key: `teacher-load-info:${teacherId}:${entries[0]?.timeStructureId || ''}`,
    code: 'teacher_load_info',
    message: `${teacherName} weekly load: ${formatMinutes(weeklyTeachingMinutes)} teaching and ${formatMinutes(sumDurationMinutes(plcAssignments))} PLC.`,
  });
}

function buildSchoolConflictSummary({
  activeTerm,
  teacherPlcAssignments,
  teachers,
  timeSlots,
  timetableEntries,
}) {
  const buckets = createIssueBuckets();
  const activeEntries = getFilteredActiveEntries(timetableEntries);
  const plcAssignmentsByMasterTeacherId = buildPlcAssignmentsByMasterTeacherId({
    teacherPlcAssignments,
    teachers,
  });

  if (!activeTerm?.id) {
    addIssue(buckets, 'info', {
      key: 'school-conflict:no-active-term',
      code: 'missing_active_term',
      message: 'Set an active academic term before dashboard conflict checks can evaluate timetable health.',
    });

    return finalizeIssues(buckets);
  }

  if (activeEntries.length === 0) {
    addIssue(buckets, 'info', {
      key: 'school-conflict:no-entries',
      code: 'no_timetable_entries',
      message: `No scheduled teaching entries were found for ${activeTerm.name || 'the active term'}.`,
    });

    return finalizeIssues(buckets);
  }

  addIssue(buckets, 'info', {
    key: 'school-conflict:reviewed-context',
    code: 'reviewed_timetable_context',
    message: `Reviewed ${activeEntries.length} teaching entry(s) in ${activeTerm.name || 'the active term'} for dashboard conflict checks.`,
  });

  const teacherGroups = new Map();
  const classroomGroups = new Map();
  const classGroups = new Map();
  const teacherEntriesByStructure = new Map();
  const timeSlotsByStructureId = new Map();

  activeEntries.forEach((entry) => {
    entry.teacherIds.forEach((teacherId) => {
      if (!teacherId) {
        return;
      }

      const teacherGroupKey = [entry.timeStructureId, entry.timeSlotId, teacherId].join(':');
      const teacherGroup = teacherGroups.get(teacherGroupKey) || {
        teacherId,
        teacherName: getTeacherNameFromEntry(entry, teacherId),
        entries: [],
        slot: entry,
      };

      teacherGroup.entries.push(entry);
      teacherGroups.set(teacherGroupKey, teacherGroup);

      const teacherStructureKey = [teacherId, entry.timeStructureId].join(':');
      const teacherStructureGroup = teacherEntriesByStructure.get(teacherStructureKey) || {
        teacherId,
        teacherName: getTeacherNameFromEntry(entry, teacherId),
        entries: [],
        timeStructureId: entry.timeStructureId,
        timeStructureName: entry.timeStructureName || '',
      };

      teacherStructureGroup.entries.push(entry);
      teacherEntriesByStructure.set(teacherStructureKey, teacherStructureGroup);
    });

    if (entry.classroomId) {
      const classroomGroupKey = [entry.timeStructureId, entry.timeSlotId, entry.classroomId].join(
        ':',
      );
      const classroomGroup = classroomGroups.get(classroomGroupKey) || {
        classroomId: entry.classroomId,
        classroomName: entry.classroomName || 'Room',
        entries: [],
        slot: entry,
      };

      classroomGroup.entries.push(entry);
      classroomGroups.set(classroomGroupKey, classroomGroup);
    }

    if (entry.classId) {
      const classGroupKey = [entry.timeStructureId, entry.timeSlotId, entry.classId].join(':');
      const classGroup = classGroups.get(classGroupKey) || {
        classId: entry.classId,
        className: entry.className || 'Class',
        entries: [],
        slot: entry,
      };

      classGroup.entries.push(entry);
      classGroups.set(classGroupKey, classGroup);
    }
  });

  timeSlots.forEach((timeSlot) => {
    const structureSlots = timeSlotsByStructureId.get(timeSlot.timeStructureId) || [];
    structureSlots.push(timeSlot);
    timeSlotsByStructureId.set(timeSlot.timeStructureId, structureSlots);
  });

  teacherGroups.forEach((group) => {
    if (group.entries.length <= 1) {
      return;
    }

    addIssue(buckets, 'error', {
      key: `teacher-conflict:${group.slot.timeStructureId}:${group.slot.timeSlotId}:${group.teacherId}`,
      code: 'teacher_conflict',
      count: group.entries.length,
      message: `${group.teacherName} is double-booked in ${buildSlotLabel(group.slot)} across ${group.entries.map(formatEntryReference).join(', ')}.`,
    });
  });

  classroomGroups.forEach((group) => {
    if (group.entries.length <= 1) {
      return;
    }

    addIssue(buckets, 'error', {
      key: `classroom-conflict:${group.slot.timeStructureId}:${group.slot.timeSlotId}:${group.classroomId}`,
      code: 'classroom_conflict',
      count: group.entries.length,
      message: `${group.classroomName} is double-booked in ${buildSlotLabel(group.slot)} across ${group.entries.map(formatEntryReference).join(', ')}.`,
    });
  });

  classGroups.forEach((group) => {
    const fullClassEntries = group.entries.filter((entry) => entry.sectionType === 'full_class');
    const subgroupEntries = group.entries.filter((entry) => entry.sectionType === 'subgroup');
    const subgroupCounts = subgroupEntries.reduce((counts, entry) => {
      counts.set(entry.sectionId, (counts.get(entry.sectionId) || 0) + 1);
      return counts;
    }, new Map());

    if (fullClassEntries.length > 1) {
      addIssue(buckets, 'error', {
        key: `class-conflict:full-class:${group.slot.timeStructureId}:${group.slot.timeSlotId}:${group.classId}`,
        code: 'class_conflict',
        count: fullClassEntries.length,
        message: `${group.className} has multiple full-class lessons scheduled in ${buildSlotLabel(group.slot)}.`,
      });
    }

    if (fullClassEntries.length > 0 && subgroupEntries.length > 0) {
      addIssue(buckets, 'error', {
        key: `class-conflict:mixed:${group.slot.timeStructureId}:${group.slot.timeSlotId}:${group.classId}`,
        code: 'class_conflict_mixed',
        count: group.entries.length,
        message: `${group.className} mixes full-class and subgroup lessons in ${buildSlotLabel(group.slot)}.`,
      });
    }

    subgroupCounts.forEach((count, sectionId) => {
      if (count <= 1) {
        return;
      }

      const sectionName =
        subgroupEntries.find((entry) => entry.sectionId === sectionId)?.sectionName || 'Subgroup';

      addIssue(buckets, 'error', {
        key: `class-conflict:subgroup:${group.slot.timeStructureId}:${group.slot.timeSlotId}:${sectionId}`,
        code: 'class_conflict_subgroup',
        count,
        message: `${group.className} repeats subgroup ${sectionName} in ${buildSlotLabel(group.slot)}.`,
      });
    });
  });

  activeEntries.forEach((entry) => {
    entry.teacherIds.forEach((teacherId) => {
      const matchingPlcAssignments = plcAssignmentsByMasterTeacherId.get(teacherId) || [];

      matchingPlcAssignments.forEach((assignment) => {
        if (
          assignment.timeStructureId !== entry.timeStructureId ||
          assignment.weekdayKey !== entry.weekdayKey ||
          !assignment.blocksTeacherTime ||
          !intervalsOverlap(entry, assignment)
        ) {
          return;
        }

        addIssue(buckets, 'error', {
          key: `plc-conflict:${entry.id}:${assignment.id}:${teacherId}`,
          code: 'plc_conflict',
          message: `${getTeacherNameFromEntry(entry, teacherId)} overlaps a PLC block in ${buildSlotLabel(entry)}.`,
        });
      });
    });
  });

  teacherEntriesByStructure.forEach((group) => {
    addTeacherLoadIssues({
      buckets,
      entries: group.entries,
      plcAssignments: (plcAssignmentsByMasterTeacherId.get(group.teacherId) || []).filter(
        (assignment) => assignment.timeStructureId === group.timeStructureId,
      ),
      teacherId: group.teacherId,
      teacherName: group.teacherName,
      timeSlots: timeSlotsByStructureId.get(group.timeStructureId) || [],
      timeStructureName: group.timeStructureName,
    });
  });

  if (buckets.error.length === 0 && buckets.warning.length === 0) {
    addIssue(buckets, 'info', {
      key: 'school-conflict:no-blocking-issues',
      code: 'no_blocking_conflicts',
      message: 'No blocking timetable conflicts were found in the active dashboard context.',
    });
  }

  return finalizeIssues(buckets);
}

function buildTeacherConflictSummary({
  activeTerm,
  matchedTeacher,
  profile,
  teacherPlcAssignments,
  timeSlots,
  timetableEntries,
}) {
  const buckets = createIssueBuckets();
  const activeEntries = getFilteredActiveEntries(timetableEntries);

  if (!activeTerm?.id) {
    addIssue(buckets, 'info', {
      key: 'teacher-conflict:no-active-term',
      code: 'missing_active_term',
      message: 'Set an active academic term before the dashboard can evaluate your timetable alerts.',
    });

    return finalizeIssues(buckets);
  }

  if (!matchedTeacher) {
    addIssue(buckets, 'warning', {
      key: 'teacher-conflict:no-master-match',
      code: 'teacher_profile_unmatched',
      message:
        'Your auth profile could not be matched to a teacher master-data record, so timetable and substitution alerts may be incomplete.',
    });

    return finalizeIssues(buckets);
  }

  const personalEntries = activeEntries.filter((entry) => entry.teacherIds.includes(matchedTeacher.id));
  const personalPlcAssignments = teacherPlcAssignments.filter(
    (assignment) => assignment.teacherId === profile?.uid,
  );
  const teacherGroups = new Map();
  const timeSlotsByStructureId = new Map();

  if (personalEntries.length === 0) {
    addIssue(buckets, 'info', {
      key: 'teacher-conflict:no-personal-entries',
      code: 'no_personal_timetable_entries',
      message: `No scheduled lessons were found for ${matchedTeacher.displayName || 'this teacher'} in ${activeTerm.name || 'the active term'}.`,
    });

    if (personalPlcAssignments.length > 0) {
      addIssue(buckets, 'info', {
        key: 'teacher-conflict:plc-only',
        code: 'plc_blocks_present',
        message: `Your dashboard still found ${personalPlcAssignments.length} PLC block(s) from your auth teacher profile.`,
      });
    }

    return finalizeIssues(buckets);
  }

  addIssue(buckets, 'info', {
    key: 'teacher-conflict:reviewed-context',
    code: 'reviewed_timetable_context',
    message: `Reviewed ${personalEntries.length} of your lesson(s) in ${activeTerm.name || 'the active term'}.`,
  });

  personalEntries.forEach((entry) => {
    const groupKey = [entry.timeStructureId, entry.timeSlotId].join(':');
    const group = teacherGroups.get(groupKey) || {
      entries: [],
      slot: entry,
    };

    group.entries.push(entry);
    teacherGroups.set(groupKey, group);
  });

  timeSlots.forEach((timeSlot) => {
    const structureSlots = timeSlotsByStructureId.get(timeSlot.timeStructureId) || [];
    structureSlots.push(timeSlot);
    timeSlotsByStructureId.set(timeSlot.timeStructureId, structureSlots);
  });

  teacherGroups.forEach((group) => {
    if (group.entries.length <= 1) {
      return;
    }

    addIssue(buckets, 'error', {
      key: `teacher-conflict:personal:${group.slot.timeStructureId}:${group.slot.timeSlotId}`,
      code: 'teacher_conflict',
      count: group.entries.length,
      message: `You are double-booked in ${buildSlotLabel(group.slot)} across ${group.entries.map(formatEntryReference).join(', ')}.`,
    });
  });

  personalEntries.forEach((entry) => {
    personalPlcAssignments.forEach((assignment) => {
      if (
        assignment.timeStructureId !== entry.timeStructureId ||
        assignment.weekdayKey !== entry.weekdayKey ||
        !assignment.blocksTeacherTime ||
        !intervalsOverlap(entry, assignment)
      ) {
        return;
      }

      addIssue(buckets, 'error', {
        key: `teacher-conflict:plc:${entry.id}:${assignment.id}`,
        code: 'plc_conflict',
        message: `One of your lessons overlaps a PLC block in ${buildSlotLabel(entry)}.`,
      });
    });
  });

  Array.from(
    new Set(personalEntries.map((entry) => entry.timeStructureId).filter(Boolean)),
  ).forEach((timeStructureId) => {
    const structureEntries = personalEntries.filter(
      (entry) => entry.timeStructureId === timeStructureId,
    );
    const structureName = structureEntries[0]?.timeStructureName || 'the active time structure';

    addTeacherLoadIssues({
      buckets,
      entries: structureEntries,
      plcAssignments: personalPlcAssignments.filter(
        (assignment) => assignment.timeStructureId === timeStructureId,
      ),
      teacherId: matchedTeacher.id,
      teacherName: matchedTeacher.displayName || 'Teacher',
      timeSlots: timeSlotsByStructureId.get(timeStructureId) || [],
      timeStructureName: structureName,
    });
  });

  if (buckets.error.length === 0 && buckets.warning.length === 0) {
    addIssue(buckets, 'info', {
      key: 'teacher-conflict:no-blocking-issues',
      code: 'no_blocking_conflicts',
      message: 'No blocking timetable alerts were found in your active dashboard context.',
    });
  }

  return finalizeIssues(buckets);
}

function getDashboardView(role) {
  if (ADMIN_ROLES.has(role)) {
    return 'admin';
  }

  if (role === 'academic_admin') {
    return 'academic_admin';
  }

  if (role === 'teacher') {
    return 'teacher';
  }

  return 'admin';
}

function getDashboardMeta(view) {
  if (view === 'academic_admin') {
    return {
      description:
        'ติดตามความพร้อมของภาคเรียน คุณภาพตารางสอน PLC และการสอนแทนจากหน้าปฏิบัติการเดียว',
      eyebrow: 'งานวิชาการ',
      title: 'แดชบอร์ดฝ่ายวิชาการ',
    };
  }

  if (view === 'teacher') {
    return {
      description:
        'ดูภาระสอน ตารางของตนเอง การแจ้งเตือน PLC และงานสอนแทนในหน้ารวมเดียว',
      eyebrow: 'ภาพรวมครู',
      title: 'แดชบอร์ดครู',
    };
  }

  return {
    description:
      'ติดตามข้อมูลตั้งต้นโรงเรียน สุขภาพตารางสอน PLC และความพร้อมการสอนแทนจากแดชบอร์ดของโรงเรียน',
    eyebrow: 'ภาพรวมโรงเรียน',
    title: 'แดชบอร์ดผู้ดูแล',
  };
}

function buildBaseSummaryPills({
  conflictSummary,
  openCoverageCount,
  profile,
  timetableEntryCount,
  activeTerm,
  view,
}) {
  const viewLabel =
    view === 'teacher'
      ? 'มุมมองครู'
      : view === 'academic_admin'
        ? 'มุมมองฝ่ายวิชาการ'
        : 'มุมมองผู้ดูแล';

  return [
    { label: viewLabel, tone: 'info' },
    {
      label: activeTerm?.name ? `ภาคเรียน: ${activeTerm.name}` : 'ยังไม่ตั้งค่าภาคเรียน',
      tone: activeTerm?.id ? 'success' : 'warning',
    },
    {
      label:
        view === 'teacher'
          ? `คาบสอนของฉัน: ${timetableEntryCount}`
          : `คาบสอน: ${timetableEntryCount}`,
      tone: 'neutral',
    },
    {
      label: `ข้อผิดพลาด: ${conflictSummary.errorCount}`,
      tone: conflictSummary.errorCount > 0 ? 'error' : 'success',
    },
    {
      label: `รอสอนแทน: ${openCoverageCount}`,
      tone: openCoverageCount > 0 ? 'warning' : 'success',
    },
    {
      label: profile?.displayName || 'บัญชีผู้ใช้',
      tone: 'neutral',
    },
  ];
}

function buildCountsSection({
  activeAcademicYear,
  activeTerm,
  recordsByCollection,
  timetableEntries,
  timeStructures,
  view,
  personalCounts,
}) {
  if (view === 'teacher') {
    return {
      actionHref: '/app/timetable',
      actionLabel: 'Open timetable',
      description: 'Your teaching footprint in the active school and term context.',
      eyebrow: 'Counts',
      items: [
        {
          detail: activeTerm?.name
            ? `Scheduled in ${activeTerm.name}`
            : 'No active term selected',
          href: '/app/timetable',
          label: 'My lessons',
          value: personalCounts.lessonCount,
        },
        {
          detail: 'Unique class groups in your timetable',
          href: '/app/timetable',
          label: 'My classes',
          value: personalCounts.classCount,
        },
        {
          detail: 'Unique subjects in your current lessons',
          href: '/app/timetable',
          label: 'My subjects',
          value: personalCounts.subjectCount,
        },
        {
          detail: 'Lessons where you are the substitute',
          href: '/app/substitutions',
          label: 'Substitute cover',
          value: personalCounts.substituteCoverCount,
        },
      ],
      title: 'My counts',
    };
  }

  if (view === 'academic_admin') {
    return {
      actionHref: '/app/timetable',
      actionLabel: 'Open timetable',
      description: 'Academic readiness counts grounded in the active term and current school setup.',
      eyebrow: 'Counts',
      items: [
        {
          detail: activeAcademicYear?.label || 'No active academic year',
          href: '/app/academic-years',
          label: 'Academic years',
          value: recordsByCollection.academicYears.length,
        },
        {
          detail: activeTerm?.name || 'No active term',
          href: '/app/terms',
          label: 'Terms',
          value: recordsByCollection.terms.length,
        },
        {
          detail: 'Configured timetable frameworks',
          href: '/app/time-structure',
          label: 'Time structures',
          value: timeStructures.length,
        },
        {
          detail: 'Classes with lessons in the active term',
          href: '/app/timetable',
          label: 'Scheduled classes',
          value: uniqueCount(timetableEntries.map((entry) => entry.classId)),
        },
        {
          detail: 'Teachers scheduled in the active term',
          href: '/app/timetable',
          label: 'Scheduled teachers',
          value: uniqueCount(timetableEntries.flatMap((entry) => entry.teacherIds || [])),
        },
        {
          detail: 'Rooms in the active timetable context',
          href: '/app/timetable',
          label: 'Scheduled rooms',
          value: uniqueCount(timetableEntries.map((entry) => entry.classroomId)),
        },
      ],
      title: 'Academic counts',
    };
  }

  return {
    actionHref: '/app/master-data',
    actionLabel: 'Open master data',
    description: 'School-scoped setup and live timetable counts for operational monitoring.',
    eyebrow: 'Counts',
    items: [
      {
        detail: 'Teacher master-data records',
        href: '/app/master-data/teachers',
        label: 'Teachers',
        value: recordsByCollection.teachers.length,
      },
      {
        detail: 'Student master-data records',
        href: '/app/master-data/students',
        label: 'Students',
        value: recordsByCollection.students.length,
      },
      {
        detail: 'Homeroom groups',
        href: '/app/master-data/classes',
        label: 'Classes',
        value: recordsByCollection.classes.length,
      },
      {
        detail: 'Core and elective subjects',
        href: '/app/master-data/subjects',
        label: 'Subjects',
        value: recordsByCollection.subjects.length,
      },
      {
        detail: 'Bookable teaching spaces',
        href: '/app/master-data/classrooms',
        label: 'Classrooms',
        value: recordsByCollection.classrooms.length,
      },
      {
        detail: activeTerm?.name
          ? `Scheduled in ${activeTerm.name}`
          : 'No active term selected',
        href: '/app/timetable',
        label: 'Timetable lessons',
        value: timetableEntries.length,
      },
    ],
    title: 'School counts',
  };
}

function buildPlcSection({
  activePlcPolicy,
  personalPlcAssignments,
  personalWorkloadPolicy,
  profile,
  teacherPlcAssignments,
  teacherWorkloadPolicies,
  view,
}) {
  const totalPlcHours = sumDurationMinutes(teacherPlcAssignments) / 60;
  const overrideCount = teacherWorkloadPolicies.filter(
    (policy) =>
      policy.plcEnabled === false ||
      policy.plcDayOverrides.length > 0 ||
      policy.plcHoursPerWeekOverride !== null,
  ).length;
  const policyDays = (activePlcPolicy?.plcDays || []).join(', ');

  if (view === 'teacher') {
    const personalPlcHours = sumDurationMinutes(personalPlcAssignments) / 60;
    const personalWeekdays = Array.from(
      new Set(
        personalPlcAssignments
          .sort((left, right) => left.weekdayOrder - right.weekdayOrder)
          .map((assignment) => assignment.weekdayLabel)
          .filter(Boolean),
      ),
    );
    const policyStatus =
      personalWorkloadPolicy?.plcEnabled === false
        ? 'Disabled'
        : personalWorkloadPolicy
          ? 'Override'
          : activePlcPolicy
            ? 'School policy'
            : 'Not set';

    return {
      actionHref: '/app/teacher-workload',
      actionLabel: 'Open teacher workload',
      description: 'PLC blocks linked to your auth teacher account.',
      eyebrow: 'PLC summary',
      items: [
        {
          detail: activePlcPolicy?.name || 'No active PLC policy',
          href: '/app/plc-policy',
          label: 'My PLC blocks',
          value: personalPlcAssignments.length,
        },
        {
          detail: personalWeekdays.join(', ') || 'No PLC days assigned',
          href: '/app/teacher-workload',
          label: 'My PLC hours',
          value: formatHours(personalPlcHours),
        },
        {
          detail:
            personalWorkloadPolicy?.plcEnabled === false
              ? 'Teacher override disables PLC'
              : activePlcPolicy?.timeStructureName || 'Time structure not set',
          href: '/app/teacher-workload',
          label: 'Policy status',
          value: policyStatus,
        },
      ],
      messages: [
        activePlcPolicy
          ? `School PLC policy: ${activePlcPolicy.name} | ${formatHours(activePlcPolicy.hoursPerWeek)} per week | ${policyDays || 'No PLC days'}`
          : 'No active PLC policy is configured yet.',
        personalPlcAssignments.length > 0
          ? `Your PLC profile uses auth teacher ID ${profile?.uid || 'unknown'}.`
          : 'No PLC blocks are currently assigned to your auth teacher account.',
      ],
      title: 'My PLC summary',
    };
  }

  return {
    actionHref: '/app/plc-policy',
    actionLabel: 'Open PLC policy',
    description: 'Weekly PLC configuration generated from the current school policy and teacher overrides.',
    eyebrow: 'PLC summary',
    items: [
      {
        detail: activePlcPolicy?.timeStructureName || 'No active time structure',
        href: '/app/plc-policy',
        label: 'Policies',
        value: activePlcPolicy?.name || 'No active policy',
      },
      {
        detail: `${teacherPlcAssignments.length} generated PLC block(s)`,
        href: '/app/plc-policy',
        label: 'Teachers with PLC',
        value: uniqueCount(teacherPlcAssignments.map((assignment) => assignment.teacherId)),
      },
      {
        detail: 'Teacher-specific PLC day or hour changes',
        href: '/app/teacher-workload',
        label: 'Overrides',
        value: overrideCount,
      },
      {
        detail: 'Total weekly PLC time across generated blocks',
        href: '/app/plc-policy',
        label: 'Weekly PLC hours',
        value: formatHours(totalPlcHours),
      },
    ],
    messages: [
      activePlcPolicy
        ? `${activePlcPolicy.name} runs after the last teaching period on ${policyDays || 'no selected PLC days'}.`
        : 'Activate a PLC policy to generate PLC blocks for teachers.',
    ],
    title: view === 'academic_admin' ? 'Academic PLC summary' : 'School PLC summary',
  };
}

function buildSubstituteSection({
  activeTerm,
  matchedTeacher,
  personalSubstituteAssignments,
  personalTeacherAbsences,
  substitutions,
  teacherAbsences,
  view,
}) {
  const substitutionCountByAbsenceId = substitutions.reduce((counts, substitution) => {
    counts.set(
      substitution.teacherAbsenceId,
      (counts.get(substitution.teacherAbsenceId) || 0) + 1,
    );
    return counts;
  }, new Map());
  const totalAffectedLessons = teacherAbsences.reduce(
    (total, absence) => total + (absence.affectedLessonCount || 0),
    0,
  );
  const openCoverageCount = Math.max(totalAffectedLessons - substitutions.length, 0);
  const coverageRate =
    totalAffectedLessons === 0
      ? 100
      : Math.round((substitutions.length / totalAffectedLessons) * 100);

  if (view === 'teacher') {
    const personalAffectedLessons = personalTeacherAbsences.reduce(
      (total, absence) => total + (absence.affectedLessonCount || 0),
      0,
    );
    const personalCoveredLessons = personalTeacherAbsences.reduce(
      (total, absence) => total + (substitutionCountByAbsenceId.get(absence.id) || 0),
      0,
    );
    const personalOpenCoverageCount = Math.max(
      personalAffectedLessons - personalCoveredLessons,
      0,
    );

    return {
      actionHref: '/app/substitutions',
      actionLabel: 'Open substitutions',
      description:
        'Your reported absences and substitute coverage assignments in the active term context.',
      eyebrow: 'Substitute summary',
      items: [
        {
          detail: 'Teacher absence records tied to your master-data teacher profile',
          href: '/app/teacher-absences',
          label: 'My absences',
          value: personalTeacherAbsences.length,
        },
        {
          detail: 'Lessons affected by your reported absences',
          href: '/app/teacher-absences',
          label: 'Lessons needing cover',
          value: personalAffectedLessons,
        },
        {
          detail: 'Still waiting for substitute coverage',
          href: '/app/substitutions',
          label: 'Open cover',
          value: personalOpenCoverageCount,
        },
        {
          detail: 'Lessons assigned to you as substitute',
          href: '/app/substitutions',
          label: 'Lessons I cover',
          value: personalSubstituteAssignments.length,
        },
      ],
      messages: [
        matchedTeacher
          ? `Teacher dashboard matched master-data profile: ${matchedTeacher.displayName || matchedTeacher.id}.`
          : 'Teacher dashboard could not match a master-data teacher record, so substitution totals may be limited.',
        activeTerm?.name
          ? `Substitute summary is scoped to ${activeTerm.name}.`
          : 'No active term is currently selected.',
      ],
      title: 'My substitute summary',
    };
  }

  return {
    actionHref: '/app/substitutions',
    actionLabel: 'Open substitutions',
    description: 'Teacher absence and substitute coverage status for the active term.',
    eyebrow: 'Substitute summary',
    items: [
      {
        detail: 'Teacher absence records in the active term',
        href: '/app/teacher-absences',
        label: 'Reported absences',
        value: teacherAbsences.length,
      },
      {
        detail: 'Lessons affected by current absences',
        href: '/app/substitutions',
        label: 'Affected lessons',
        value: totalAffectedLessons,
      },
      {
        detail: `Coverage rate ${formatPercent(coverageRate)}`,
        href: '/app/substitutions',
        label: 'Assigned cover',
        value: substitutions.length,
      },
      {
        detail: 'Lessons still missing a substitute teacher',
        href: '/app/substitutions',
        label: 'Open lessons',
        value: openCoverageCount,
      },
    ],
    messages: teacherAbsences
      .slice(0, 3)
      .map(
        (absence) =>
          `${absence.teacherName} | ${absence.date} | ${absence.affectedLessonCount || 0} affected lesson(s)`,
      ),
    title:
      view === 'academic_admin'
        ? 'Academic substitute summary'
        : 'School substitute summary',
  };
}

function buildKpis({
  conflictSummary,
  openCoverageCount,
  personalCounts,
  teacherPlcAssignments,
  view,
  recordsByCollection,
}) {
  if (view === 'teacher') {
    return [
      {
        description: 'Scheduled lessons in your current dashboard context',
        label: 'My Lessons',
        tone: 'neutral',
        value: personalCounts.lessonCount,
      },
      {
        description: 'Current timetable errors and warnings that affect you',
        label: 'My Alerts',
        tone:
          conflictSummary.errorCount > 0
            ? 'error'
            : conflictSummary.warningCount > 0
              ? 'warning'
              : 'success',
        value: conflictSummary.errorCount + conflictSummary.warningCount,
      },
      {
        description: 'PLC hours linked to your auth teacher account',
        label: 'PLC Load',
        tone: 'info',
        value: formatHours(personalCounts.plcHours),
      },
      {
        description: 'Lessons assigned to you as a substitute',
        label: 'Substitute Cover',
        tone: 'success',
        value: personalCounts.substituteCoverCount,
      },
    ];
  }

  if (view === 'academic_admin') {
    return [
      {
        description: 'Teaching entries in the active dashboard term',
        label: 'Active Lessons',
        tone: 'neutral',
        value: personalCounts.schoolLessonCount,
      },
      {
        description: 'Blocking timetable conflicts detected by the dashboard',
        label: 'Conflict Errors',
        tone: conflictSummary.errorCount > 0 ? 'error' : 'success',
        value: conflictSummary.errorCount,
      },
      {
        description: 'Teachers currently carrying generated PLC blocks',
        label: 'PLC Teachers',
        tone: 'info',
        value: uniqueCount(teacherPlcAssignments.map((assignment) => assignment.teacherId)),
      },
      {
        description: 'Lessons still waiting for substitute coverage',
        label: 'Open Cover',
        tone: openCoverageCount > 0 ? 'warning' : 'success',
        value: openCoverageCount,
      },
    ];
  }

  return [
    {
      description: 'Teacher master-data records',
      label: 'Teachers',
      tone: 'neutral',
      value: recordsByCollection.teachers.length,
    },
    {
      description: 'Student master-data records',
      label: 'Students',
      tone: 'neutral',
      value: recordsByCollection.students.length,
    },
    {
      description: 'Blocking timetable conflicts detected by the dashboard',
      label: 'Conflict Errors',
      tone: conflictSummary.errorCount > 0 ? 'error' : 'success',
      value: conflictSummary.errorCount,
    },
    {
      description: 'Lessons still waiting for substitute coverage',
      label: 'Open Cover',
      tone: openCoverageCount > 0 ? 'warning' : 'success',
      value: openCoverageCount,
    },
  ];
}

function buildConflictSection({ conflictSummary, view }) {
  return {
    actionHref: '/app/timetable',
    actionLabel: 'Open timetable',
    description:
      view === 'teacher'
        ? 'Your personal timetable alerts from the active term and PLC context.'
        : 'Conflict counts derived from the active timetable context and current PLC blocks.',
    eyebrow: 'Conflicts',
    ...conflictSummary,
    title: view === 'teacher' ? 'My conflicts' : 'Timetable conflicts',
  };
}

function buildNotices({
  activeTerm,
  matchedTeacher,
  profile,
  schoolId,
  teacherPlcAssignments,
  view,
}) {
  const notices = [];

  if (!schoolId) {
    notices.push({
      message: 'Select or create a school before dashboard data can be loaded.',
      tone: 'warning',
    });
  }

  if (!activeTerm?.id) {
    notices.push({
      message:
        'No active academic term is configured. Counts still load, but timetable conflicts and substitute summaries will stay limited.',
      tone: 'warning',
    });
  }

  if (view === 'teacher' && !matchedTeacher) {
    notices.push({
      message:
        'Your auth account could not be matched to a teacher master-data record. The dashboard still shows PLC data from your auth profile, but timetable and substitute totals may be partial until email or display name aligns.',
      tone: 'warning',
    });
  }

  if (
    view === 'teacher' &&
    teacherPlcAssignments.every((assignment) => assignment.teacherId !== profile?.uid)
  ) {
    notices.push({
      message:
        'No PLC blocks are currently linked to your auth teacher account. If PLC should apply, review teacher workload settings.',
      tone: 'info',
    });
  }

  return notices;
}

function createScopedCollections(recordsByCollection, activeTerm) {
  return {
    substitutions: (recordsByCollection.substitutions || []).filter(
      (substitution) => !activeTerm?.id || substitution.termId === activeTerm.id,
    ),
    teacherAbsences: (recordsByCollection.teacherAbsences || []).filter(
      (absence) => !activeTerm?.id || absence.termId === activeTerm.id,
    ),
  };
}

function buildDashboardModel({
  academicYears,
  plcPolicies,
  profile,
  recordsByCollection,
  schoolId,
  schoolName,
  teacherPlcAssignments,
  teacherWorkloadPolicies,
  terms,
  timeSlots,
  timeStructures,
  timetableEntries,
}) {
  const view = getDashboardView(profile?.role);
  const meta = getDashboardMeta(view);
  const activePlcPolicy = plcPolicies.find((policy) => policy.isActive) || null;
  const { activeAcademicYear, activeTerm } = getActiveTerm({
    academicYears,
    terms,
  });
  const { teacherAbsences, substitutions } = createScopedCollections(
    recordsByCollection,
    activeTerm,
  );
  const matchedTeacher =
    view === 'teacher' ? findTeacherByProfile(profile, recordsByCollection.teachers || []) : null;
  const personalEntries =
    matchedTeacher && view === 'teacher'
      ? timetableEntries.filter((entry) => entry.teacherIds.includes(matchedTeacher.id))
      : [];
  const personalPlcAssignments = teacherPlcAssignments.filter(
    (assignment) => assignment.teacherId === profile?.uid,
  );
  const personalTeacherAbsences =
    matchedTeacher && view === 'teacher'
      ? teacherAbsences.filter((absence) => absence.teacherId === matchedTeacher.id)
      : [];
  const personalSubstituteAssignments =
    matchedTeacher && view === 'teacher'
      ? substitutions.filter(
          (substitution) => substitution.substituteTeacherId === matchedTeacher.id,
        )
      : [];
  const personalWorkloadPolicy =
    teacherWorkloadPolicies.find((policy) => policy.teacherId === profile?.uid) || null;
  const personalCounts = {
    classCount: uniqueCount(personalEntries.map((entry) => entry.classId)),
    lessonCount: personalEntries.length,
    plcHours: sumDurationMinutes(personalPlcAssignments) / 60,
    schoolLessonCount: timetableEntries.length,
    subjectCount: uniqueCount(personalEntries.map((entry) => entry.subjectId)),
    substituteCoverCount: personalSubstituteAssignments.length,
  };
  const conflictSummary =
    view === 'teacher'
      ? buildTeacherConflictSummary({
          activeTerm,
          matchedTeacher,
          profile,
          teacherPlcAssignments,
          timeSlots,
          timetableEntries,
        })
      : buildSchoolConflictSummary({
          activeTerm,
          teacherPlcAssignments,
          teachers: recordsByCollection.teachers || [],
          timeSlots,
          timetableEntries,
        });
  const openCoverageCount = Math.max(
    teacherAbsences.reduce((total, absence) => total + (absence.affectedLessonCount || 0), 0) -
      substitutions.length,
    0,
  );

  return {
    ...meta,
    conflicts: buildConflictSection({
      conflictSummary,
      view,
    }),
    counts: buildCountsSection({
      activeAcademicYear,
      activeTerm,
      personalCounts,
      recordsByCollection: {
        ...recordsByCollection,
        academicYears,
        terms,
      },
      timetableEntries: view === 'teacher' ? personalEntries : timetableEntries,
      timeStructures,
      view,
    }),
    kpis: buildKpis({
      conflictSummary,
      openCoverageCount,
      personalCounts,
      recordsByCollection,
      teacherPlcAssignments,
      view,
    }),
    notices: buildNotices({
      activeTerm,
      matchedTeacher,
      profile,
      schoolId,
      teacherPlcAssignments,
      view,
    }),
    plc: buildPlcSection({
      activePlcPolicy,
      personalPlcAssignments,
      personalWorkloadPolicy,
      profile,
      teacherPlcAssignments,
      teacherWorkloadPolicies,
      view,
    }),
    schoolId,
    schoolName,
    substitutes: buildSubstituteSection({
      activeTerm,
      matchedTeacher,
      personalSubstituteAssignments,
      personalTeacherAbsences,
      substitutions,
      teacherAbsences,
      view,
    }),
    summaryPills: buildBaseSummaryPills({
      activeTerm,
      conflictSummary,
      openCoverageCount,
      profile,
      timetableEntryCount: view === 'teacher' ? personalEntries.length : timetableEntries.length,
      view,
    }),
    view,
  };
}

export function createEmptyDashboardModel({
  profile = null,
  schoolId = '',
  schoolName = '',
} = {}) {
  const view = getDashboardView(profile?.role);
  const meta = getDashboardMeta(view);

  return {
    ...meta,
    conflicts: {
      actionHref: '/app/timetable',
      actionLabel: 'Open timetable',
      description: 'Conflict summaries will appear here once dashboard data is loaded.',
      error: [],
      errorCount: 0,
      eyebrow: 'Conflicts',
      info: [],
      infoCount: 0,
      title: view === 'teacher' ? 'My conflicts' : 'Timetable conflicts',
      warning: [],
      warningCount: 0,
    },
    counts: {
      actionHref: view === 'teacher' ? '/app/timetable' : '/app/master-data',
      actionLabel: view === 'teacher' ? 'Open timetable' : 'Open master data',
      description: 'Counts will appear after dashboard aggregation finishes loading.',
      eyebrow: 'Counts',
      items: [],
      title: view === 'teacher' ? 'My counts' : 'School counts',
    },
    kpis: [],
    notices: schoolId
      ? []
      : [
          {
            message: 'Select or create a school before dashboard data can be loaded.',
            tone: 'warning',
          },
        ],
    plc: {
      actionHref: view === 'teacher' ? '/app/teacher-workload' : '/app/plc-policy',
      actionLabel: view === 'teacher' ? 'Open teacher workload' : 'Open PLC policy',
      description: 'PLC metrics will appear after dashboard aggregation finishes loading.',
      eyebrow: 'PLC summary',
      items: [],
      messages: [],
      title: view === 'teacher' ? 'My PLC summary' : 'School PLC summary',
    },
    schoolId,
    schoolName,
    substitutes: {
      actionHref: '/app/substitutions',
      actionLabel: 'Open substitutions',
      description: 'Substitute coverage metrics will appear after dashboard aggregation finishes loading.',
      eyebrow: 'Substitute summary',
      items: [],
      messages: [],
      title: view === 'teacher' ? 'My substitute summary' : 'School substitute summary',
    },
    summaryPills: [
      { label: schoolId ? `schoolId: ${schoolId}` : 'schoolId: not set', tone: 'info' },
    ],
    view,
  };
}

export async function loadDashboardData({ profile, schoolId, schoolName = '' }) {
  if (!schoolId) {
    return createEmptyDashboardModel({
      profile,
      schoolId,
      schoolName,
    });
  }

  const [
    academicYears,
    terms,
    timeStructures,
    plcPolicies,
    teacherPlcAssignments,
    teacherWorkloadPolicies,
    learningAreas,
    subjects,
    teachers,
    students,
    classes,
    classrooms,
    activities,
    teacherAbsences,
    substitutions,
  ] = await Promise.all([
    listAcademicYearsBySchool(schoolId),
    listTermsBySchool(schoolId),
    listTimeStructuresBySchool(schoolId),
    listPlcPoliciesBySchool(schoolId),
    listTeacherPlcAssignmentsBySchool(schoolId),
    listTeacherWorkloadPoliciesBySchool(schoolId),
    listMasterDataRecords({ collectionName: MASTER_DATA_COLLECTIONS[0], schoolId }),
    listMasterDataRecords({ collectionName: MASTER_DATA_COLLECTIONS[1], schoolId }),
    listMasterDataRecords({ collectionName: MASTER_DATA_COLLECTIONS[2], schoolId }),
    listMasterDataRecords({ collectionName: MASTER_DATA_COLLECTIONS[3], schoolId }),
    listMasterDataRecords({ collectionName: MASTER_DATA_COLLECTIONS[4], schoolId }),
    listMasterDataRecords({ collectionName: MASTER_DATA_COLLECTIONS[5], schoolId }),
    listMasterDataRecords({ collectionName: MASTER_DATA_COLLECTIONS[6], schoolId }),
    listTeacherAbsencesBySchool(schoolId),
    listSubstitutionsBySchool(schoolId),
  ]);

  const { activeTerm } = getActiveTerm({
    academicYears,
    terms,
  });

  const [timetableEntryGroups, timeSlotGroups] =
    activeTerm?.id && timeStructures.length > 0
      ? await Promise.all([
          Promise.all(
            timeStructures.map((timeStructure) =>
              listTimetableEntriesByContext({
                schoolId,
                termId: activeTerm.id,
                timeStructureId: timeStructure.id,
              }),
            ),
          ),
          Promise.all(
            timeStructures.map((timeStructure) =>
              listTimeSlotsByTimeStructure({
                schoolId,
                timeStructureId: timeStructure.id,
              }),
            ),
          ),
        ])
      : [[], []];

  return buildDashboardModel({
    academicYears,
    plcPolicies,
    profile,
    recordsByCollection: {
      activities,
      classes,
      classrooms,
      learningAreas,
      students,
      subjects,
      substitutions,
      teacherAbsences,
      teachers,
    },
    schoolId,
    schoolName,
    teacherPlcAssignments,
    teacherWorkloadPolicies,
    terms,
    timeSlots: timeSlotGroups.flat(),
    timeStructures,
    timetableEntries: timetableEntryGroups.flat(),
  });
}
