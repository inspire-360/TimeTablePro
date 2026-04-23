import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { AcademicPageShell } from '../../academic/components/AcademicPageShell';
import {
  listMasterDataRecords,
  saveMasterDataRecord,
} from '../../master-data/api/masterDataRepository';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';
import { deleteClassOfferingCascade, listClassOfferingsByClass, saveClassOffering } from '../api/classOfferingRepository';
import {
  deleteCourseAssignment,
  listCourseAssignmentsByClassOffering,
  saveCourseAssignment,
} from '../api/courseAssignmentRepository';
import {
  deleteSectionCascade,
  ensureDefaultFullClassSection,
  listSectionsByClassOffering,
  saveSection,
} from '../api/sectionRepository';
import { CourseAssignmentManager } from '../components/CourseAssignmentManager';
import { HomeroomTeacherCard } from '../components/HomeroomTeacherCard';
import { OfferingManager } from '../components/OfferingManager';
import { SectionManager } from '../components/SectionManager';
import {
  buildClassOfferingId,
  buildCourseAssignmentId,
  buildSubgroupSectionPayload,
  canDeleteSection,
  createSectionDraft,
  validateSubgroupSectionForm,
} from '../helpers/sectionLogic';

function buildClassPayload(selectedClass, teacher) {
  return {
    schoolId: selectedClass.schoolId,
    code: selectedClass.code,
    name: selectedClass.name,
    gradeLevel: selectedClass.gradeLevel,
    roomLabel: selectedClass.roomLabel || '',
    homeRoomTeacherId: teacher?.id || '',
    homeRoomTeacherName: teacher?.displayName || '',
    status: selectedClass.status || 'active',
  };
}

function buildOfferingPayload({ selectedClass, subject, status }) {
  return {
    schoolId: selectedClass.schoolId,
    classId: selectedClass.id,
    className: selectedClass.name,
    classCode: selectedClass.code || '',
    gradeLevel: selectedClass.gradeLevel || '',
    subjectId: subject.id,
    subjectName: subject.name,
    subjectCode: subject.code || '',
    subjectShortName: subject.shortName || '',
    subjectType: subject.subjectType || 'core',
    learningAreaId: subject.learningAreaId || '',
    learningAreaName: subject.learningAreaName || '',
    colorToken: subject.colorToken || '',
    colorHex: subject.colorHex || '',
    status,
  };
}

function buildCourseAssignmentPayload({ selectedOffering, selectedSection, teacher }) {
  return {
    schoolId: selectedOffering.schoolId,
    classOfferingId: selectedOffering.id,
    sectionId: selectedSection.id,
    classId: selectedOffering.classId,
    className: selectedOffering.className,
    subjectId: selectedOffering.subjectId,
    subjectName: selectedOffering.subjectName,
    teacherId: teacher.id,
    teacherName: teacher.displayName || 'Teacher',
    teacherEmployeeCode: teacher.employeeCode || '',
    sectionType: selectedSection.sectionType,
    sectionName: selectedSection.name,
    sectionSortOrder: selectedSection.sortOrder,
    assignmentRole: 'subject_teacher',
    status: 'active',
  };
}

export function AssignmentPage() {
  const { currentSchool, currentSchoolId } = useCurrentSchool();
  const schoolId = currentSchoolId || currentSchool.schoolId || '';
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classOfferings, setClassOfferings] = useState([]);
  const [sections, setSections] = useState([]);
  const [courseAssignments, setCourseAssignments] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedOfferingId, setSelectedOfferingId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [status, setStatus] = useState('loading');
  const [detailStatus, setDetailStatus] = useState('idle');
  const [error, setError] = useState('');

  const selectedClass = useMemo(
    () => classes.find((classRecord) => classRecord.id === selectedClassId) || null,
    [classes, selectedClassId],
  );

  const selectedOffering = useMemo(
    () => classOfferings.find((classOffering) => classOffering.id === selectedOfferingId) || null,
    [classOfferings, selectedOfferingId],
  );

  const selectedSection = useMemo(
    () => sections.find((section) => section.id === selectedSectionId) || null,
    [sections, selectedSectionId],
  );

  const selectedSectionAssignments = useMemo(
    () =>
      courseAssignments.filter((courseAssignment) => courseAssignment.sectionId === selectedSectionId),
    [courseAssignments, selectedSectionId],
  );

  const refreshDependencies = useCallback(async () => {
    if (!schoolId) {
      setClasses([]);
      setSubjects([]);
      setTeachers([]);
      setSelectedClassId('');
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError('');

    try {
      const [nextClasses, nextSubjects, nextTeachers] = await Promise.all([
        listMasterDataRecords({ collectionName: 'classes', schoolId }),
        listMasterDataRecords({ collectionName: 'subjects', schoolId }),
        listMasterDataRecords({ collectionName: 'teachers', schoolId }),
      ]);

      setClasses(nextClasses);
      setSubjects(nextSubjects);
      setTeachers(nextTeachers);
      setSelectedClassId((current) => {
        if (current && nextClasses.some((classRecord) => classRecord.id === current)) {
          return current;
        }

        return nextClasses[0]?.id || '';
      });
      setStatus('ready');
    } catch (loadError) {
      setStatus('error');
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load teaching-assignment master data.',
      );
    }
  }, [schoolId]);

  const refreshClassOfferings = useCallback(async () => {
    if (!schoolId || !selectedClassId) {
      setClassOfferings([]);
      setSelectedOfferingId('');
      setSections([]);
      setSelectedSectionId('');
      setCourseAssignments([]);
      return;
    }

    setDetailStatus('loading');
    setError('');

    try {
      const nextClassOfferings = await listClassOfferingsByClass({
        schoolId,
        classId: selectedClassId,
      });

      setClassOfferings(nextClassOfferings);
      setSelectedOfferingId((current) => {
        if (current && nextClassOfferings.some((classOffering) => classOffering.id === current)) {
          return current;
        }

        return nextClassOfferings[0]?.id || '';
      });
      setDetailStatus('ready');
    } catch (loadError) {
      setDetailStatus('error');
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load class offerings.',
      );
    }
  }, [schoolId, selectedClassId]);

  const refreshOfferingDetails = useCallback(async () => {
    if (!schoolId || !selectedOffering) {
      setSections([]);
      setSelectedSectionId('');
      setCourseAssignments([]);
      return;
    }

    setDetailStatus('loading');
    setError('');

    try {
      const loadedSections = await listSectionsByClassOffering({
        schoolId,
        classOfferingId: selectedOffering.id,
      });
      const defaultSection = await ensureDefaultFullClassSection({
        classOffering: selectedOffering,
        sections: loadedSections,
      });
      const nextSections =
        loadedSections.some((section) => section.id === defaultSection.id)
          ? loadedSections
          : await listSectionsByClassOffering({
              schoolId,
              classOfferingId: selectedOffering.id,
            });
      const nextCourseAssignments = await listCourseAssignmentsByClassOffering({
        schoolId,
        classOfferingId: selectedOffering.id,
      });

      setSections(nextSections);
      setSelectedSectionId((current) => {
        if (current && nextSections.some((section) => section.id === current)) {
          return current;
        }

        return nextSections[0]?.id || '';
      });
      setCourseAssignments(nextCourseAssignments);
      setDetailStatus('ready');
    } catch (loadError) {
      setDetailStatus('error');
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load sections and course assignments.',
      );
    }
  }, [schoolId, selectedOffering]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshDependencies();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshDependencies]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshClassOfferings();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshClassOfferings]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshOfferingDetails();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshOfferingDetails]);

  async function handleSaveHomeroomTeacher(teacherId) {
    if (!selectedClass) {
      throw new Error('Select a class before assigning a homeroom teacher.');
    }

    const teacher = teachers.find((teacherRecord) => teacherRecord.id === teacherId) || null;

    await saveMasterDataRecord({
      collectionName: 'classes',
      id: selectedClass.id,
      payload: buildClassPayload(selectedClass, teacher),
    });
    await refreshDependencies();

    return 'Homeroom teacher saved successfully.';
  }

  async function handleCreateOffering(form) {
    if (!selectedClass) {
      throw new Error('Select a class before saving a subject offering.');
    }

    const subject = subjects.find((subjectRecord) => subjectRecord.id === form.subjectId) || null;

    if (!subject) {
      throw new Error('Select a valid subject.');
    }

    const classOfferingId = buildClassOfferingId({
      schoolId,
      classId: selectedClass.id,
      subjectId: subject.id,
    });
    const savedOffering = await saveClassOffering({
      id: classOfferingId,
      payload: buildOfferingPayload({
        selectedClass,
        status: form.status,
        subject,
      }),
    });

    await ensureDefaultFullClassSection({
      classOffering: savedOffering,
      sections: [],
    });
    await refreshClassOfferings();
    setSelectedOfferingId(savedOffering.id);

    return 'Subject offering saved successfully.';
  }

  async function handleDeleteOffering(offering) {
    await deleteClassOfferingCascade({
      classOfferingId: offering.id,
    });
    await refreshClassOfferings();

    return 'Subject offering deleted successfully.';
  }

  async function handleSaveSection(form) {
    if (!selectedOffering) {
      throw new Error('Select a subject offering before saving subgroup sections.');
    }

    const validationMessage = validateSubgroupSectionForm({
      form,
      sections,
    });

    if (validationMessage) {
      throw new Error(validationMessage);
    }

    await saveSection({
      payload: buildSubgroupSectionPayload({
        classOffering: selectedOffering,
        form,
      }),
    });
    await refreshOfferingDetails();

    return 'Subgroup section saved successfully.';
  }

  async function handleDeleteSection(section) {
    if (!canDeleteSection(section)) {
      throw new Error('The default full-class section cannot be deleted.');
    }

    await deleteSectionCascade({
      sectionId: section.id,
    });
    await refreshOfferingDetails();

    return 'Section deleted successfully.';
  }

  async function handleAddCourseAssignment(teacherId) {
    if (!selectedOffering || !selectedSection) {
      throw new Error('Select a subject offering and section first.');
    }

    const teacher = teachers.find((teacherRecord) => teacherRecord.id === teacherId) || null;

    if (!teacher) {
      throw new Error('Select a valid teacher.');
    }

    const duplicateAssignment = courseAssignments.some(
      (courseAssignment) =>
        courseAssignment.sectionId === selectedSection.id &&
        courseAssignment.teacherId === teacher.id,
    );

    if (duplicateAssignment) {
      throw new Error('This teacher is already assigned to the selected section.');
    }

    await saveCourseAssignment({
      id: buildCourseAssignmentId({
        sectionId: selectedSection.id,
        teacherId: teacher.id,
      }),
      payload: buildCourseAssignmentPayload({
        selectedOffering,
        selectedSection,
        teacher,
      }),
    });
    await refreshOfferingDetails();

    return 'Subject teacher saved successfully.';
  }

  async function handleDeleteCourseAssignment(assignment) {
    await deleteCourseAssignment(assignment.id);
    await refreshOfferingDetails();

    return 'Subject teacher removed successfully.';
  }

  if (status === 'loading') {
    return <AppLoader label="Loading teaching assignments" />;
  }

  const activeClasses = classes.filter((classRecord) => classRecord.status === 'active');
  const sectionDraft = createSectionDraft(sections);

  return (
    <AcademicPageShell
      eyebrow="มอบหมายการสอน"
      title="จัดครูและรายวิชาประจำชั้น"
      description="กำหนดครูประจำชั้น รายวิชาของแต่ละห้อง ครูผู้สอนหลายคนต่อวิชา และกลุ่มเรียนแบบเต็มห้องหรือกลุ่มย่อย"
      error={error}
      summary={
        <div className="academic-summary__grid">
          <StatusPill tone="info">Classes: {classes.length}</StatusPill>
          <StatusPill tone="info">Subjects: {subjects.length}</StatusPill>
          <StatusPill tone="info">Teachers: {teachers.length}</StatusPill>
          <StatusPill tone="neutral">Offerings: {classOfferings.length}</StatusPill>
          <StatusPill tone="neutral">Sections: {sections.length}</StatusPill>
          <StatusPill tone="neutral">Assignments: {courseAssignments.length}</StatusPill>
        </div>
      }
    >
      {detailStatus === 'loading' ? <AppLoader label="Loading assignment details" /> : null}

      {activeClasses.length === 0 ? (
        <FormMessage tone="info">
          Create at least one active class before using the teaching-assignment module.
        </FormMessage>
      ) : null}

      <div className="assignment-page-stack">
        <section className="academic-form-card">
          <div className="academic-list-card__header">
            <div>
              <p className="auth-card__eyebrow">Class selector</p>
              <h2 className="academic-list-card__title">Working Class</h2>
            </div>
            {selectedClass ? (
              <StatusPill tone="success">{selectedClass.name}</StatusPill>
            ) : (
              <StatusPill tone="neutral">No class selected</StatusPill>
            )}
          </div>

          <SelectField
            label="Class"
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
          >
            <option value="">Select class</option>
            {activeClasses.map((classRecord) => (
              <option key={classRecord.id} value={classRecord.id}>
                {[classRecord.name, classRecord.gradeLevel, classRecord.roomLabel]
                  .filter(Boolean)
                  .join(' | ')}
              </option>
            ))}
          </SelectField>
        </section>

        <div className="assignment-layout-grid">
          <div className="assignment-column">
            <HomeroomTeacherCard
              key={`${selectedClass?.id || 'none'}:${selectedClass?.homeRoomTeacherId || ''}`}
              onSave={handleSaveHomeroomTeacher}
              selectedClass={selectedClass}
              selectedTeacherId={selectedClass?.homeRoomTeacherId || ''}
              teachers={teachers}
            />

            <OfferingManager
              classOfferings={classOfferings}
              onCreateOffering={handleCreateOffering}
              onDeleteOffering={handleDeleteOffering}
              onSelectOffering={setSelectedOfferingId}
              selectedClass={selectedClass}
              selectedOfferingId={selectedOfferingId}
              subjects={subjects}
            />
          </div>

          <div className="assignment-column">
            <SectionManager
              key={`${selectedOffering?.id || 'none'}:${sections.length}:${sectionDraft.sortOrder}`}
              onDeleteSection={handleDeleteSection}
              onSaveSection={handleSaveSection}
              onSelectSection={setSelectedSectionId}
              sections={sections}
              selectedOffering={selectedOffering}
              selectedSectionId={selectedSectionId}
            />
          </div>

          <div className="assignment-column">
            <CourseAssignmentManager
              assignments={selectedSectionAssignments}
              onAddAssignment={handleAddCourseAssignment}
              onDeleteAssignment={handleDeleteCourseAssignment}
              selectedOffering={selectedOffering}
              selectedSection={selectedSection}
              teachers={teachers}
            />
          </div>
        </div>
      </div>
    </AcademicPageShell>
  );
}
