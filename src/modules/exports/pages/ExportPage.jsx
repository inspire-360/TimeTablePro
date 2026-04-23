import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppLoader } from '../../../shared/ui/AppLoader';
import { FormMessage } from '../../../shared/ui/FormMessage';
import { SelectField } from '../../../shared/ui/SelectField';
import { StatusPill } from '../../../shared/ui/StatusPill';
import { AcademicPageShell } from '../../academic/components/AcademicPageShell';
import { useAuth } from '../../auth/context/useAuth';
import { getActiveTerm } from '../../academic/helpers/getActiveTerm';
import { useCurrentSchool } from '../../schools/context/useCurrentSchool';
import { TimetableExportPreview } from '../components/TimetableExportPreview';
import {
  buildOwnerOptionLabel,
  EXPORT_DOCUMENT_TYPE_OPTIONS,
  exportTimetableDocument,
  findMatchingTeacherRecord,
  getRecommendedExportType,
  loadTimetableExportDependencies,
  loadTimetableExportDocument,
} from '../services/timetableExportService';

function sortByLabel(records = [], labelBuilder) {
  return [...records].sort((left, right) =>
    labelBuilder(left).localeCompare(labelBuilder(right), undefined, { numeric: true }),
  );
}

function buildClassLabel(record) {
  return [record.name || 'Class', record.gradeLevel || '', record.roomLabel || '']
    .filter(Boolean)
    .join(' | ');
}

function buildTeacherLabel(record) {
  return [record.displayName || 'Teacher', record.employeeCode || '']
    .filter(Boolean)
    .join(' | ');
}

const emptyDependencies = {
  academicYears: [],
  classes: [],
  teachers: [],
  terms: [],
  timeStructures: [],
};

export function ExportPage() {
  const previewRef = useRef(null);
  const { profile } = useAuth();
  const { currentSchool, currentSchoolId, currentSchoolSettings } = useCurrentSchool();
  const schoolId = currentSchoolId || currentSchool.schoolId || '';
  const [dependencies, setDependencies] = useState(emptyDependencies);
  const [filters, setFilters] = useState({
    documentType: getRecommendedExportType(profile?.role),
    ownerId: '',
    termId: '',
    timeStructureId: '',
  });
  const [documentData, setDocumentData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [documentStatus, setDocumentStatus] = useState('idle');
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState({ tone: '', message: '' });
  const [error, setError] = useState('');

  const activeClasses = useMemo(
    () => sortByLabel(dependencies.classes, buildClassLabel),
    [dependencies.classes],
  );
  const activeTeachers = useMemo(
    () => sortByLabel(dependencies.teachers, buildTeacherLabel),
    [dependencies.teachers],
  );
  const matchedTeacher = useMemo(
    () => findMatchingTeacherRecord(profile, activeTeachers),
    [activeTeachers, profile],
  );
  const { activeTerm } = useMemo(
    () =>
      getActiveTerm({
        academicYears: dependencies.academicYears,
        terms: dependencies.terms,
      }),
    [dependencies.academicYears, dependencies.terms],
  );
  const effectiveFilters = useMemo(() => {
    const nextDocumentType = filters.documentType || getRecommendedExportType(profile?.role);
    const nextOwnerOptions =
      nextDocumentType === 'teacher' ? activeTeachers : activeClasses;
    const preferredOwnerId =
      nextDocumentType === 'teacher' && matchedTeacher
        ? matchedTeacher.id
        : nextOwnerOptions[0]?.id || '';
    const nextOwnerId = nextOwnerOptions.some((record) => record.id === filters.ownerId)
      ? filters.ownerId
      : preferredOwnerId;
    const nextTermId = dependencies.terms.some((term) => term.id === filters.termId)
      ? filters.termId
      : activeTerm?.id || dependencies.terms[0]?.id || '';
    const nextTimeStructureId = dependencies.timeStructures.some(
      (timeStructure) => timeStructure.id === filters.timeStructureId,
    )
      ? filters.timeStructureId
      : dependencies.timeStructures[0]?.id || '';

    return {
      documentType: nextDocumentType,
      ownerId: nextOwnerId,
      termId: nextTermId,
      timeStructureId: nextTimeStructureId,
    };
  }, [
    activeClasses,
    activeTeachers,
    activeTerm?.id,
    dependencies.terms,
    dependencies.timeStructures,
    filters.documentType,
    filters.ownerId,
    filters.termId,
    filters.timeStructureId,
    matchedTeacher,
    profile?.role,
  ]);
  const ownerOptions =
    effectiveFilters.documentType === 'teacher' ? activeTeachers : activeClasses;

  const refreshDependencies = useCallback(async () => {
    if (!schoolId) {
      setDependencies(emptyDependencies);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError('');

    try {
      const nextDependencies = await loadTimetableExportDependencies({ schoolId });

      setDependencies(nextDependencies);
      setStatus('ready');
    } catch (loadError) {
      setStatus('error');
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load export filters.',
      );
    }
  }, [schoolId]);

  const refreshDocument = useCallback(async () => {
    if (
      !schoolId ||
      !effectiveFilters.ownerId ||
      !effectiveFilters.termId ||
      !effectiveFilters.timeStructureId
    ) {
      setDocumentData(null);
      setDocumentStatus('idle');
      return;
    }

    setDocumentStatus('loading');
    setError('');

    try {
      const nextDocument = await loadTimetableExportDocument({
        academicYears: dependencies.academicYears,
        classes: activeClasses,
        currentSchoolSettings,
        documentType: effectiveFilters.documentType,
        ownerId: effectiveFilters.ownerId,
        school: currentSchool,
        schoolId,
        teachers: activeTeachers,
        termId: effectiveFilters.termId,
        terms: dependencies.terms,
        timeStructureId: effectiveFilters.timeStructureId,
        timeStructures: dependencies.timeStructures,
      });

      setDocumentData(nextDocument);
      setDocumentStatus('ready');
    } catch (loadError) {
      setDocumentData(null);
      setDocumentStatus('error');
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load the export preview.',
      );
    }
  }, [
    activeClasses,
    activeTeachers,
    currentSchool,
    currentSchoolSettings,
    dependencies.academicYears,
    dependencies.terms,
    dependencies.timeStructures,
    effectiveFilters.documentType,
    effectiveFilters.ownerId,
    effectiveFilters.termId,
    effectiveFilters.timeStructureId,
    schoolId,
  ]);

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
      void refreshDocument();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [refreshDocument]);

  async function handleExport(format) {
    if (!documentData) {
      return;
    }

    try {
      setIsExporting(true);
      setFeedback({ tone: '', message: '' });
      await exportTimetableDocument({
        documentData,
        format,
        previewElement: previewRef.current,
      });
      setFeedback({
        tone: 'success',
        message: `${format.toUpperCase()} export created successfully.`,
      });
    } catch (exportError) {
      setFeedback({
        tone: 'error',
        message:
          exportError instanceof Error
            ? exportError.message
            : 'Unable to export the timetable document.',
      });
    } finally {
      setIsExporting(false);
    }
  }

  if (status === 'loading') {
    return <AppLoader label="Loading export workspace" />;
  }

  return (
    <AcademicPageShell
      eyebrow="Export"
      title="Timetable Export Center"
      description="Export class and teacher timetables as PDF or CSV with school branding, active academic context, and signature blocks."
      error={error}
      summary={
        <div className="academic-summary__grid">
          <StatusPill tone="info">
            School: {currentSchool.name || currentSchool.schoolId || 'Not set'}
          </StatusPill>
          <StatusPill tone={documentData ? 'success' : 'warning'}>
            Preview: {documentData ? 'Ready' : 'Not ready'}
          </StatusPill>
          <StatusPill tone="neutral">
            Signatures: {currentSchoolSettings.signatures.length}
          </StatusPill>
          <StatusPill tone={currentSchool.logoUrl ? 'success' : 'warning'}>
            Logo: {currentSchool.logoUrl ? 'Included' : 'Not set'}
          </StatusPill>
        </div>
      }
    >
      {documentStatus === 'loading' ? <AppLoader label="Preparing export preview" /> : null}

      <div className="export-layout-grid">
        <div className="export-sidebar">
          <section className="academic-form-card">
            <div className="academic-list-card__header">
              <div>
                <p className="auth-card__eyebrow">Export filters</p>
                <h2 className="academic-list-card__title">Document Settings</h2>
              </div>
              <StatusPill tone="info">{filters.documentType}</StatusPill>
            </div>

            {feedback.message ? (
              <FormMessage tone={feedback.tone}>{feedback.message}</FormMessage>
            ) : null}

            {profile?.role === 'teacher' && !matchedTeacher ? (
              <FormMessage tone="warning">
                Your auth profile does not match a teacher master-data record yet. Teacher exports
                still work if you manually select the correct teacher.
              </FormMessage>
            ) : null}

            {dependencies.terms.length === 0 ? (
              <FormMessage tone="info">
                Configure an academic term before exporting a timetable.
              </FormMessage>
            ) : null}

            {dependencies.timeStructures.length === 0 ? (
              <FormMessage tone="info">
                Configure a time structure before exporting a timetable.
              </FormMessage>
            ) : null}

            <div className="academic-form">
              <SelectField
                label="Document type"
                value={effectiveFilters.documentType}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    documentType: event.target.value,
                    ownerId: '',
                  }))
                }
              >
                {EXPORT_DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label={effectiveFilters.documentType === 'teacher' ? 'Teacher' : 'Class'}
                value={effectiveFilters.ownerId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    ownerId: event.target.value,
                  }))
                }
              >
                <option value="">
                  {effectiveFilters.documentType === 'teacher'
                    ? 'Select teacher'
                    : 'Select class'}
                </option>
                {ownerOptions.map((record) => (
                  <option key={record.id} value={record.id}>
                    {buildOwnerOptionLabel(record, effectiveFilters.documentType)}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Term"
                value={effectiveFilters.termId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    termId: event.target.value,
                  }))
                }
              >
                <option value="">Select term</option>
                {dependencies.terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Time structure"
                value={effectiveFilters.timeStructureId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    timeStructureId: event.target.value,
                  }))
                }
              >
                <option value="">Select time structure</option>
                {dependencies.timeStructures.map((timeStructure) => (
                  <option key={timeStructure.id} value={timeStructure.id}>
                    {timeStructure.name}
                  </option>
                ))}
              </SelectField>

              <div className="export-helper-card">
                <span className="form-field__label">Included in PDF</span>
                <div className="academic-summary__grid">
                  <StatusPill tone={currentSchool.logoUrl ? 'success' : 'warning'}>
                    School logo
                  </StatusPill>
                  <StatusPill
                    tone={currentSchoolSettings.signatures.length > 0 ? 'success' : 'warning'}
                  >
                    Signature block
                  </StatusPill>
                </div>
              </div>

              <div className="export-action-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    void handleExport('pdf');
                  }}
                  disabled={!documentData || isExporting}
                >
                  {isExporting ? 'Exporting...' : 'Export PDF'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    void handleExport('csv');
                  }}
                  disabled={!documentData || isExporting}
                >
                  Export CSV
                </button>
              </div>
            </div>
          </section>

          <section className="academic-list-card">
            <div className="academic-list-card__header">
              <div>
                <p className="auth-card__eyebrow">Export summary</p>
                <h2 className="academic-list-card__title">Document Overview</h2>
              </div>
            </div>

            {!documentData ? (
              <p className="academic-empty-state">
                Select a valid document type, owner, term, and time structure to load the preview.
              </p>
            ) : (
              <div className="academic-record-list">
                <article className="academic-record-card">
                  <div className="academic-record-card__header">
                    <div>
                      <h3>{documentData.documentLabel}</h3>
                      <p>{documentData.owner.label}</p>
                      <p>
                        {documentData.academicYear?.label || 'Academic year not set'} |{' '}
                        {documentData.term.name}
                      </p>
                    </div>
                    <div className="academic-record-card__actions">
                      <StatusPill tone="success">Entries: {documentData.entries.length}</StatusPill>
                      <StatusPill tone="neutral">
                        Weekdays: {documentData.weekdays.length}
                      </StatusPill>
                    </div>
                  </div>
                </article>
              </div>
            )}
          </section>
        </div>

        <div className="export-preview-column">
          <section className="academic-list-card">
            <div className="academic-list-card__header">
              <div>
                <p className="auth-card__eyebrow">PDF preview</p>
                <h2 className="academic-list-card__title">Rendered Document</h2>
              </div>
              {documentData ? (
                <StatusPill tone="success">{documentData.timeStructure.name}</StatusPill>
              ) : (
                <StatusPill tone="neutral">Preview unavailable</StatusPill>
              )}
            </div>

            {!documentData ? (
              <p className="academic-empty-state">
                The preview will appear here once the export filters are fully configured.
              </p>
            ) : (
              <TimetableExportPreview documentData={documentData} previewRef={previewRef} />
            )}
          </section>
        </div>
      </div>
    </AcademicPageShell>
  );
}
