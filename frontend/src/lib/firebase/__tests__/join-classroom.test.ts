jest.mock("../firebaseConfig", () => ({
  db: {},
  auth: { currentUser: { uid: "student-1" } },
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn((_db, ...parts) => parts.join("/")),
  serverTimestamp: jest.fn(() => "SERVER_TIME"),
  increment: jest.fn((amount) => ({ increment: amount })),
  runTransaction: jest.fn(async (_db, callback) => callback(transaction)),
}));

import { runTransaction } from "firebase/firestore";
import { normalizeJoinCodeInput } from "../../../components/classrooms/JoinClassroomModal";
import { joinClassroom } from "../db-operations";

const docs: Record<string, any> = {};
const writes: Array<{ operation: string; ref: string; data?: any }> = [];
const transaction = {
  get: jest.fn(async (ref: string) => ({
    exists: () => Boolean(docs[ref]),
    data: () => docs[ref],
  })),
  set: jest.fn((ref: string, data: any) => writes.push({ operation: "set", ref, data })),
  update: jest.fn((ref: string, data: any) => writes.push({ operation: "update", ref, data })),
};

describe("classroom joining", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(docs).forEach((key) => delete docs[key]);
    writes.length = 0;
    transaction.get.mockImplementation(async (ref: string) => ({
      exists: () => Boolean(docs[ref]),
      data: () => docs[ref],
    }));
  });

  it("normalizes input and filters unsupported characters", () => {
    expect(normalizeJoinCodeInput(" ab-cd 12io!9 ")).toBe("ABCD29");
    expect(normalizeJoinCodeInput("abcdefg")).toBe("ABCDEF");
  });

  it("creates the membership once and leaves the count unchanged on a second join", async () => {
    docs["classroomJoinCodes/AB2345"] = { classroomId: "class-1" };
    docs["classrooms/class-1"] = {
      name: "Ethics Bowl",
      teacherId: "teacher-1",
      teacherDisplayName: "Ms. Rivera",
      isArchived: false,
      studentCount: 0,
    };

    const first = await joinClassroom("student-1", "Sam", "sam@example.com", "ab-2345");
    expect(first).toMatchObject({ classroomId: "class-1", classroomName: "Ethics Bowl", alreadyMember: false });
    expect(writes.filter((write) => write.ref === "classrooms/class-1/members/student-1")).toHaveLength(1);
    expect(writes.find((write) => write.ref === "classrooms/class-1")?.data.studentCount).toEqual({ increment: 1 });

    docs["classrooms/class-1/members/student-1"] = { status: "active" };
    writes.length = 0;
    const second = await joinClassroom("student-1", "Sam", "sam@example.com", "AB2345");
    expect(second.alreadyMember).toBe(true);
    expect(writes).toHaveLength(0);
    expect(runTransaction).toHaveBeenCalledTimes(2);
  });
});
