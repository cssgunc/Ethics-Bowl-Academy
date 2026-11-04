/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModuleEditor from '../ModuleEditor';
import ModulesPage from '../ModulesPage';
import { useModuleStore } from '@/store/moduleStore';
import type { ModuleWithSteps } from '@/store/moduleStore';

const mockAuth = jest.fn();
const mockImport = jest.fn();
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => mockAuth() }));
jest.mock('@/context/AlertContext', () => ({ useAlert: () => ({ showAlert: jest.fn(), showConfirm: jest.fn() }) }));
jest.mock('@/lib/firebase/firebaseConfig', () => ({ db: {} }));
jest.mock('@/lib/firebase/db-operations');
jest.mock('../AddStepModal', () => () => null);
jest.mock('../StepEditorModal', () => () => null);
jest.mock('../ImportModuleModal', () => ({ __esModule: true, default: (props: unknown) => { mockImport(props); return React.createElement('div', {}, 'Import dialog stub'); } }));
const existingModule: ModuleWithSteps = {
  id: 'module1', title: 'Ethics', description: 'Module', order: 1, createdBy: 'owner',
  isPublic: true, tags: [], stepCount: 0, steps: [], createdAt: new Date(0), updatedAt: new Date(0),
};
const fetchModules = jest.fn();
beforeEach(() => {
  jest.clearAllMocks(); mockAuth.mockReturnValue([{ uid: 'owner' }, false]);
  useModuleStore.setState({ modules: [existingModule], selectedModule: existingModule, isLoading: false, error: null, fetchModules, setUserId: jest.fn() });
});
afterEach(cleanup);

it('opens existing-module import from the clean editor footer', () => {
  render(React.createElement(ModuleEditor, { moduleId: 'module1', onClose: jest.fn() }));
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  expect(mockImport).toHaveBeenLastCalledWith(expect.objectContaining({ moduleId: 'module1' }));
});

it('disables import with the required tooltip while the editor has unsaved changes', async () => {
  render(React.createElement(ModuleEditor, { moduleId: 'module1', onClose: jest.fn() }));
  fireEvent.change(screen.getByPlaceholderText('Enter module title'), { target: { value: 'Unsaved title' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled());
  expect(screen.getByTitle('Save your changes before importing.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  expect(mockImport).not.toHaveBeenCalled();
});

it('does not offer update import in an unsaved new-module editor', () => {
  render(React.createElement(ModuleEditor, { moduleId: null, onClose: jest.fn() }));
  expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
});

it('offers new-module import beside creation for authenticated users', () => {
  render(React.createElement(ModulesPage));
  const create = screen.getByRole('button', { name: 'Create New Module' });
  const importButton = screen.getByRole('button', { name: 'Import Module' });
  expect(importButton.parentElement).toBe(create.parentElement);
  expect(screen.getByRole('button', { name: 'Export Modules' }).parentElement).toBe(create.parentElement);
  fireEvent.click(importButton);
  expect(mockImport).toHaveBeenLastCalledWith(expect.not.objectContaining({ moduleId: expect.anything() }));
});

it('hides both entry points from unauthenticated users', () => {
  mockAuth.mockReturnValue([null, false]);
  render(React.createElement(ModulesPage));
  expect(screen.queryByRole('button', { name: 'Create New Module' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Import Module' })).not.toBeInTheDocument();
});

it('refreshes modules and closes the existing editor on successful import', () => {
  const onClose = jest.fn();
  render(React.createElement(ModuleEditor, { moduleId: 'module1', onClose }));
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  const props = mockImport.mock.calls.at(-1)![0];
  // A completed import invalidates the editor's old draft.
  act(() => props.onImported('module1'));
  expect(fetchModules).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});
