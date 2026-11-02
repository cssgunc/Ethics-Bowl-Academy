/** @jest-environment jsdom */

jest.mock('@/lib/module-export-data', () => ({ getExportModules: jest.fn(), getModuleForExport: jest.fn() }));
jest.mock('@/lib/module-download', () => ({ createModuleDownload: jest.fn(), downloadBlob: jest.fn() }));

import { createElement } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExportModulesModal from '../ExportModulesModal';
import { getExportModules, getModuleForExport } from '@/lib/module-export-data';
import { createModuleDownload, downloadBlob } from '@/lib/module-download';

const publicModule = { id: 'public', title: 'Public Ethics', description: 'Public description', isPublic: true };
const privateModule = { id: 'private', title: 'Private Ethics', description: 'Private description', isPublic: false };

async function openModal(onClose = jest.fn()) {
  const view = render(createElement(ExportModulesModal, { onClose }));
  await screen.findByText('Public Ethics');
  return { ...view, onClose };
}

describe('Export modules modal', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (getExportModules as jest.Mock).mockResolvedValue([publicModule, privateModule]);
    (getModuleForExport as jest.Mock).mockImplementation(async (id: string) => ({ id, steps: [] }));
    (createModuleDownload as jest.Mock).mockResolvedValue({ filename: 'export.md', blob: new Blob(['markdown']) });
  });

  it('shows public and private modules with none selected and Export disabled', async () => {
    await openModal();
    expect(screen.getByText('Private Ethics')).toBeTruthy();
    expect(screen.getByText('0 of 2 selected')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Export' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('checkbox').every((checkbox) => !(checkbox as HTMLInputElement).checked)).toBe(true);
  });

  it('selects all and clears all, with an indeterminate state for partial selection', async () => {
    await openModal();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(screen.getByText('2 of 2 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select none' }));
    expect(screen.getByText('0 of 2 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Private Ethics/ }));
    expect(screen.getByText('1 of 2 selected')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Select all' }).getAttribute('data-indeterminate')).toBe('true');
  });

  it('loads only the selected saved module and triggers its download', async () => {
    const { onClose } = await openModal();
    fireEvent.click(screen.getByRole('checkbox', { name: /Private Ethics/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Export (1)' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(getModuleForExport).toHaveBeenCalledTimes(1);
    expect(getModuleForExport).toHaveBeenCalledWith('private');
    expect(createModuleDownload).toHaveBeenCalledWith([{ id: 'private', steps: [] }]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('passes every selected module to the ZIP packaging function', async () => {
    await openModal();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export (2)' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(createModuleDownload).toHaveBeenCalledWith([{ id: 'public', steps: [] }, { id: 'private', steps: [] }]);
  });

  it('keeps the modal open and produces no download when a selected module cannot be read', async () => {
    (getModuleForExport as jest.Mock).mockRejectedValue(new Error('Permission denied'));
    const { onClose } = await openModal();
    fireEvent.click(screen.getByRole('checkbox', { name: /Private Ethics/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Export (1)' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Could not read "Private Ethics". Permission denied');
    expect(createModuleDownload).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Export (1)' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows a packaging failure and preserves the selection for retry', async () => {
    (createModuleDownload as jest.Mock).mockRejectedValue(new Error('Invalid timestamp'));
    await openModal();
    fireEvent.click(screen.getByRole('checkbox', { name: /Public Ethics/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Export (1)' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Invalid timestamp');
    expect(screen.getByText('1 of 2 selected')).toBeTruthy();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('retries failed module listing', async () => {
    (getExportModules as jest.Mock).mockRejectedValueOnce(new Error('Network unavailable'));
    render(createElement(ExportModulesModal, { onClose: jest.fn() }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Could not load modules. Network unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading modules' }));
    await screen.findByText('Public Ethics');
    expect(getExportModules).toHaveBeenCalledTimes(2);
  });

  it('disables closing and selection while preparing the export and does not download after unmount', async () => {
    let finishRead!: (value: { id: string; steps: never[] }) => void;
    (getModuleForExport as jest.Mock).mockImplementation(() => new Promise((resolve) => { finishRead = resolve; }));
    const { unmount } = await openModal();
    fireEvent.click(screen.getByRole('checkbox', { name: /Public Ethics/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Export (1)' }));
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('checkbox').every((checkbox) => (checkbox as HTMLInputElement).disabled)).toBe(true);
    unmount();
    await act(async () => finishRead({ id: 'public', steps: [] }));
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('starts with none selected when reopened and allows cancellation', async () => {
    const { unmount } = await openModal();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }));
    unmount();
    const { onClose } = await openModal();
    expect(screen.getByText('0 of 2 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
