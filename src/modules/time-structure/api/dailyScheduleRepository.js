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

function normalizeDailySchedule(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    timeStructureId: data.timeStructureId,
    weekdayKey: data.weekdayKey,
    weekdayLabel: data.weekdayLabel || '',
    weekdayOrder: Number(data.weekdayOrder) || 1,
    slotCount: Number(data.slotCount) || 0,
    teachingSlotCount: Number(data.teachingSlotCount) || 0,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listDailySchedulesByTimeStructure({ schoolId, timeStructureId }) {
  if (!schoolId || !timeStructureId) {
    return [];
  }

  const dailySchedulesQuery = query(
    collection(db, 'dailySchedules'),
    where('schoolId', '==', schoolId),
    where('timeStructureId', '==', timeStructureId),
    orderBy('weekdayOrder', 'asc'),
  );
  const snapshot = await getDocs(dailySchedulesQuery);

  return snapshot.docs.map(normalizeDailySchedule);
}

export async function saveDailySchedule({
  id,
  schoolId,
  slotCount,
  teachingSlotCount,
  timeStructureId,
  weekdayKey,
  weekdayLabel,
  weekdayOrder,
}) {
  const dailyScheduleId = id || `${timeStructureId}-${weekdayKey}`;
  const dailyScheduleRef = doc(db, 'dailySchedules', dailyScheduleId);
  const existingSnapshot = await getDoc(dailyScheduleRef);

  await setDoc(
    dailyScheduleRef,
    {
      schoolId,
      timeStructureId,
      weekdayKey,
      weekdayLabel,
      weekdayOrder,
      slotCount,
      teachingSlotCount,
      createdAt: existingSnapshot.exists()
        ? existingSnapshot.data().createdAt || serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  const savedSnapshot = await getDoc(dailyScheduleRef);
  return normalizeDailySchedule(savedSnapshot);
}
