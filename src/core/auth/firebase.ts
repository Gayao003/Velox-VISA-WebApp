import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

export const isFirebaseConfigured = (): boolean => {
  const key = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  return Boolean(
    key &&
      key.trim() !== '' &&
      key !== 'your_api_key_here' &&
      projectId &&
      projectId.trim() !== ''
  );
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

const ensureInitialized = (): boolean => {
  if (!isFirebaseConfigured()) return false;
  if (!app) {
    try {
      app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      auth = getAuth(app);
      googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: 'select_account' });

      try {
        db = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch {
        db = getFirestore(app);
      }
    } catch (err) {
      console.warn('[Firebase] Initialization error:', err);
      return false;
    }
  }
  return Boolean(auth && db && googleProvider);
};

ensureInitialized();

export const getFirebaseAuth = (): Auth | null => {
  ensureInitialized();
  return auth;
};

export const getFirebaseDb = (): Firestore | null => {
  ensureInitialized();
  return db;
};

export interface FirebaseAuthResult {
  success: boolean;
  uid?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  error?: string;
  needsConfig?: boolean;
}

const mapAuthError = (error: any): string => {
  switch (error?.code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled: Google sign-in window was closed.';
    case 'auth/unauthorized-domain':
      return 'Unauthorized domain. Add localhost to Firebase Console > Authentication > Settings > Authorized domains.';
    case 'auth/popup-blocked':
      return 'Popup blocked by browser. Please allow popups for this site.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return error?.message || 'Authentication failed.';
  }
};

export const signInWithGoogleFirebase = async (): Promise<FirebaseAuthResult> => {
  if (!ensureInitialized() || !auth || !googleProvider) {
    return {
      success: false,
      needsConfig: true,
      error: 'Firebase credentials are not configured in .env.',
    };
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (!user.email) {
      return { success: false, error: 'Google account did not return an email address.' };
    }
    return {
      success: true,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      photoURL: user.photoURL || undefined,
    };
  } catch (error: any) {
    return { success: false, error: mapAuthError(error) };
  }
};

export const signInWithEmailFirebase = async (
  email: string,
  password: string
): Promise<FirebaseAuthResult> => {
  if (!ensureInitialized() || !auth) {
    return { success: false, needsConfig: true, error: 'Firebase is not configured.' };
  }
  try {
    const res = await signInWithEmailAndPassword(auth, email.trim(), password);
    const user = res.user;
    return {
      success: true,
      uid: user.uid,
      email: user.email || email.trim(),
      displayName: user.displayName || (user.email || email).split('@')[0],
      photoURL: user.photoURL || undefined,
    };
  } catch (error: any) {
    return { success: false, error: mapAuthError(error) };
  }
};

export const registerWithEmailFirebase = async (
  email: string,
  password: string,
  fullName: string
): Promise<FirebaseAuthResult> => {
  if (!ensureInitialized() || !auth) {
    return { success: false, needsConfig: true, error: 'Firebase is not configured.' };
  }
  try {
    const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const user = res.user;
    if (fullName.trim()) {
      await updateProfile(user, { displayName: fullName.trim() });
    }
    return {
      success: true,
      uid: user.uid,
      email: user.email || email.trim(),
      displayName: fullName.trim() || (user.email || email).split('@')[0],
    };
  } catch (error: any) {
    return { success: false, error: mapAuthError(error) };
  }
};

export const sendPasswordResetFirebase = async (
  email: string
): Promise<{ success: boolean; message: string }> => {
  if (!ensureInitialized() || !auth) {
    return { success: false, message: 'Firebase is not configured.' };
  }
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return {
      success: true,
      message: `Password reset email sent to ${email.trim()}. Check your inbox (and spam folder).`,
    };
  } catch (error: any) {
    return { success: false, message: mapAuthError(error) };
  }
};

export const signOutFirebase = async (): Promise<void> => {
  if (auth) {
    try {
      await fbSignOut(auth);
    } catch {
      // ignore
    }
  }
};

export const subscribeFirebaseAuth = (cb: (user: FirebaseUser | null) => void): (() => void) => {
  if (!ensureInitialized() || !auth) return () => {};
  return onAuthStateChanged(auth, cb);
};
