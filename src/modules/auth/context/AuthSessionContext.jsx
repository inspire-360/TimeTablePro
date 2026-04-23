import { useEffect, useState } from 'react';
import {
  observeAuthState,
  signInWithEmail,
  signOutCurrentUser,
} from '../api/authGateway';
import { createSchoolAccount } from '../services/createSchoolAccount';
import { resolveUserSession } from '../api/sessionRepository';
import { AuthSessionContext } from './authSessionContext';

const initialState = {
  status: 'loading',
  session: null,
  authUser: null,
  error: '',
};

function buildSessionErrorMessage(error) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูลโรงเรียน';
}

export function AuthSessionProvider({ children }) {
  const [state, setState] = useState(initialState);

  async function bootstrapSession(authUser) {
    if (!authUser) {
      setState({
        status: 'signed-out',
        session: null,
        authUser: null,
        error: '',
      });

      return null;
    }

    setState((current) => ({
      ...current,
      status: 'loading',
      authUser,
      error: '',
    }));

    try {
      const session = await resolveUserSession(authUser.uid);

      if (!session) {
        setState({
          status: 'session-error',
          session: null,
          authUser,
          error: 'บัญชีนี้ยังไม่มีข้อมูลโรงเรียนในระบบ กรุณาตรวจสอบสิทธิ์การเข้าใช้งาน',
        });

        return null;
      }

      setState({
        status: 'ready',
        session,
        authUser,
        error: '',
      });

      return session;
    } catch (error) {
      setState({
        status: 'session-error',
        session: null,
        authUser,
        error: buildSessionErrorMessage(error),
      });

      return null;
    }
  }

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = observeAuthState(async (authUser) => {
      if (!isMounted) {
        return;
      }

      await bootstrapSession(authUser);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  async function signIn(credentials) {
    const userCredential = await signInWithEmail(credentials.email, credentials.password);
    return bootstrapSession(userCredential.user);
  }

  async function registerSchool(payload) {
    const session = await createSchoolAccount(payload);

    setState({
      status: 'ready',
      session,
      authUser: { uid: session.user.uid },
      error: '',
    });

    return session;
  }

  async function signOut() {
    await signOutCurrentUser();
    setState({
      status: 'signed-out',
      session: null,
      authUser: null,
      error: '',
    });
  }

  const value = {
    ...state,
    isAuthenticated: state.status === 'ready' && Boolean(state.session),
    registerSchool,
    signIn,
    signOut,
  };

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}
