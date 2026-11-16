import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebaseConfig';

export interface DebateMessageRequest {
  moduleId: string;
  stepId: string;
  sessionId?: string;
  message: string;
}

export interface DebateMessageResponse {
  sessionId: string;
  reply: string;
  studentTurnCount: number;
  isComplete: boolean;
}

export async function sendDebateMessage(request: DebateMessageRequest): Promise<DebateMessageResponse> {
  if (!request.message.trim()) throw new Error('Enter a message.');
  if (request.message.length > 2000) throw new Error('Messages must be 2,000 characters or fewer.');
  if (!app) throw new Error('Debate service is unavailable. Please try again later.');
  const send = httpsCallable<DebateMessageRequest, DebateMessageResponse>(getFunctions(app), 'sendDebateMessage');
  const result = await send({ ...request, message: request.message.trim() });
  return result.data;
}
