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

function normalizeTimeSlot(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    schoolId: data.schoolId,
    timeStructureId: data.timeStructureId,
    dailyScheduleId: data.dailyScheduleId,
    weekdayKey: data.weekdayKey,
    weekdayOrder: Number(data.weekdayOrder) || 1,
    slotIndex: Number(data.slotIndex) || 1,
    startTime: data.startTime || '',
    endTime: data.endTime || '',
    slotType: data.slotType || 'teaching',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

export async function listTimeSlotsByDailySchedule({ dailyScheduleId, schoolId }) {
  if (!schoolId || !dailyScheduleId) {
    return [];
  }

  const timeSlotsQuery = query(
    collection(db, 'timeSlots'),
    where('schoolId', '==', schoolId),
    where('dailyScheduleId', '==', dailyScheduleId),
    orderBy('slotIndex', 'asc'),
  );
  const snapshot = await getDocs(timeSlotsQuery);

  return snapshot.docs.map(normalizeTimeSlot);
}

export async function listTimeSlotsByTimeStructure({ schoolId, timeStructureId }) {
  if (!schoolId || !timeStructureId) {
    return [];
  }

  const timeSlotsQuery = query(
    collection(db, 'timeSlots'),
    where('schoolId', '==', schoolId),
    where('timeStructureId', '==', timeStructureId),
    orderBy('weekdayOrder', 'asc'),
    orderBy('slotIndex', 'asc'),
  );
  const snapshot = await getDocs(timeSlotsQuery);

  return snapshot.docs.map(normalizeTimeSlot);
}

export async function replaceTimeSlotsForDailySchedule({
  dailySchedule,
  schoolId,
  slots,
  timeStructureId,
  weekday,
}) {
  const existingSnapshot = await getDocs(
    query(
      collection(db, 'timeSlots'),
      where('schoolId', '==', schoolId),
      where('dailyScheduleId', '==', dailySchedule.id),
      orderBy('slotIndex', 'asc'),
    ),
  );
  const existingById = new Map(
    existingSnapshot.docs.map((snapshot) => [snapshot.id, snapshot.data()]),
  );
  const batch = writeBatch(db);
  const retainedIds = new Set();

  slots.forEach((slot, index) => {
    const timeSlotRef =
      slot.id && existingById.has(slot.id)
        ? doc(db, 'timeSlots', slot.id)
        : doc(collection(db, 'timeSlots'));
    const existingData = existingById.get(timeSlotRef.id);

    retainedIds.add(timeSlotRef.id);
    batch.set(
      timeSlotRef,
      {
        schoolId,
        timeStructureId,
        dailyScheduleId: dailySchedule.id,
        weekdayKey: weekday.key,
        weekdayOrder: weekday.order,
        slotIndex: index + 1,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotType: slot.slotType,
        createdAt: existingData?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });

  existingSnapshot.docs.forEach((snapshot) => {
    if (!retainedIds.has(snapshot.id)) {
      batch.delete(doc(db, 'timeSlots', snapshot.id));
    }
  });

  await batch.commit();

  return listTimeSlotsByDailySchedule({
    schoolId,
    dailyScheduleId: dailySchedule.id,
  });
}
