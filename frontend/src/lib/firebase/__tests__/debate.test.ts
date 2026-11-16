import { sendDebateMessage } from '../debate';
import { httpsCallable } from 'firebase/functions';

jest.mock('../firebaseConfig', () => ({ app: {} }));
jest.mock('firebase/functions', () => ({ getFunctions: jest.fn(), httpsCallable: jest.fn() }));
const call = jest.fn();
beforeEach(() => { jest.clearAllMocks(); (httpsCallable as jest.Mock).mockReturnValue(call); });
const request = { moduleId: 'm', stepId: 's', message: 'An argument' };
test.each(['', '   ', 'x'.repeat(2001)])('rejects invalid messages before calling Firebase', async message => {
  await expect(sendDebateMessage({ ...request, message })).rejects.toThrow();
  expect(httpsCallable).not.toHaveBeenCalled();
});
test('calls the debate service with session identity and returns the complete response', async () => {
  const response = { sessionId: 'session', reply: 'Consider fairness.', studentTurnCount: 2, isComplete: false };
  call.mockResolvedValue({ data: response });
  expect(await sendDebateMessage({ ...request, sessionId: 'session' })).toEqual(response);
  expect(httpsCallable).toHaveBeenCalledWith(undefined, 'sendDebateMessage');
  expect(call).toHaveBeenCalledWith({ ...request, sessionId: 'session' });
});
test('propagates service failures for retry', async () => {
  call.mockRejectedValue(new Error('offline'));
  await expect(sendDebateMessage(request)).rejects.toThrow('offline');
});
