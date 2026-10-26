import { readFileSync } from "fs";
import { resolve } from "path";
import { webcrypto } from "crypto";
import {
  assertFails, assertSucceeds, initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, disableNetwork, doc, getDoc, getDocFromServer, getDocs, increment, runTransaction,
  serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

// Real Firestore clients, with auth identity supplied by the rules test environment.
jest.mock("../firebaseConfig", () => ({ __esModule: true, db: null, auth: { currentUser: null } }));
jest.mock("firebase/firestore", () => {
  const actual = jest.requireActual("firebase/firestore");
  return { ...actual, getDocFromServer: jest.fn(actual.getDocFromServer) };
});
import * as config from "../firebaseConfig";
import { createClassroom, createClassroomAttemptId, getOwnedClassrooms } from "../db-operations";

let environment: RulesTestEnvironment;
const teacherId = "teacher";
const studentId = "student";

function client(userId: string): Firestore {
  return environment.authenticatedContext(userId).firestore() as unknown as Firestore;
}

function useClient(userId: string) {
  Object.assign(config, { db: client(userId), auth: { currentUser: { uid: userId } } });
}

async function seed(classroomId = "classroom", joinCode = "ABC234", overrides = {}) {
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    const timestamp = Timestamp.now();
    await setDoc(doc(database, "classrooms", classroomId), {
      id: classroomId, name: "Ethics", teacherId, teacherDisplayName: "Teacher",
      joinCode, studentCount: 0, isArchived: false, createdAt: timestamp,
      updatedAt: timestamp, ...overrides,
    });
    await setDoc(doc(database, "classroomJoinCodes", joinCode), {
      classroomId, teacherId, isArchived: false, createdAt: timestamp,
    });
    await setDoc(doc(database, "users", teacherId, "classrooms", classroomId), {
      classroomId, classroomName: "Ethics", role: "teacher", joinCode, createdAt: timestamp,
    });
  });
}

function creation(database: Firestore, options: {
  omit?: string; classroom?: Record<string, unknown>; code?: Record<string, unknown>;
  index?: Record<string, unknown>; codeId?: string; indexOwner?: string;
} = {}) {
  const batch = writeBatch(database);
  const timestamp = serverTimestamp();
  if (options.omit !== "classroom") batch.set(doc(database, "classrooms", "new"), {
    id: "new", name: "Ethics", teacherId, teacherDisplayName: "Teacher", joinCode: "ABC234",
    studentCount: 0, isArchived: false, createdAt: timestamp, updatedAt: timestamp,
    ...options.classroom,
  });
  if (options.omit !== "code") batch.set(doc(database, "classroomJoinCodes", options.codeId ?? "ABC234"), {
    classroomId: "new", teacherId, isArchived: false, createdAt: timestamp, ...options.code,
  });
  if (options.omit !== "index") batch.set(doc(database, "users", options.indexOwner ?? teacherId, "classrooms", "new"), {
    classroomId: "new", classroomName: "Ethics", role: "teacher", joinCode: "ABC234",
    createdAt: timestamp, ...options.index,
  });
  return batch.commit();
}

function join(database: Firestore, userId = studentId, options: {
  omit?: string; member?: Record<string, unknown>; index?: Record<string, unknown>;
  classroom?: Record<string, unknown>;
} = {}) {
  const batch = writeBatch(database);
  if (options.omit !== "member") batch.set(doc(database, "classrooms", "classroom", "members", userId), {
    userId, role: "student", displayName: "Student", email: "student@example.com",
    joinedWithCode: "ABC234", joinedAt: serverTimestamp(), status: "active", ...options.member,
  });
  if (options.omit !== "index") batch.set(doc(database, "users", userId, "classrooms", "classroom"), {
    classroomId: "classroom", classroomName: "Ethics", role: "student", teacherId,
    joinedAt: serverTimestamp(), ...options.index,
  });
  if (options.omit !== "classroom") batch.update(doc(database, "classrooms", "classroom"), {
    studentCount: increment(1), updatedAt: serverTimestamp(), ...options.classroom,
  });
  return batch.commit();
}

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Run npm run test:rules with the local emulator.");
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
  environment = await initializeTestEnvironment({
    projectId: "demo-classrooms",
    firestore: { rules: readFileSync(resolve(__dirname, "../../../../../backend/firestore.rules"), "utf8") },
  });
}, 30_000);
beforeEach(async () => {
  jest.restoreAllMocks();
  (getDocFromServer as jest.Mock).mockReset().mockImplementation(jest.requireActual("firebase/firestore").getDocFromServer);
  await environment.clearFirestore();
  useClient(teacherId);
});
afterAll(async () => { await environment?.cleanup(); });

it("creates exactly three matching records with resolved timestamps and no user role", async () => {
  const classroom = await createClassroom(teacherId, "Teacher", "  Ethics  ");
  expect(classroom.name).toBe("Ethics");
  expect(classroom.joinCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  expect(classroom.createdAt).toBeInstanceOf(Timestamp);
  expect(classroom.updatedAt.isEqual(classroom.createdAt)).toBe(true);
  expect(classroom.studentCount).toBe(0);
  const database = config.db!;
  expect((await getDoc(doc(database, "classroomJoinCodes", classroom.joinCode))).data()).toMatchObject({
    classroomId: classroom.id, teacherId, isArchived: false, createdAt: classroom.createdAt,
  });
  expect((await getDoc(doc(database, "users", teacherId, "classrooms", classroom.id))).data()).toEqual({
    classroomId: classroom.id, classroomName: "Ethics", role: "teacher",
    joinCode: classroom.joinCode, createdAt: classroom.createdAt,
  });
  expect((await getDoc(doc(database, "users", teacherId))).exists()).toBe(false);
  expect((await getDocs(collection(database, "classrooms", classroom.id, "members"))).empty).toBe(true);
});

it.each(["", "   ", "a".repeat(81)])("rejects invalid names: %p", async (name) => {
  await expect(createClassroom(teacherId, "Teacher", name)).rejects.toThrow("1 and 80");
});

it("accepts the name length boundaries", async () => {
  expect((await createClassroom(teacherId, "Teacher", "A")).name).toBe("A");
  expect((await createClassroom(teacherId, "Teacher", "A".repeat(80))).name).toHaveLength(80);
});

it("recovers the same committed classroom after a failed read-back without creating duplicates", async () => {
  const attemptId = createClassroomAttemptId(teacherId);
  (getDocFromServer as jest.Mock).mockRejectedValueOnce(new Error("Simulated refresh failure"));
  await expect(createClassroom(teacherId, "Teacher", "Ethics", attemptId)).rejects.toThrow("Your classroom was saved");
  const recovered = await createClassroom(teacherId, "Teacher", "Ethics", attemptId);
  expect(recovered.id).toBe(attemptId);
  expect(recovered.createdAt).toBeInstanceOf(Timestamp);
  expect(await getOwnedClassrooms(teacherId)).toHaveLength(1);
  await environment.withSecurityRulesDisabled(async (context) => {
    expect((await getDocs(collection(context.firestore(), "classrooms"))).size).toBe(1);
    expect((await getDocs(collection(context.firestore(), "classroomJoinCodes"))).size).toBe(1);
  });
});

it("returns one classroom for concurrent submissions of the same attempt ID", async () => {
  const attemptId = createClassroomAttemptId(teacherId);
  const [first, second] = await Promise.all([
    createClassroom(teacherId, "Teacher", "Ethics", attemptId),
    createClassroom(teacherId, "Teacher", "Ethics", attemptId),
  ]);
  expect(first.id).toBe(attemptId);
  expect(second.id).toBe(attemptId);
  expect(first.joinCode).toBe(second.joinCode);
  expect(await getOwnedClassrooms(teacherId)).toHaveLength(1);
});

it("rejects an existing attempt with a different name or owner", async () => {
  const attemptId = createClassroomAttemptId(teacherId);
  await createClassroom(teacherId, "Teacher", "Original", attemptId);
  await expect(createClassroom(teacherId, "Teacher", "Changed", attemptId)).rejects.toThrow("Unable to create");
  useClient(studentId);
  await expect(createClassroom(studentId, "Student", "Original", attemptId)).rejects.toThrow("Unable to create");
  useClient(teacherId);
  expect((await getOwnedClassrooms(teacherId)).map((item) => item.name)).toEqual(["Original"]);
});

it("reports connectivity failure rather than zero ownership with an empty offline cache", async () => {
  await createClassroom(teacherId, "Teacher", "Ethics");
  useClient(teacherId);
  await disableNetwork(config.db!);
  await expect(getOwnedClassrooms(teacherId)).rejects.toThrow("Unable to connect");
});

it("does not silently omit an uncached classroom when its server read fails", async () => {
  await createClassroom(teacherId, "Teacher", "Ethics");
  (getDocFromServer as jest.Mock).mockRejectedValueOnce({ code: "unavailable" });
  await expect(getOwnedClassrooms(teacherId)).rejects.toThrow("Unable to connect");
});

it("rejects missing auth and attempts to act for another user", async () => {
  Object.assign(config, { auth: { currentUser: null } });
  await expect(createClassroom(teacherId, "Teacher", "Ethics")).rejects.toThrow("sign in");
  await expect(getOwnedClassrooms(teacherId)).rejects.toThrow("sign in");
  useClient(studentId);
  await expect(createClassroom(teacherId, "Teacher", "Ethics")).rejects.toThrow("sign in");
  await expect(getOwnedClassrooms(teacherId)).rejects.toThrow("sign in");
});

it("retries a code collision without overwriting the old classroom", async () => {
  await seed("existing", "AAAAAA");
  const random = jest.spyOn(globalThis.crypto, "getRandomValues")
    .mockImplementationOnce((array) => { (array as Uint8Array).fill(0); return array; })
    .mockImplementation((array) => { (array as Uint8Array).fill(1); return array; });
  const result = await createClassroom(teacherId, "Teacher", "New");
  expect(result.joinCode).toBe("BBBBBB");
  expect(random).toHaveBeenCalledTimes(2);
  expect((await getDoc(doc(config.db!, "classroomJoinCodes", "AAAAAA"))).data()?.classroomId).toBe("existing");
});

it("resolves simultaneous attempts to reserve the same code without losing either classroom", async () => {
  // Both calls initially choose AAAAAA. The transaction loser must retry with BBBBBB.
  const originalRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  let codeAttempts = 0;
  jest.spyOn(globalThis.crypto, "getRandomValues").mockImplementation((array) => {
    // Keep Firestore's own random document IDs independent of the forced code collision.
    if (array instanceof Uint8Array && array.length === 6) {
      array.fill(codeAttempts++ < 2 ? 0 : 1);
      return array;
    }
    return originalRandom(array);
  });
  const classrooms = await Promise.all([
    createClassroom(teacherId, "Teacher", "First"),
    createClassroom(teacherId, "Teacher", "Second"),
  ]);
  expect(classrooms.map((item) => item.joinCode).sort()).toEqual(["AAAAAA", "BBBBBB"]);
  expect(new Set(classrooms.map((item) => item.id)).size).toBe(2);
  expect(codeAttempts).toBe(3);
  for (const classroom of classrooms) {
    const code = await getDoc(doc(config.db!, "classroomJoinCodes", classroom.joinCode));
    expect(code.data()?.classroomId).toBe(classroom.id);
  }
  expect((await getOwnedClassrooms(teacherId)).map((item) => item.name)).toEqual(["First", "Second"]);
});

it("bounds collision retries and leaves no partial classroom", async () => {
  await seed("existing", "AAAAAA");
  const random = jest.spyOn(globalThis.crypto, "getRandomValues")
    .mockImplementation((array) => { (array as Uint8Array).fill(0); return array; });
  await expect(createClassroom(teacherId, "Teacher", "New")).rejects.toThrow("available classroom code");
  expect(random).toHaveBeenCalledTimes(10);
  await environment.withSecurityRulesDisabled(async (context) => {
    expect((await getDocs(collection(context.firestore(), "classrooms"))).size).toBe(1);
  });
});

it("returns a friendly code-generation error", async () => {
  jest.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(() => { throw new Error("internal detail"); });
  await expect(createClassroom(teacherId, "Teacher", "New")).rejects.toThrow("Unable to generate");
});

it("does not leak raw Firebase errors when server authorization rejects an operation", async () => {
  // Simulate an expired/stale client identity: local identity and server identity disagree.
  Object.assign(config, { db: client(studentId), auth: { currentUser: { uid: teacherId } } });
  await expect(createClassroom(teacherId, "Teacher", "New")).rejects.toThrow("Please sign in again");
  await expect(getOwnedClassrooms(teacherId)).rejects.toThrow("Please sign in again");
});

it("returns an empty owned list for a user with no classrooms", async () => {
  expect(await getOwnedClassrooms(teacherId)).toEqual([]);
});

it("discovers owned classrooms from the private index, filters student entries, and sorts by name", async () => {
  await createClassroom(teacherId, "Teacher", "Zulu");
  await createClassroom(teacherId, "Teacher", "Alpha");
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users", teacherId, "classrooms", "joined"), { role: "student" });
  });
  expect((await getOwnedClassrooms(teacherId)).map((item) => item.name)).toEqual(["Alpha", "Zulu"]);
});

it.each(["classroom", "code", "index"])("rejects partial creation missing %s", async (omit) => {
  await assertFails(creation(client(teacherId), { omit }));
  expect((await getDoc(doc(client(teacherId), "classrooms", "new"))).exists()).toBe(false);
});

it.each([
  { classroom: { teacherId: "other" } }, { classroom: { studentCount: 1 } },
  { classroom: { isArchived: true } }, { classroom: { id: "wrong" } },
  { classroom: { name: " " } }, { classroom: { name: "a".repeat(81) } },
  { classroom: { name: 3 } }, { classroom: { teacherDisplayName: false } },
  { classroom: { extra: true } }, { classroom: { createdAt: Timestamp.fromMillis(1) } },
  { classroom: { updatedAt: Timestamp.fromMillis(1) } }, { classroom: { joinCode: "IIIIII" } },
  { classroom: { studentCount: 0.5 } }, { codeId: "ABC235" },
  { code: { teacherId: "other" } }, { code: { classroomId: "wrong" } },
  { code: { extra: true } }, { code: { isArchived: true } },
  { code: { createdAt: Timestamp.fromMillis(1) } },
  { index: { classroomName: "wrong" } }, { index: { joinCode: "ABC235" } },
  { index: { classroomId: "wrong" } }, { index: { extra: true } },
  { indexOwner: "other" }, { index: { createdAt: Timestamp.fromMillis(1) } },
])("rejects malformed or mismatched classroom creation: %p", async (options) => {
  await assertFails(creation(client(teacherId), options));
});

it("denies anonymous creation and code/classroom reads", async () => {
  const database = environment.unauthenticatedContext().firestore() as unknown as Firestore;
  await assertFails(creation(database));
  await assertFails(getDoc(doc(database, "classroomJoinCodes", "ABC234")));
  await assertFails(getDoc(doc(database, "classrooms", "classroom")));
});

it("allows exact classroom and code reads, including unused codes, but denies enumeration", async () => {
  await seed();
  const database = client(studentId);
  await assertSucceeds(getDoc(doc(database, "classrooms", "classroom")));
  await assertSucceeds(getDoc(doc(database, "classroomJoinCodes", "ABC234")));
  await assertSucceeds(getDoc(doc(database, "classroomJoinCodes", "ZZZZZZ")));
  await assertFails(getDocs(collection(database, "classrooms")));
  await assertFails(getDocs(collection(database, "classroomJoinCodes")));
  await assertFails(getDocs(collection(database, "users", teacherId, "classrooms")));
});

it("allows a valid atomic join without duplicating the teacher as a member", async () => {
  await seed();
  await assertSucceeds(join(client(studentId)));
  expect((await getDoc(doc(client(studentId), "classrooms", "classroom"))).data()?.studentCount).toBe(1);
  expect((await getDoc(doc(client(teacherId), "classrooms", "classroom", "members", teacherId))).exists()).toBe(false);
});

it.each(["member", "index", "classroom"])("rejects a partial join missing %s", async (omit) => {
  await seed();
  await assertFails(join(client(studentId), studentId, { omit }));
});

it.each([
  { member: { userId: "other" } }, { member: { role: "teacher" } },
  { member: { status: "inactive" } }, { member: { joinedWithCode: "ABC235" } },
  { member: { displayName: 1 } }, { member: { email: false } },
  { member: { joinedAt: Timestamp.fromMillis(1) } }, { member: { extra: true } },
  { index: { teacherId: studentId } }, { index: { classroomName: "wrong" } },
  { index: { classroomId: "wrong" } }, { index: { role: "teacher" } },
  { index: { joinedAt: Timestamp.fromMillis(1) } }, { index: { extra: true } },
  { classroom: { studentCount: 2 } }, { classroom: { studentCount: 0 } },
  { classroom: { name: "Changed" } }, { classroom: { teacherId: studentId } },
  { classroom: { updatedAt: Timestamp.fromMillis(1) } },
])("rejects invalid memberships, indexes, or count updates: %p", async (options) => {
  await seed();
  await assertFails(join(client(studentId), studentId, options));
});

it("rejects archived classrooms, owners joining themselves, and joining as another user", async () => {
  await seed("classroom", "ABC234", { isArchived: true });
  await assertFails(join(client(studentId)));
  await seed();
  await assertFails(join(client(teacherId), teacherId));
  await assertFails(join(client("outsider"), studentId));
});

it("rejects archived or missing code lookups", async () => {
  await seed();
  await environment.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "classroomJoinCodes", "ABC234"), { isArchived: true });
  });
  await assertFails(join(client(studentId)));
  await environment.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(context.firestore(), "classroomJoinCodes", "ABC234"));
  });
  await assertFails(join(client(studentId)));
});

it("denies a repeated join, but permits idempotent transaction reads without changing the count", async () => {
  await seed();
  const database = client(studentId);
  await assertSucceeds(join(database));
  await assertFails(join(database));
  const alreadyMember = await runTransaction(database, async (transaction) => {
    return (await transaction.get(doc(database, "classrooms", "classroom", "members", studentId))).exists();
  });
  expect(alreadyMember).toBe(true);
  expect((await getDoc(doc(database, "classrooms", "classroom"))).data()?.studentCount).toBe(1);
});

it("keeps counts correct when different students join concurrently", async () => {
  await seed();
  await Promise.all([join(client(studentId)), join(client("student2"), "student2")]);
  expect((await getDoc(doc(client(teacherId), "classrooms", "classroom"))).data()?.studentCount).toBe(2);
});

it("allows a user to own one classroom and join another", async () => {
  await seed();
  useClient(studentId);
  await createClassroom(studentId, "Student who teaches", "My classroom");
  await assertSucceeds(join(client(studentId)));
  expect((await getOwnedClassrooms(studentId)).map((item) => item.name)).toEqual(["My classroom"]);
});

it("limits membership reads to the owner and each student, without expanding progress access", async () => {
  await seed();
  await join(client(studentId));
  const member = (database: Firestore) => doc(database, "classrooms", "classroom", "members", studentId);
  await assertSucceeds(getDoc(member(client(studentId))));
  await assertSucceeds(getDoc(member(client(teacherId))));
  await assertSucceeds(getDocs(collection(client(teacherId), "classrooms", "classroom", "members")));
  await assertFails(getDoc(member(client("outsider"))));
  await assertFails(getDocs(collection(client(studentId), "classrooms", "classroom", "members")));
  await assertFails(getDoc(doc(client(teacherId), "users", studentId, "classrooms", "classroom")));
  await assertFails(getDoc(doc(client(teacherId), "users", studentId, "progress", "module")));
  await assertSucceeds(getDoc(doc(client(studentId), "users", studentId, "progress", "module")));
});

it("denies classroom edits/deletes, code mutation, index mutation, and membership mutation", async () => {
  await seed();
  await join(client(studentId));
  const teacher = client(teacherId);
  const student = client(studentId);
  await assertFails(updateDoc(doc(teacher, "classrooms", "classroom"), { name: "Renamed" }));
  await assertFails(deleteDoc(doc(teacher, "classrooms", "classroom")));
  await assertFails(updateDoc(doc(teacher, "classroomJoinCodes", "ABC234"), { isArchived: true }));
  await assertFails(deleteDoc(doc(teacher, "classroomJoinCodes", "ABC234")));
  await assertFails(updateDoc(doc(teacher, "users", teacherId, "classrooms", "classroom"), { classroomName: "Renamed" }));
  await assertFails(deleteDoc(doc(student, "users", studentId, "classrooms", "classroom")));
  await assertFails(updateDoc(doc(student, "classrooms", "classroom", "members", studentId), { status: "inactive" }));
  await assertFails(deleteDoc(doc(teacher, "classrooms", "classroom", "members", studentId)));
  await assertFails(setDoc(doc(teacher, "classrooms", "classroom", "polls", "poll"), { question: "Future" }));
});
