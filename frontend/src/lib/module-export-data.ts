import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase/firebaseConfig';
import { getModuleById } from './firebase/db-operations';
import { STEP_COLLECTIONS } from './firebase/types';
import type { Module, Step } from './firebase/types';

/** Admin-only reads; Firestore rules enforce access to private modules. */
export async function getExportModules(): Promise<Module[]> {
  if (!db) throw new Error('Firebase database is not initialized.');
  const snapshot = await getDocs(collection(db, 'modules'));
  return snapshot.docs
    .map((document) => ({ ...document.data(), id: document.id }) as Module)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getModuleForExport(moduleId: string) {
  if (!db) throw new Error('Firebase database is not initialized.');
  const [module, collections] = await Promise.all([
    getModuleById(moduleId),
    Promise.all(Object.entries(STEP_COLLECTIONS).map(async ([type, name]) => {
      // Do not orderBy: that would exclude legacy documents without an order field.
      const snapshot = await getDocs(collection(db!, 'modules', moduleId, name));
      return snapshot.docs.map((document) => ({
        type,
        ...document.data(),
        id: document.id,
      }) as Step);
    })),
  ]);
  return { ...module, id: moduleId, steps: collections.flat() };
}
