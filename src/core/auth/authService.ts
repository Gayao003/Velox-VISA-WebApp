import { doc, getDoc, setDoc } from 'firebase/firestore';
import { VisaUser } from '../../models/visa';
import {
  getFirebaseDb,
  isFirebaseConfigured,
  signInWithGoogleFirebase,
  signInWithEmailFirebase,
  registerWithEmailFirebase,
  sendPasswordResetFirebase,
  signOutFirebase,
  FirebaseAuthResult,
} from './firebase';

const SESSION_KEY = 'visa_auth_session_v1';

export interface AuthSession {
  user: VisaUser;
  mode: 'firebase' | 'local';
  signedInAt: string;
}

type SessionListener = (session: AuthSession | null) => void;
const listeners = new Set<SessionListener>();

function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredSession(session: AuthSession | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
  listeners.forEach((cb) => cb(session));
}

async function syncUserProfileToFirestore(
  res: FirebaseAuthResult
): Promise<{ success: boolean; error?: string }> {
  if (!res.success || !res.email) {
    return { success: false, error: res.error || 'Authentication failed.' };
  }

  const db = getFirebaseDb();
  const uid = res.uid || res.email.toLowerCase();
  let userProfile: VisaUser = {
    id: uid,
    email: res.email,
    fullName: res.displayName || res.email.split('@')[0],
    role: 'admin',
    assignedStations: ['All Stations'],
    photoURL: res.photoURL,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  if (db) {
    try {
      const userRef = doc(db, 'visa_users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const existing = snap.data() as VisaUser;
        if (existing.isActive === false) {
          await signOutFirebase();
          return {
            success: false,
            error: 'Your account has been deactivated. Contact an administrator.',
          };
        }
        userProfile = {
          ...existing,
          id: uid,
          photoURL: res.photoURL || existing.photoURL,
          fullName: existing.fullName || res.displayName || res.email,
        };
      } else {
        await setDoc(userRef, userProfile);
      }
    } catch (err) {
      console.warn('[AuthService] Could not sync user profile to Firestore:', err);
    }
  }

  setStoredSession({
    user: userProfile,
    mode: 'firebase',
    signedInAt: new Date().toISOString(),
  });
  return { success: true };
}

export const authService = {
  getSession(): AuthSession | null {
    return getStoredSession();
  },

  getCurrentUser(): VisaUser | null {
    return getStoredSession()?.user ?? null;
  },

  isAuthenticated(): boolean {
    return Boolean(getStoredSession()?.user);
  },

  subscribe(cb: SessionListener): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    const res = await signInWithGoogleFirebase();
    return syncUserProfileToFirestore(res);
  },

  async signInWithEmail(
    emailOrUsername: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    const idTrimmed = emailOrUsername.trim().toLowerCase();
    // Seeded local admin account (username: admin, password: admin)
    if ((idTrimmed === 'admin' || idTrimmed === 'admin@velox.ph') && password === 'admin') {
      return syncUserProfileToFirestore({
        success: true,
        uid: 'seeded-admin',
        email: 'admin@velox.ph',
        displayName: 'System Administrator',
      });
    }
    const res = await signInWithEmailFirebase(emailOrUsername, password);
    return syncUserProfileToFirestore(res);
  },

  async registerWithEmail(
    email: string,
    password: string,
    fullName: string
  ): Promise<{ success: boolean; error?: string }> {
    const res = await registerWithEmailFirebase(email, password, fullName);
    return syncUserProfileToFirestore(res);
  },

  async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    return sendPasswordResetFirebase(email);
  },

  signInLocal(emailOrRole: string): { success: boolean; error?: string } {
    const q = emailOrRole.trim().toLowerCase();
    const user: VisaUser = {
      id: `local-${Date.now()}`,
      email: q.includes('@') ? q : `${q || 'operator'}@velox.ph`,
      fullName: q ? q.split('@')[0].toUpperCase() : 'Station Operator',
      role: 'admin',
      assignedStations: ['All Stations'],
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    setStoredSession({
      user,
      mode: isFirebaseConfigured() ? 'firebase' : 'local',
      signedInAt: new Date().toISOString(),
    });
    return { success: true };
  },

  async logout(): Promise<void> {
    await signOutFirebase();
    setStoredSession(null);
  },
};
