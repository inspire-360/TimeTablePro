import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';

function normalizeTeacherAbsence(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    teacherId: data.teacherId || '',
    teacherName: data.teacherName || '',
    teacherEmployeeCode: data.teacherEmployeeCode || '',
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
    reason: data.reason || '',
    notes: data.notes || '',
    status: data.status || 'reported',
    affectedLessonCount: Number(data.affectedLessonCount) || 0,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listTeacherAbsencesBySchool(schoolId) {
  if (!schoolId) {
    return [];
  }

  const snapshot = await getDocs(
    query(
      collection(db, 'teacherAbsences'),
      where('schoolId', '==', schoolId),
      orderBy('date', 'desc'),
    ),
  );

  return snapshot.docs.map(normalizeTeacherAbsence);
}

export async function saveTeacherAbsence({ id, payload }) {
  const teacherAbsenceRef = doc(db, 'teacherAbsences', id);
  const existingSnapshot = await getDoc(teacherAbsenceRef);

  await setDoc(
    teacherAbsenceRef,
    {
      ...payload,
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const savedSnapshot = await getDoc(teacherAbsenceRef);
  return normalizeTeacherAbsence(savedSnapshot);
}

export async function deleteTeacherAbsenceCascade({ schoolId, teacherAbsenceId }) {
  const substitutionsSnapshot = await getDocs(
    query(
      collection(db, 'substitutions'),
      where('schoolId', '==', schoolId),
      where('teacherAbsenceId', '==', teacherAbsenceId),
    ),
  );
  const batch = writeBatch(db);

  substitutionsSnapshot.docs.forEach((snapshot) => {
    batch.delete(doc(db, 'substitutions', snapshot.id));
  });
  batch.delete(doc(db, 'teacherAbsences', teacherAbsenceId));

  await batch.commit();
}
