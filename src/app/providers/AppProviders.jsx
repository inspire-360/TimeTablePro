import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../modules/auth/context/AuthProvider';
import { CurrentSchoolProvider } from '../../modules/schools/context/CurrentSchoolProvider';

export function AppProviders({ children }) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CurrentSchoolProvider>{children}</CurrentSchoolProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
