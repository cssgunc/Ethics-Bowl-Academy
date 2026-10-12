import JSZip from 'jszip';
import { createModuleDownload } from '../module-download';
import { serializeModule } from '../module-markdown';
import type { ExportModule } from '../module-markdown';

const exportModule: ExportModule = {
  id: 'mod_one', title: 'Ethics', description: 'Ethics module', tags: [], isPublic: true,
  createdBy: 'author', createdAt: new Date('2026-09-28'), updatedAt: new Date('2026-09-28'), stepCount: 0, steps: [],
};

describe('module download packaging', () => {
  it('downloads one module as a Markdown file', async () => {
    const download = await createModuleDownload([exportModule]);
    expect(download.filename).toBe('ethics--mod_one.md');
    expect(download.blob.type).toBe('text/markdown;charset=utf-8');
    expect(await download.blob.text()).toBe(serializeModule(exportModule));
  });

  it('creates a valid ZIP containing separate files even when titles match', async () => {
    const other = { ...exportModule, id: 'mod_two', isPublic: false };
    const download = await createModuleDownload([exportModule, other]);
    expect(download.filename).toMatch(/^modules-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(download.blob.type).toBe('application/zip');
    const zip = await JSZip.loadAsync(await download.blob.arrayBuffer(), { checkCRC32: true });
    expect(Object.keys(zip.files)).toEqual(['ethics--mod_one.md', 'ethics--mod_two.md']);
    expect(await zip.file('ethics--mod_one.md')!.async('string')).toBe(serializeModule(exportModule));
    expect(await zip.file('ethics--mod_two.md')!.async('string')).toContain('isPublic: false');
  });

  it('rejects empty selections and filename collisions', async () => {
    await expect(createModuleDownload([])).rejects.toThrow('Select at least one');
    await expect(createModuleDownload([exportModule, exportModule])).rejects.toThrow('duplicate export filenames');
  });

  it('rejects an invalid timestamp before producing an archive', async () => {
    await expect(createModuleDownload([exportModule, { ...exportModule, id: 'bad', updatedAt: new Date('invalid') }])).rejects.toThrow();
  });
});
