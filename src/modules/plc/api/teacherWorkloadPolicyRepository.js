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
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';
import { normalizePlcDayKeys } from '../helpers/plcValidation';

function buildTeacherWorkloadPolicyId({ schoolId, teacherId }) {
  return `${schoolId}-${teacherId}`;
}

function normalizeTeacherWorkloadPolicy(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    teacherId: data.teacherId,
    teacherName: data.teacherName || '',
    teacherEmail: data.teacherEmail || '',
    plcEnabled: Boolean(data.plcEnabled),
    plcHoursPerWeekOverride:
      data.plcHoursPerWeekOverride === null || data.plcHoursPerWeekOverride === undefined
        ? null
        : Number(data.plcHoursPerWeekOverride),
    plcDayOverrides: normalizePlcDayKeys(data.plcDayOverrides || []),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listTeacherWorkloadPoliciesBySchool(schoolId) {
  if (!schoolId) {
    return [];
  }

  const workloadPoliciesQuery = query(
    collection(db, 'teacherWorkloadPolicies'),
    where('schoolId', '==', schoolId),
    orderBy('teacherName', 'asc'),
  );
  const snapshot = await getDocs(workloadPoliciesQuery);

  return snapshot.docs.map(normalizeTeacherWorkloadPolicy);
}

export async function saveTeacherWorkloadPolicy({
  plcDayOverrides,
  plcEnabled,
  plcHoursPerWeekOverride,
  schoolId,
  teacherEmail,
  teacherId,
  teacherName,
}) {
  const teacherWorkloadPolicyRef = doc(
    db,
    'teacherWorkloadPolicies',
    buildTeacherWorkloadPolicyId({ schoolId, teacherId }),
  );
  const existingSnapshot = await getDoc(teacherWorkloadPolicyRef);

  await setDoc(
    teacherWorkloadPolicyRef,
    {
      schoolId,
      teacherId,
      teacherName: teacherName.trim(),
      teacherEmail: teacherEmail?.trim() || '',
      plcEnabled: Boolean(plcEnabled),
      plcHoursPerWeekOverride:
        plcHoursPerWeekOverride === '' || plcHoursPerWeekOverride === null
          ? null
          : Number(plcHoursPerWeekOverride),
      plcDayOverrides: normalizePlcDayKeys(plcDayOverrides),
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const savedSnapshot = await getDoc(teacherWorkloadPolicyRef);
  return normalizeTeacherWorkloadPolicy(savedSnapshot);
}
