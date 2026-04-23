import { useContext } from 'react';
import { CurrentSchoolContext } from './currentSchoolContext';

export function useCurrentSchool() {
  const context = useContext(CurrentSchoolContext);

  if (!context) {
    throw new Error('useCurrentSchool must be used inside CurrentSchoolProvider.');
  }

  return context;
}
