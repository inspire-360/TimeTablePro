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

function normalizeCourseAssignment(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    classOfferingId: data.classOfferingId,
    sectionId: data.sectionId,
    classId: data.classId || '',
    className: data.className || '',
    subjectId: data.subjectId || '',
    subjectName: data.subjectName || '',
    teacherId: data.teacherId,
    teacherName: data.teacherName || '',
    teacherEmployeeCode: data.teacherEmployeeCode || '',
    sectionType: data.sectionType || 'full_class',
    sectionName: data.sectionName || '',
    sectionSortOrder: Number(data.sectionSortOrder) || 1,
    assignmentRole: data.assignmentRole || 'subject_teacher',
    status: data.status || 'active',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listCourseAssignmentsByClassOffering({ classOfferingId, schoolId }) {
  if (!schoolId || !classOfferingId) {
    return [];
  }

  const assignmentsQuery = query(
    collection(db, 'courseAssignments'),
    where('schoolId', '==', schoolId),
    where('classOfferingId', '==', classOfferingId),
    orderBy('sectionSortOrder', 'asc'),
    orderBy('teacherName', 'asc'),
  );
  const snapshot = await getDocs(assignmentsQuery);

  return snapshot.docs.map(normalizeCourseAssignment);
}

export async function saveCourseAssignment({ id, payload }) {
  const courseAssignmentRef = doc(db, 'courseAssignments', id);
  const existingSnapshot = await getDoc(courseAssignmentRef);

  await setDoc(
    courseAssignmentRef,
    {
      ...payload,
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const savedSnapshot = await getDoc(courseAssignmentRef);
  return normalizeCourseAssignment(savedSnapshot);
}

export async function deleteCourseAssignment(courseAssignmentId) {
  await deleteDoc(doc(db, 'courseAssignments', courseAssignmentId));
}
