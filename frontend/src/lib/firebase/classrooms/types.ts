import type { Timestamp } from "firebase/firestore";

export interface Classroom {
  id: string;
  name: string;
  teacherId: string;
  teacherDisplayName: string;
  joinCode: string;
  studentCount: number;
  isArchived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ClassroomJoinCode {
  classroomId: string;
  teacherId: string;
  isArchived: boolean;
  createdAt: Timestamp;
}

export interface ClassroomMember {
  userId: string;
  role: "student";
  displayName: string;
  email: string;
  joinedWithCode: string;
  joinedAt: Timestamp;
  status: "active";
}

export type UserClassroomMembership =
  | {
      classroomId: string;
      classroomName: string;
      role: "teacher";
      joinCode: string;
      createdAt: Timestamp;
    }
  | {
      classroomId: string;
      classroomName: string;
      role: "student";
      teacherId: string;
      joinedAt: Timestamp;
    };

export interface StudentClassroomMembership {
  classroomId: string;
  classroomName: string;
  role: "student";
  teacherId: string;
  joinedAt: Timestamp;
}
