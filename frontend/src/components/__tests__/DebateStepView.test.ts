/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react';
import DebateStepView from '../DebateStepView';
import { sendDebateMessage } from '@/lib/firebase/debate';
import { DebateStep } from '@/lib/firebase/types';

jest.mock('@/lib/firebase/debate', () => ({ sendDebateMessage: jest.fn() }));
const step: DebateStep = { id: 'd', moduleId: 'm', type: 'debate', title: 'Discuss', modulePrompt: 'Context', startQuestion: 'Why?', maxStudentTurns: 8, order: 0, isOptional: false, createdBy: 'admin', createdAt: new Date(), updatedAt: new Date() };
const send = sendDebateMessage as jest.Mock;
afterEach(() => { cleanup(); jest.clearAllMocks(); });

async function submit(text = 'My argument') {
  fireEvent.change(screen.getByLabelText('Your message'), { target: { value: text } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })); });
}

test('rejects blank messages, sends sequential session turns, and unlocks after three', async () => {
  const ready = jest.fn();
  render(React.createElement(DebateStepView, { step, onReadyChange: ready }));
  expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
  for (let count = 1; count <= 3; count++) {
    send.mockResolvedValueOnce({ sessionId: 'session', reply: '<b>Think again</b>', studentTurnCount: count, isComplete: false });
    await submit();
    await screen.findByText(`Turn ${count} of 8`);
  }
  expect(send.mock.calls[1][0]).toMatchObject({ moduleId: 'm', stepId: 'd', sessionId: 'session' });
  expect(screen.getAllByText('<b>Think again</b>')).toHaveLength(3);
  expect(ready).toHaveBeenLastCalledWith(true);
});

test('disables send during requests and retries failed messages without duplicating history', async () => {
  send.mockRejectedValueOnce(new Error('offline'));
  render(React.createElement(DebateStepView, { step, onReadyChange: jest.fn() }));
  await submit();
  await screen.findByRole('alert');
  expect(within(screen.getByRole('log')).getAllByText('My argument')).toHaveLength(1);
  send.mockResolvedValueOnce({ sessionId: 'session', reply: 'Consider fairness', studentTurnCount: 1, isComplete: false });
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
  await screen.findByText('Turn 1 of 8');
  expect(within(screen.getByRole('log')).getAllByText('My argument')).toHaveLength(1);
});

test('requires confirmation to clear a session and relocks navigation', async () => {
  const ready = jest.fn();
  send.mockResolvedValue({ sessionId: 'old', reply: 'Done', studentTurnCount: 8, isComplete: true });
  render(React.createElement(DebateStepView, { step, onReadyChange: ready }));
  await submit();
  await screen.findByText('This debate is complete.');
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
  expect(screen.queryByText('Done')).not.toBeNull();
  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
  await waitFor(() => expect(ready).toHaveBeenLastCalledWith(false));
  expect(screen.queryByText('Done')).toBeNull();
  confirm.mockRestore();
});
