import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from '../core/auth/firebase';

const LOCAL_PREFIX = 'visa_db_';

function readLocal<T>(col: string): T[] {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + col);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(col: string, items: T[]) {
  localStorage.setItem(LOCAL_PREFIX + col, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(`visa:collection:${col}`));
}

/**
 * Firestore rejects objects containing `undefined` values.
 * Strip undefined keys recursively before writing.
 */
function stripUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj as Record<string, any>)) {
      if (v !== undefined) {
        clean[k] = stripUndefined(v);
      }
    }
    return clean as T;
  }
  return obj;
}

function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T | 'timeout'> {
  return Promise.race([
    promise,
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms)),
  ]);
}

export const firestoreService = {
  isCloudEnabled(): boolean {
    return isFirebaseConfigured() && Boolean(getFirebaseDb());
  },

  async getAll<T extends { id: string; createdAt?: string }>(colName: string): Promise<T[]> {
    const db = getFirebaseDb();
    if (db) {
      try {
        const q = query(collection(db, colName), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as T));
        writeLocal(colName, list);
        return list;
      } catch {
        const snap = await getDocs(collection(db, colName));
        const list = snap.docs.map((d) => ({ ...d.data(), id: d.id } as T));
        writeLocal(colName, list);
        return list;
      }
    }
    return readLocal<T>(colName);
  },

  subscribe<T extends { id: string }>(
    colName: string,
    onData: (items: T[]) => void
  ): () => void {
    const db = getFirebaseDb();
    if (db) {
      const unsub = onSnapshot(
        collection(db, colName),
        (snap) => {
          const items = snap.docs.map((d) => ({ ...d.data(), id: d.id } as T));
          writeLocal(colName, items);
          onData(items);
        },
        (err) => {
          console.warn(`[Firestore] Snapshot error on ${colName}:`, err);
          onData(readLocal<T>(colName));
        }
      );
      return unsub;
    }

    onData(readLocal<T>(colName));
    const handler = () => onData(readLocal<T>(colName));
    window.addEventListener(`visa:collection:${colName}`, handler);
    return () => window.removeEventListener(`visa:collection:${colName}`, handler);
  },

  async save<T extends { id: string }>(colName: string, item: T): Promise<T> {
    const cleanItem = stripUndefined(item);
    const db = getFirebaseDb();
    const current = readLocal<T>(colName);
    const idx = current.findIndex((x) => x.id === cleanItem.id);
    const updated =
      idx >= 0
        ? current.map((x) => (x.id === cleanItem.id ? cleanItem : x))
        : [cleanItem, ...current];
    writeLocal(colName, updated);

    if (db) {
      try {
        await withTimeout(
          setDoc(doc(db, colName, cleanItem.id), cleanItem as Record<string, any>, { merge: true }),
          4000
        );
      } catch (err: any) {
        console.error(`[Firestore] Save failed on ${colName}:`, err);
        throw new Error(
          err?.code === 'permission-denied'
            ? 'Firestore permission denied. Check your Firestore Security Rules in Firebase Console.'
            : err?.message || 'Failed to save to Firestore.'
        );
      }
    }
    return cleanItem;
  },

  async remove(colName: string, id: string): Promise<void> {
    const db = getFirebaseDb();
    const current = readLocal<{ id: string }>(colName);
    writeLocal(
      colName,
      current.filter((x) => x.id !== id)
    );

    if (db) {
      try {
        await withTimeout(deleteDoc(doc(db, colName, id)), 4000);
      } catch (err: any) {
        console.error(`[Firestore] Delete failed on ${colName}:`, err);
        throw new Error(err?.message || 'Failed to delete from Firestore.');
      }
    }
  },
};
