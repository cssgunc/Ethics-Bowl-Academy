import { readFileSync } from 'fs';
import { resolve } from 'path';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { STEP_COLLECTIONS } from '../firebase/types';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run npm run test:rules to start the local Firestore emulator.');
  environment = await initializeTestEnvironment({
    projectId: 'demo-module-export',
    firestore: { rules: readFileSync(resolve(__dirname, '../../../../backend/firestore.rules'), 'utf8') },
  });
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, 'users', 'admin'), { isAdmin: true }),
      setDoc(doc(db, 'users', 'student'), { isAdmin: false }),
      setDoc(doc(db, 'modules', 'public'), { title: 'Public', isPublic: true, createdBy: 'owner', collaborators: [] }),
      setDoc(doc(db, 'modules', 'private'), { title: 'Private', isPublic: false, createdBy: 'owner', collaborators: ['collaborator'] }),
      ...Object.values(STEP_COLLECTIONS).map((name) => setDoc(doc(db, 'modules', 'private', name, 'step'), { createdBy: 'owner' })),
    ]);
  });
}, 30_000);

afterAll(async () => { await environment?.cleanup(); });

it('allows an admin to list and read both public and private modules', async () => {
  const db = environment.authenticatedContext('admin').firestore();
  await assertSucceeds(getDoc(doc(db, 'modules', 'private')));
  const modules = await assertSucceeds(getDocs(collection(db, 'modules')));
  expect(modules.docs.map((item) => item.id).sort()).toEqual(['private', 'public']);
});

it('allows admins to read all seven private step collections', async () => {
  const db = environment.authenticatedContext('admin').firestore();
  await Promise.all(Object.values(STEP_COLLECTIONS).map((name) => assertSucceeds(getDocs(collection(db, 'modules', 'private', name)))));
});

it('denies unrelated students private modules, unfiltered listings, and private steps', async () => {
  const db = environment.authenticatedContext('student').firestore();
  await assertFails(getDoc(doc(db, 'modules', 'private')));
  await assertFails(getDocs(collection(db, 'modules')));
  await assertFails(getDocs(collection(db, 'modules', 'private', 'additionalResources')));
});

it('denies anonymous users private modules while retaining public access', async () => {
  const db = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'modules', 'private')));
  await assertSucceeds(getDoc(doc(db, 'modules', 'public')));
});

it('retains owner and collaborator access to private modules', async () => {
  await assertSucceeds(getDoc(doc(environment.authenticatedContext('owner').firestore(), 'modules', 'private')));
  await assertSucceeds(getDoc(doc(environment.authenticatedContext('collaborator').firestore(), 'modules', 'private')));
});
