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
        // Fallback if index or field missing
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

    // Local reactive fallback
    onData(readLocal<T>(colName));
    const handler = () => onData(readLocal<T>(colName));
    window.addEventListener(`visa:collection:${colName}`, handler);
    return () => window.removeEventListener(`visa:collection:${colName}`, handler);
  },

  async save<T extends { id: string }>(colName: string, item: T): Promise<T> {
    const db = getFirebaseDb();
    const current = readLocal<T>(colName);
    const idx = current.findIndex((x) => x.id === item.id);
    const updated = idx >= 0 ? current.map((x) => (x.id === item.id ? item : x)) : [item, ...current];
    writeLocal(colName, updated);

    if (db) {
      await setDoc(doc(db, colName, item.id), item as Record<string, any>, { merge: true });
    }
    return item;
  },

  async remove(colName: string, id: string): Promise<void> {
    const db = getFirebaseDb();
    const current = readLocal<{ id: string }>(colName);
    writeLocal(
      colName,
      current.filter((x) => x.id !== id)
    );

    if (db) {
      await deleteDoc(doc(db, colName, id));
    }
  },
};
