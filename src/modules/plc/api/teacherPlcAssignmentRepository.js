import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';

function normalizeTeacherPlcAssignment(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    teacherId: data.teacherId,
    teacherName: data.teacherName || '',
    teacherEmail: data.teacherEmail || '',
    plcPolicyId: data.plcPolicyId || '',
    teacherWorkloadPolicyId: data.teacherWorkloadPolicyId || '',
    timeStructureId: data.timeStructureId || '',
    dailyScheduleId: data.dailyScheduleId || '',
    weekdayKey: data.weekdayKey || '',
    weekdayLabel: data.weekdayLabel || '',
    weekdayOrder: Number(data.weekdayOrder) || 1,
    startTime: data.startTime || '',
    endTime: data.endTime || '',
    durationMinutes: Number(data.durationMinutes) || 0,
    blocksTeacherTime: Boolean(data.blocksTeacherTime),
    visibleInStudentTimetable: Boolean(data.visibleInStudentTimetable),
    source: data.source || 'policy',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listTeacherPlcAssignmentsBySchool(schoolId) {
  if (!schoolId) {
    return [];
  }

  const assignmentsQuery = query(
    collection(db, 'teacherPlcAssignments'),
    where('schoolId', '==', schoolId),
    orderBy('teacherId', 'asc'),
    orderBy('weekdayOrder', 'asc'),
  );
  const snapshot = await getDocs(assignmentsQuery);

  return snapshot.docs.map(normalizeTeacherPlcAssignment);
}

export async function listTeacherPlcAssignmentsByTeacher({ schoolId, teacherId }) {
  if (!schoolId || !teacherId) {
    return [];
  }

  const assignmentsQuery = query(
    collection(db, 'teacherPlcAssignments'),
    where('schoolId', '==', schoolId),
    where('teacherId', '==', teacherId),
    orderBy('weekdayOrder', 'asc'),
  );
  const snapshot = await getDocs(assignmentsQuery);

  return snapshot.docs.map(normalizeTeacherPlcAssignment);
}

export async function replaceTeacherPlcAssignments({
  assignments,
  schoolId,
  teacherId,
}) {
  const existingSnapshot = await getDocs(
    query(
      collection(db, 'teacherPlcAssignments'),
      where('schoolId', '==', schoolId),
      where('teacherId', '==', teacherId),
      orderBy('weekdayOrder', 'asc'),
    ),
  );
  const existingById = new Map(
    existingSnapshot.docs.map((snapshot) => [snapshot.id, snapshot.data()]),
  );
  const batch = writeBatch(db);
  const retainedIds = new Set();

  assignments.forEach((assignment) => {
    const assignmentRef = doc(db, 'teacherPlcAssignments', assignment.id);
    const existingData = existingById.get(assignment.id);

    retainedIds.add(assignment.id);
    batch.set(
      assignmentRef,
      {
        schoolId: assignment.schoolId,
        teacherId: assignment.teacherId,
        teacherName: assignment.teacherName,
        teacherEmail: assignment.teacherEmail,
        plcPolicyId: assignment.plcPolicyId,
        teacherWorkloadPolicyId: assignment.teacherWorkloadPolicyId || '',
        timeStructureId: assignment.timeStructureId,
        dailyScheduleId: assignment.dailyScheduleId,
        weekdayKey: assignment.weekdayKey,
        weekdayLabel: assignment.weekdayLabel,
        weekdayOrder: assignment.weekdayOrder,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        durationMinutes: assignment.durationMinutes,
        blocksTeacherTime: true,
        visibleInStudentTimetable: false,
        source: assignment.source,
        createdAt: existingData?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  existingSnapshot.docs.forEach((snapshot) => {
    if (!retainedIds.has(snapshot.id)) {
      batch.delete(doc(db, 'teacherPlcAssignments', snapshot.id));
    }
  });

  await batch.commit();

  return listTeacherPlcAssignmentsByTeacher({
    schoolId,
    teacherId,
  });
}
