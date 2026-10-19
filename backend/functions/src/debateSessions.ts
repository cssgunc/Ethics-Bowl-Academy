import * as admin from "firebase-admin";

export interface DebateMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DebateSession {
  userId: string;
  moduleId: string;
  stepId: string;
  messages: DebateMessage[];
  studentTurnCount: number;
  status: "active" | "complete";
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Creates a session after the caller authenticates and checks module access.
 * Pass the verified auth UID, never a userId supplied by the client.
 * @param {string} userId Verified caller UID.
 * @param {string} moduleId Parent module ID.
 * @param {string} stepId Debate step ID.
 * @param {string} openingMessage Backend-generated opening message.
 */
export async function createDebateSession(
  userId: string,
  moduleId: string,
  stepId: string,
  openingMessage: string,
): Promise<string> {
  const sessionRef = admin.firestore()
    .collection("users").doc(userId).collection("debateSessions").doc();

  const session: admin.firestore.WithFieldValue<DebateSession> = {
    userId,
    moduleId,
    stepId,
    messages: [{role: "assistant", content: openingMessage}],
    studentTurnCount: 0,
    status: "active",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await sessionRef.set(session);

  return sessionRef.id;
}

/**
 * Saves a backend-generated conversation after authentication/access checks.
 * @param {string} userId Verified caller UID.
 * @param {string} sessionId Existing session ID.
 * @param {DebateMessage[]} messages Backend-generated conversation.
 * @param {string} status Current session status.
 */
export async function updateDebateSession(
  userId: string,
  sessionId: string,
  messages: DebateMessage[],
  status: DebateSession["status"],
): Promise<void> {
  const sessionRef = admin.firestore()
    .collection("users").doc(userId)
    .collection("debateSessions").doc(sessionId);

  const updates: admin.firestore.UpdateData<DebateSession> = {
    messages,
    studentTurnCount: messages.filter(
      (message) => message.role === "user",
    ).length,
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await sessionRef.update(updates);
}
