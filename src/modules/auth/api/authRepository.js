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
    'This account already exists with a different sign-in method.',
  'auth/email-already-in-use': 'This email is already in use.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'The email address is invalid.',
  'auth/network-request-failed': 'Network error. Please try again.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled before completion.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/weak-password': 'Password must be at least 8 characters.',
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

    throw mapAuthError(error, 'Unable to create the account right now.');
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

    throw mapAuthError(error, 'Unable to sign in right now.');
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

    throw mapAuthError(error, 'Unable to sign in with Google right now.');
  }
}

export async function logout() {
  await signOut(auth);
}
