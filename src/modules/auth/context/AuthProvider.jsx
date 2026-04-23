import { useCallback, useEffect, useState } from 'react';
import {
  loginWithEmailPassword,
  loginWithGoogle,
  logout,
  observeAuthState,
  registerWithEmailPassword,
} from '../api/authRepository';
import { getUserProfile } from '../api/userProfileRepository';
import { AuthContext } from './authContext';

const initialState = {
  status: 'loading',
  user: null,
  profile: null,
  error: '',
};

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState);

  const hydrateSession = useCallback(async (user) => {
    if (!user) {
      setState({
        status: 'guest',
        user: null,
        profile: null,
        error: '',
      });
      return;
    }

    setState((current) => ({
      ...current,
      status: 'loading',
      user,
      error: '',
    }));

    try {
      const profile = await getUserProfile(user.uid);

      if (!profile) {
        setState({
          status: 'guest',
          user: null,
          profile: null,
          error:
            'ไม่พบโปรไฟล์ผู้ใช้ในระบบ กรุณาสร้างบัญชีหรือติดต่อผู้ดูแลระบบ',
        });
        return;
      }

      setState({
        status: 'authenticated',
        user,
        profile,
        error: '',
      });
    } catch (error) {
      setState({
        status: 'error',
        user: null,
        profile: null,
        error: getErrorMessage(error, 'ไม่สามารถกู้คืนสถานะการเข้าสู่ระบบได้'),
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = observeAuthState((user) => {
      void hydrateSession(user);
    });

    return unsubscribe;
  }, [hydrateSession]);

  async function handleLoginWithEmail(credentials) {
    setState((current) => ({ ...current, status: 'loading', error: '' }));

    const session = await loginWithEmailPassword(credentials);

    setState({
      status: 'authenticated',
      user: session.user,
      profile: session.profile,
      error: '',
    });

    return session;
  }

  async function handleRegisterWithEmail(payload) {
    setState((current) => ({ ...current, status: 'loading', error: '' }));

    const session = await registerWithEmailPassword(payload);

    setState({
      status: 'authenticated',
      user: session.user,
      profile: session.profile,
      error: '',
    });

    return session;
  }

  async function handleGoogleLogin(profileInput) {
    setState((current) => ({ ...current, status: 'loading', error: '' }));

    const session = await loginWithGoogle(profileInput);

    setState({
      status: 'authenticated',
      user: session.user,
      profile: session.profile,
      error: '',
    });

    return session;
  }

  async function handleLogout() {
    await logout();
    setState({
      status: 'guest',
      user: null,
      profile: null,
      error: '',
    });
  }

  const value = {
    ...state,
    isAuthenticated: state.status === 'authenticated',
    isLoading: state.status === 'loading',
    loginWithEmail: handleLoginWithEmail,
    loginWithGoogle: handleGoogleLogin,
    logout: handleLogout,
    registerWithEmail: handleRegisterWithEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
