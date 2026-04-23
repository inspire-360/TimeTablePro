import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../../../core/firebase/client';
import { syncUserProfile } from './userProfileRepository';

const authErrorMessages = {
  'auth/account-exists-with-different-credential':
    'บัญชีนี้มีอยู่แล้วด้วยวิธีเข้าสู่ระบบอื่น',
  'auth/email-already-in-use': 'อีเมลนี้ถูกใช้งานแล้ว',
  'auth/invalid-credential': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
  'auth/network-request-failed': 'เครือข่ายขัดข้อง กรุณาลองใหม่อีกครั้ง',
  'auth/popup-closed-by-user': 'การเข้าสู่ระบบด้วย Google ถูกยกเลิก',
  'auth/too-many-requests': 'พยายามหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง',
  'auth/weak-password': 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
};

function mapAuthError(error, fallbackMessage) {
  if (error?.code && authErrorMessages[error.code]) {
    return new Error(authErrorMessages[error.code]);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}

export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function registerWithEmailPassword({
  displayName,
  email,
  password,
  role,
  schoolId,
}) {
  let userCredential;

  try {
    userCredential = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName?.trim()) {
      await updateProfile(userCredential.user, {
        displayName: displayName.trim(),
      });
    }

    const profile = await syncUserProfile(userCredential.user, {
      displayName,
      role,
      schoolId,
    });

    return {
      user: userCredential.user,
      profile,
    };
  } catch (error) {
    if (userCredential?.user) {
      try {
        await deleteUser(userCredential.user);
      } catch {
        // Ignore cleanup failures and surface the original error.
      }
    }

    throw mapAuthError(error, 'ไม่สามารถสร้างบัญชีได้ในขณะนี้');
  }
}

export async function loginWithEmailPassword({ email, password }) {
  let userCredential;

  try {
    userCredential = await signInWithEmailAndPassword(auth, email, password);
    const profile = await syncUserProfile(userCredential.user);

    return {
      user: userCredential.user,
      profile,
    };
  } catch (error) {
    if (userCredential?.user) {
      try {
        await signOut(auth);
      } catch {
        // Ignore cleanup failures and surface the original error.
      }
    }

    throw mapAuthError(error, 'ไม่สามารถเข้าสู่ระบบได้ในขณะนี้');
  }
}

export async function loginWithGoogle(profileInput = {}) {
  let userCredential;

  try {
    userCredential = await signInWithPopup(auth, googleAuthProvider);
    const profile = await syncUserProfile(userCredential.user, profileInput);

    return {
      user: userCredential.user,
      profile,
    };
  } catch (error) {
    if (userCredential?.user || auth.currentUser) {
      try {
        await signOut(auth);
      } catch {
        // Ignore cleanup failures and surface the original error.
      }
    }

    throw mapAuthError(error, 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้ในขณะนี้');
  }
}

export async function logout() {
  await signOut(auth);
}
