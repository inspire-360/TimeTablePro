import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/context/useAuth';
import { applySchoolTheme } from '../../theme/helpers/applySchoolTheme';
import {
  createDraftSchoolSettings,
  subscribeSchoolSettingsById,
  upsertSchoolSettings,
} from '../api/schoolSettingsRepository';
import {
  createDraftSchool,
  getSchoolById,
  listSchools,
  subscribeSchoolById,
  subscribeSchools,
  upsertSchool,
} from '../api/schoolRepository';
import { CurrentSchoolContext } from './currentSchoolContext';

const CURRENT_SCHOOL_STORAGE_KEY = 'timetable-pro.currentSchoolId';

const initialState = {
  status: 'loading',
  schools: [],
  currentSchoolId: '',
  currentSchool: createDraftSchool(''),
  currentSchoolSettings: createDraftSchoolSettings(''),
  error: '',
  isSaving: false,
};

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

function getStoredSchoolId() {
  return window.localStorage.getItem(CURRENT_SCHOOL_STORAGE_KEY) || '';
}

function persistSchoolId(schoolId) {
  window.localStorage.setItem(CURRENT_SCHOOL_STORAGE_KEY, schoolId);
}

function mergeSchoolIntoCollection(schools, school) {
  if (!school?.schoolId) {
    return schools;
  }

  const nextSchools = schools.filter((record) => record.schoolId !== school.schoolId);
  return [...nextSchools, school].sort((left, right) =>
    String(left.name || left.schoolId).localeCompare(String(right.name || right.schoolId)),
  );
}

export function CurrentSchoolProvider({ children }) {
  const { isAuthenticated, isLoading: isAuthLoading, profile } = useAuth();
  const [state, setState] = useState(initialState);

  const loadAccessibleSchools = useCallback(async () => {
    if (profile?.role === 'super_admin') {
      return listSchools();
    }

    if (!profile?.schoolId) {
      return [];
    }

    const school = await getSchoolById(profile.schoolId);
    return school ? [school] : [];
  }, [profile?.role, profile?.schoolId]);

  const bootstrapSchools = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      setState(initialState);
      return;
    }

    setState((current) => ({
      ...current,
      status: 'loading',
      error: '',
    }));

    try {
      const schools = await loadAccessibleSchools();
      const preferredSchoolId =
        getStoredSchoolId() || profile?.schoolId || schools[0]?.schoolId || '';

      if (preferredSchoolId) {
        persistSchoolId(preferredSchoolId);
      }

      setState((current) => ({
        ...current,
        status: 'ready',
        schools,
        currentSchoolId: preferredSchoolId,
        currentSchool: createDraftSchool(preferredSchoolId),
        currentSchoolSettings: createDraftSchoolSettings(preferredSchoolId),
        error: '',
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        error: getErrorMessage(error, 'ไม่สามารถโหลดข้อมูลโรงเรียนได้'),
      }));
    }
  }, [isAuthenticated, isAuthLoading, loadAccessibleSchools, profile?.schoolId]);

  useEffect(() => {
    void bootstrapSchools();
  }, [bootstrapSchools]);

  useEffect(() => {
    applySchoolTheme(state.currentSchoolSettings.theme);
  }, [state.currentSchoolSettings.theme]);

  useEffect(() => {
    if (!isAuthenticated || isAuthLoading || profile?.role !== 'super_admin') {
      return undefined;
    }

    let unsubscribe = () => {};
    const timeoutId = window.setTimeout(() => {
      unsubscribe = subscribeSchools({
        onChange: (schools) => {
          setState((current) => {
            const nextCurrentSchoolId =
              current.currentSchoolId || profile?.schoolId || schools[0]?.schoolId || '';

            if (nextCurrentSchoolId) {
              persistSchoolId(nextCurrentSchoolId);
            }

            return {
              ...current,
              status: 'ready',
              schools,
              currentSchoolId: nextCurrentSchoolId,
              error: '',
            };
          });
        },
        onError: (snapshotError) => {
          setState((current) => ({
            ...current,
            status: 'error',
            error: getErrorMessage(snapshotError, 'ไม่สามารถซิงก์ข้อมูลโรงเรียนได้'),
          }));
        },
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [isAuthenticated, isAuthLoading, profile?.role, profile?.schoolId]);

  useEffect(() => {
    if (!isAuthenticated || !state.currentSchoolId) {
      return undefined;
    }

    let unsubscribeSchool = () => {};
    let unsubscribeSettings = () => {};
    const schoolId = state.currentSchoolId;
    const timeoutId = window.setTimeout(() => {
      unsubscribeSchool = subscribeSchoolById({
        schoolId,
        onChange: (school) => {
          setState((current) => ({
            ...current,
            status: 'ready',
            currentSchool: school || createDraftSchool(schoolId),
            schools: school ? mergeSchoolIntoCollection(current.schools, school) : current.schools,
            error: '',
          }));
        },
        onError: (snapshotError) => {
          setState((current) => ({
            ...current,
            status: 'error',
            error: getErrorMessage(snapshotError, 'ไม่สามารถซิงก์โรงเรียนปัจจุบันได้'),
          }));
        },
      });
      unsubscribeSettings = subscribeSchoolSettingsById({
        schoolId,
        onChange: (schoolSettings) => {
          setState((current) => ({
            ...current,
            status: 'ready',
            currentSchoolSettings: schoolSettings,
            error: '',
          }));
        },
        onError: (snapshotError) => {
          setState((current) => ({
            ...current,
            status: 'error',
            error: getErrorMessage(snapshotError, 'ไม่สามารถซิงก์การตั้งค่าโรงเรียนได้'),
          }));
        },
      });
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribeSchool();
      unsubscribeSettings();
    };
  }, [isAuthenticated, state.currentSchoolId]);

  function setCurrentSchoolId(schoolId) {
    if (!schoolId) {
      return;
    }

    persistSchoolId(schoolId);

    setState((current) => ({
      ...current,
      currentSchoolId: schoolId,
      currentSchool: createDraftSchool(schoolId),
      currentSchoolSettings: createDraftSchoolSettings(schoolId),
      error: '',
      status: 'ready',
    }));
  }

  async function saveCurrentSchoolSettings(payload) {
    const normalizedSchoolId = payload.schoolId.trim();

    if (!normalizedSchoolId) {
      throw new Error('ไม่พบรหัสโรงเรียน');
    }

    setState((current) => ({
      ...current,
      isSaving: true,
      error: '',
    }));

    try {
      const [savedSchool, savedSchoolSettings] = await Promise.all([
        upsertSchool({
          schoolId: normalizedSchoolId,
          name: payload.schoolName,
          logoUrl: payload.logoUrl,
          affiliation: payload.affiliation,
        }),
        upsertSchoolSettings({
          schoolId: normalizedSchoolId,
          signatures: payload.signatures,
          theme: payload.theme,
        }),
      ]);

      const schools = await loadAccessibleSchools();

      persistSchoolId(normalizedSchoolId);

      setState((current) => ({
        ...current,
        status: 'ready',
        schools,
        currentSchoolId: normalizedSchoolId,
        currentSchool: savedSchool,
        currentSchoolSettings: savedSchoolSettings,
        error: '',
        isSaving: false,
      }));

      return {
        school: savedSchool,
        schoolSettings: savedSchoolSettings,
      };
    } catch (error) {
      setState((current) => ({
        ...current,
        isSaving: false,
        status: 'error',
        error: getErrorMessage(error, 'ไม่สามารถบันทึกการตั้งค่าโรงเรียนได้'),
      }));
      throw error;
    }
  }

  const value = {
    ...state,
    refreshCurrentSchool: bootstrapSchools,
    saveCurrentSchoolSettings,
    setCurrentSchoolId,
  };

  return <CurrentSchoolContext.Provider value={value}>{children}</CurrentSchoolContext.Provider>;
}
