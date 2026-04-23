import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../core/firebase/client';
import { normalizePlcDayKeys } from '../helpers/plcValidation';

function normalizePlcPolicy(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    name: data.name || '',
    timeStructureId: data.timeStructureId || '',
    timeStructureName: data.timeStructureName || '',
    plcDays: normalizePlcDayKeys(data.plcDays || []),
    hoursPerWeek: Number(data.hoursPerWeek) || 0,
    isActive: Boolean(data.isActive),
    applyAfterLastTeaching: Boolean(data.applyAfterLastTeaching),
    blocksTeacherTime: Boolean(data.blocksTeacherTime),
    visibleInStudentTimetable: Boolean(data.visibleInStudentTimetable),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listPlcPoliciesBySchool(schoolId) {
  if (!schoolId) {
    return [];
  }

  const plcPoliciesQuery = query(
    collection(db, 'plcPolicies'),
    where('schoolId', '==', schoolId),
    orderBy('updatedAt', 'desc'),
  );
  const snapshot = await getDocs(plcPoliciesQuery);

  return snapshot.docs.map(normalizePlcPolicy);
}

async function deactivatePlcPoliciesInSchool(batch, schoolId, exceptId = '') {
  const plcPolicies = await listPlcPoliciesBySchool(schoolId);

  plcPolicies.forEach((plcPolicy) => {
    if (plcPolicy.id === exceptId || !plcPolicy.isActive) {
      return;
    }

    batch.update(doc(db, 'plcPolicies', plcPolicy.id), {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function savePlcPolicy({
  hoursPerWeek,
  id,
  isActive,
  name,
  plcDays,
  schoolId,
  timeStructureId,
  timeStructureName,
}) {
  const plcPolicyRef = id ? doc(db, 'plcPolicies', id) : doc(collection(db, 'plcPolicies'));
  const existingSnapshot = await getDoc(plcPolicyRef);
  const batch = writeBatch(db);

  if (isActive) {
    await deactivatePlcPoliciesInSchool(batch, schoolId, plcPolicyRef.id);
  }

  batch.set(
    plcPolicyRef,
    {
      schoolId,
      name: name.trim(),
      timeStructureId,
      timeStructureName: timeStructureName?.trim() || '',
      plcDays: normalizePlcDayKeys(plcDays),
      hoursPerWeek: Number(hoursPerWeek),
      isActive: Boolean(isActive),
      applyAfterLastTeaching: true,
      blocksTeacherTime: true,
      visibleInStudentTimetable: false,
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await batch.commit();

  const savedSnapshot = await getDoc(plcPolicyRef);
  return normalizePlcPolicy(savedSnapshot);
}

export async function activatePlcPolicy(plcPolicyId, schoolId) {
  const plcPolicyRef = doc(db, 'plcPolicies', plcPolicyId);
  const snapshot = await getDoc(plcPolicyRef);

  if (!snapshot.exists()) {
    throw new Error('PLC policy not found.');
  }

  const plcPolicy = normalizePlcPolicy(snapshot);

  return savePlcPolicy({
    ...plcPolicy,
    schoolId,
    isActive: true,
  });
}
