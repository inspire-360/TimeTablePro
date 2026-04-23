import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../core/firebase/client';

function normalizeTeacher(snapshot) {
  const data = snapshot.data();

  return {
    uid: snapshot.id,
    schoolId: data.schoolId,
    role: data.role || 'teacher',
    displayName: data.displayName || data.email || 'Teacher',
    email: data.email || '',
    status: data.status || 'active',
  };
}

export async function listTeacherUsersBySchool(schoolId) {
  if (!schoolId) {
    return [];
  }

  const teacherQuery = query(
    collection(db, 'users'),
    where('schoolId', '==', schoolId),
    where('role', '==', 'teacher'),
  );
  const snapshot = await getDocs(teacherQuery);

  return snapshot.docs
    .map(normalizeTeacher)
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}
