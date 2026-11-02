/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImportModuleModal from '../ImportModuleModal';
import { parseModule } from '@/lib/importExport/parse';
import { planImport } from '@/lib/importExport/planImport';
import { applyImport } from '@/lib/importExport/applyImport';
import { getModuleById, getStepsByModuleId } from '@/lib/firebase/db-operations';
import type { ImportPlan, ParsedModule } from '@/lib/importExport/types';
import { toast } from 'sonner';

const mockShowAlert = jest.fn();
const mockAuth = jest.fn();
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/context/AlertContext', () => ({ useAlert: () => ({ showAlert: mockShowAlert }) }));
jest.mock('@/lib/importExport/parse');
jest.mock('@/lib/importExport/planImport');
jest.mock('@/lib/importExport/applyImport', () => ({ applyImport: jest.fn() }));
jest.mock('@/lib/firebase/db-operations', () => ({ getModuleById: jest.fn(), getStepsByModuleId: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));

const parsed: ParsedModule = { title: 'Ethics', description: 'A module', tags: ['ethics'], isPublic: true, steps: [], imageFilenames: [] };
const plan: ImportPlan = { isNewModule: true, isStale: false, creates: [], updates: [], deletes: [], removedPollOptions: [], errors: [] };
const live = { id: 'module1', title: 'Old title', description: '', tags: [], isPublic: false };
const onImported = jest.fn();
const onClose = jest.fn();
function file(name = 'module.md', type = 'text/markdown') {
  const value = new File(['markdown'], name, { type });
  Object.defineProperty(value, 'text', { value: jest.fn().mockResolvedValue('markdown') });
  return value;
}
function upload(files = [file()]) {
  fireEvent.change(screen.getByLabelText('Markdown file and images'), { target: { files } });
}
async function preview(moduleId?: string) {
  render(React.createElement(ImportModuleModal, { moduleId, onClose, onImported }));
  upload();
  fireEvent.click(screen.getByText('Preview Import'));
  await screen.findByRole('region', { name: 'Import preview' });
}

beforeEach(() => {
  jest.resetAllMocks();
  mockAuth.mockReturnValue([{ uid: 'user1' }, false]);
  mockShowAlert.mockResolvedValue(undefined);
  jest.mocked(parseModule).mockReturnValue({ module: parsed, errors: [] });
  jest.mocked(planImport).mockReturnValue(plan);
  jest.mocked(applyImport).mockResolvedValue({ moduleId: 'imported1' });
  jest.mocked(getModuleById).mockResolvedValue(live as never);
  jest.mocked(getStepsByModuleId).mockResolvedValue([]);
});
afterEach(cleanup);

it.each([{ files: [] as File[] }, { files: [file('a.md'), file('b.md')] }])('requires exactly one markdown file', async ({ files }) => {
  render(React.createElement(ImportModuleModal, { onClose, onImported }));
  upload(files.length ? files : [file('image.png', 'image/png')]);
  fireEvent.click(screen.getByText('Preview Import'));
  expect(await screen.findByText('Upload exactly one .md file.')).toBeInTheDocument();
  expect(parseModule).not.toHaveBeenCalled();
});

it('lists every parser error with its source line and stops', async () => {
  jest.mocked(parseModule).mockReturnValue({ module: null, errors: [{ line: 12, message: 'Invalid poll' }, { line: 30, message: 'Missing title' }] });
  render(React.createElement(ImportModuleModal, { onClose, onImported }));
  upload(); fireEvent.click(screen.getByText('Preview Import'));
  expect(await screen.findByText('Line 12: Invalid poll')).toBeInTheDocument();
  expect(screen.getByText('Line 30: Missing title')).toBeInTheDocument();
  expect(planImport).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
});

it('names missing images before reading live data', async () => {
  jest.mocked(parseModule).mockReturnValue({ module: { ...parsed, imageFilenames: ['diagram.png'] }, errors: [] });
  render(React.createElement(ImportModuleModal, { onClose, onImported }));
  upload(); fireEvent.click(screen.getByText('Preview Import'));
  expect(await screen.findByText(/Missing image: diagram.png/)).toBeInTheDocument();
  expect(planImport).not.toHaveBeenCalled();
});

it('rejects duplicate image names and unsupported image types', async () => {
  render(React.createElement(ImportModuleModal, { onClose, onImported }));
  upload([file(), file('x.svg', 'image/svg+xml'), file('x.svg', 'image/svg+xml')]);
  fireEvent.click(screen.getByText('Preview Import'));
  expect(await screen.findByText(/Duplicate image filename/)).toBeInTheDocument();
  expect(screen.getAllByText(/Unsupported image/)).toHaveLength(2);
  expect(parseModule).not.toHaveBeenCalled();
});

it('previews new imports without fetching and only applies after confirmation', async () => {
  await preview();
  expect(planImport).toHaveBeenCalledWith(parsed, null, []);
  expect(getModuleById).not.toHaveBeenCalled();
  expect(getStepsByModuleId).not.toHaveBeenCalled();
  expect(applyImport).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  await waitFor(() => expect(onImported).toHaveBeenCalledWith('imported1'));
  expect(applyImport).toHaveBeenCalledWith(plan, parsed, [], 'user1');
  expect(toast.success).toHaveBeenCalled();
});

it('loads existing modules and shows all step changes and destructive warnings', async () => {
  const existing = { ...parsed, id: 'module1' };
  const destructive = { ...plan, isNewModule: false, isStale: true,
    creates: [{ title: 'New step' }], updates: [{ parsed: { title: 'Updated step' } }], deletes: [{ title: 'Deleted step' }],
    removedPollOptions: [{ stepTitle: 'Poll', optionText: 'No', votes: 7 }] } as ImportPlan;
  jest.mocked(parseModule).mockReturnValue({ module: existing, errors: [] });
  jest.mocked(planImport).mockReturnValue(destructive);
  await preview('module1');
  expect(getModuleById).toHaveBeenCalledWith('module1');
  expect(getStepsByModuleId).toHaveBeenCalledWith('module1');
  expect(planImport).toHaveBeenCalledWith(existing, live, []);
  for (const title of ['New step', 'Updated step', 'Deleted step']) expect(screen.getByText(title)).toBeInTheDocument();
  expect(screen.getByText(/This module was changed after this file was exported/)).toBeInTheDocument();
  expect(screen.getByText(/These steps will be deleted, along with student progress/)).toBeInTheDocument();
  expect(screen.getByText('Poll: No (7 votes)')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import' })).toHaveClass('bg-red-600');
  expect(screen.getByText('Old title')).toBeInTheDocument();
});

it('uses a red confirmation for poll option deletion alone', async () => {
  jest.mocked(planImport).mockReturnValue({ ...plan, removedPollOptions: [{ stepTitle: 'Poll', optionText: 'Yes', votes: 1 }] });
  await preview();
  expect(screen.getByRole('button', { name: 'Import' })).toHaveClass('bg-red-600');
});

it('blocks planner errors even when the plan contains changes', async () => {
  jest.mocked(planImport).mockReturnValue({ ...plan, errors: [{ line: 20, message: 'Unknown step ID' }] });
  render(React.createElement(ImportModuleModal, { onClose, onImported }));
  upload(); fireEvent.click(screen.getByText('Preview Import'));
  expect(await screen.findByText('Line 20: Unknown step ID')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Import preview' })).not.toBeInTheDocument();
});

it('does not allow an existing-module import to target another module or create a new one', async () => {
  render(React.createElement(ImportModuleModal, { moduleId: 'module1', onClose, onImported }));
  upload(); fireEvent.click(screen.getByText('Preview Import'));
  expect(await screen.findByText(/The file must contain the ID of this module/)).toBeInTheDocument();
  expect(getModuleById).not.toHaveBeenCalled();
});

it('disables every input and close action during apply and prevents duplicate confirmation', async () => {
  let finish!: (value: { moduleId: string }) => void;
  jest.mocked(applyImport).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  await preview();
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  expect(screen.getByLabelText('Markdown file and images')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(screen.getByLabelText('Close import dialog')).toBeDisabled();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Importing…' }));
  expect(onClose).not.toHaveBeenCalled();
  expect(applyImport).toHaveBeenCalledTimes(1);
  await act(async () => finish({ moduleId: 'done' }));
  expect(onImported).toHaveBeenCalledWith('done');
});

it('reports apply failures through AlertContext and requires a fresh preview', async () => {
  jest.mocked(applyImport).mockRejectedValue(new Error('permission denied'));
  await preview();
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  await waitFor(() => expect(mockShowAlert).toHaveBeenCalledWith('Import failed', expect.any(String), 'error'));
  expect(onImported).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Preview Import' })).toBeEnabled();
});

it('reports live-fetch failures and unlocks the upload', async () => {
  jest.mocked(parseModule).mockReturnValue({ module: { ...parsed, id: 'module1' }, errors: [] });
  jest.mocked(getModuleById).mockRejectedValue(new Error('offline'));
  render(React.createElement(ImportModuleModal, { moduleId: 'module1', onClose, onImported }));
  upload(); fireEvent.click(screen.getByText('Preview Import'));
  await waitFor(() => expect(mockShowAlert).toHaveBeenCalledWith('Import preview failed', expect.any(String), 'error'));
  expect(screen.getByLabelText('Markdown file and images')).toBeEnabled();
});

it('invalidates an old preview when the file selection changes', async () => {
  await preview();
  upload([file('replacement.md')]);
  expect(screen.queryByRole('region', { name: 'Import preview' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
});

it('passes uploaded referenced images to apply, excluding unrelated files', async () => {
  const image = file('photo.png', 'image/png');
  jest.mocked(parseModule).mockReturnValue({ module: { ...parsed, imageFilenames: ['photo.png'] }, errors: [] });
  render(React.createElement(ImportModuleModal, { onClose, onImported }));
  upload([file(), image, file('other.gif', 'image/gif')]);
  fireEvent.click(screen.getByText('Preview Import'));
  fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
  await waitFor(() => expect(applyImport).toHaveBeenCalledWith(plan, expect.anything(), [image], 'user1'));
});

it('requires authentication before applying', async () => {
  await preview();
  mockAuth.mockReturnValue([null, false]);
  // Trigger a render after the authentication state changes.
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
  cleanup();
  await preview();
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  expect(mockShowAlert).toHaveBeenCalledWith('Sign in required', expect.any(String), 'error');
  expect(applyImport).not.toHaveBeenCalled();
});
