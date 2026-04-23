import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';

function normalizeSubstitution(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    teacherAbsenceId: data.teacherAbsenceId || '',
    timetableEntryId: data.timetableEntryId || '',
    date: data.date || '',
    weekdayKey: data.weekdayKey || '',
    weekdayLabel: data.weekdayLabel || '',
    weekdayOrder: Number(data.weekdayOrder) || 1,
    academicYearId: data.academicYearId || '',
    academicYearLabel: data.academicYearLabel || '',
    termId: data.termId || '',
    termName: data.termName || '',
    timeStructureId: data.timeStructureId || '',
    timeStructureName: data.timeStructureName || '',
    dailyScheduleId: data.dailyScheduleId || '',
    timeSlotId: data.timeSlotId || '',
    absentTeacherId: data.absentTeacherId || '',
    absentTeacherName: data.absentTeacherName || '',
    substituteTeacherId: data.substituteTeacherId || '',
    substituteTeacherName: data.substituteTeacherName || '',
    substituteTeacherEmployeeCode: data.substituteTeacherEmployeeCode || '',
    classId: data.classId || '',
    className: data.className || '',
    subjectId: data.subjectId || '',
    subjectName: data.subjectName || '',
    sectionId: data.sectionId || '',
    sectionName: data.sectionName || '',
    classroomId: data.classroomId || '',
    classroomName: data.classroomName || '',
    startTime: data.startTime || '',
    endTime: data.endTime || '',
    status: data.status || 'assigned',
    notes: data.notes || '',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listSubstitutionsBySchool(schoolId) {
  if (!schoolId) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'substitutions'),
      where('schoolId', '==', schoolId),
      orderBy('date', 'desc'),
    ),
  );

  return snapshot.docs.map(normalizeSubstitution);
}

export async function listSubstitutionsByTeacherAbsence({ schoolId, teacherAbsenceId }) {
  if (!schoolId || !teacherAbsenceId) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'substitutions'),
      where('schoolId', '==', schoolId),
      where('teacherAbsenceId', '==', teacherAbsenceId),
      orderBy('startTime', 'asc'),
    ),
  );

  return snapshot.docs.map(normalizeSubstitution);
}

export async function saveSubstitution({ id, payload }) {
  const substitutionRef = doc(db, 'substitutions', id);
  const existingSnapshot = await getDoc(substitutionRef);

  await setDoc(
    substitutionRef,
    {
      ...payload,
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const savedSnapshot = await getDoc(substitutionRef);
  return normalizeSubstitution(savedSnapshot);
}

export async function deleteSubstitution(substitutionId) {
  await deleteDoc(doc(db, 'substitutions', substitutionId));
}
