import { listDailySchedulesByTimeStructure } from '../../time-structure/api/dailyScheduleRepository';
import { listTimeSlotsByDailySchedule } from '../../time-structure/api/timeSlotRepository';
import { replaceTeacherPlcAssignments } from '../api/teacherPlcAssignmentRepository';
import { autoCreatePlcSlots } from '../helpers/autoCreatePlcSlots';

async function loadTimeStructureContext({ schoolId, timeStructureId }) {
  const dailySchedules = await listDailySchedulesByTimeStructure({
    schoolId,
    timeStructureId,
  });
  const slotLists = await Promise.all(
    dailySchedules.map((dailySchedule) =>
      listTimeSlotsByDailySchedule({
        schoolId,
        dailyScheduleId: dailySchedule.id,
      }),
    ),
  );

  return {
    dailySchedules,
    timeSlots: slotLists.flat(),
  };
}

function buildTeacherIdentity(teacher) {
  return {
    teacherId: teacher?.uid || teacher?.teacherId || '',
    teacherName: teacher?.displayName || teacher?.teacherName || 'Teacher',
  };
}

export async function syncTeacherPlcAssignments({
  plcPolicy,
  schoolId,
  teacher,
  teacherWorkloadPolicy = null,
}) {
  if (!plcPolicy?.id) {
    throw new Error('An active PLC policy is required.');
  }

  const context = await loadTimeStructureContext({
    schoolId,
    timeStructureId: plcPolicy.timeStructureId,
  });
  const teacherIdentity = buildTeacherIdentity(teacher);

  try {
    const assignments = autoCreatePlcSlots({
      ...context,
      plcPolicy,
      teacher,
      teacherWorkloadPolicy,
    });
    const savedAssignments = await replaceTeacherPlcAssignments({
      assignments,
      schoolId,
      teacherId: teacherIdentity.teacherId,
    });

    return {
      assignments: savedAssignments,
      warnings: [],
    };
  } catch (error) {
    await replaceTeacherPlcAssignments({
      assignments: [],
      schoolId,
      teacherId: teacherIdentity.teacherId,
    });

    return {
      assignments: [],
      warnings: [
        `${teacherIdentity.teacherName}: ${
          error instanceof Error ? error.message : 'Unable to generate PLC blocks.'
        }`,
      ],
    };
  }
}

export async function syncPlcAssignmentsForTeachers({
  plcPolicy,
  schoolId,
  teacherWorkloadPolicies = [],
  teachers = [],
}) {
  if (!plcPolicy?.id) {
    throw new Error('An active PLC policy is required.');
  }

  const context = await loadTimeStructureContext({
    schoolId,
    timeStructureId: plcPolicy.timeStructureId,
  });
  const workloadPolicyByTeacherId = new Map(
    teacherWorkloadPolicies.map((teacherWorkloadPolicy) => [
      teacherWorkloadPolicy.teacherId,
      teacherWorkloadPolicy,
    ]),
  );
  const warnings = [];
  let totalAssignments = 0;

  for (const teacher of teachers) {
    const teacherId = teacher.uid || teacher.teacherId || '';
    const teacherName = teacher.displayName || teacher.teacherName || 'Teacher';

    try {
      const assignments = autoCreatePlcSlots({
        ...context,
        plcPolicy,
        teacher,
        teacherWorkloadPolicy: workloadPolicyByTeacherId.get(teacherId) || null,
      });
      const savedAssignments = await replaceTeacherPlcAssignments({
        assignments,
        schoolId,
        teacherId,
      });

      totalAssignments += savedAssignments.length;
    } catch (error) {
      await replaceTeacherPlcAssignments({
        assignments: [],
        schoolId,
        teacherId,
      });
      warnings.push(
        `${teacherName}: ${
          error instanceof Error ? error.message : 'Unable to generate PLC blocks.'
        }`,
      );
    }
  }

  return {
    totalAssignments,
    warnings,
  };
}
