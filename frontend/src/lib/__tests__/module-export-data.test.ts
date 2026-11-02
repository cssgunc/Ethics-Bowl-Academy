jest.mock('../firebase/firebaseConfig', () => ({ db: {} }));
jest.mock('../firebase/db-operations', () => ({ getModuleById: jest.fn() }));
jest.mock('firebase/firestore');

import { collection, getDocs, orderBy, where } from 'firebase/firestore';
import { getModuleById } from '../firebase/db-operations';
import { getExportModules, getModuleForExport } from '../module-export-data';
import { STEP_COLLECTIONS } from '../firebase/types';

describe('admin export reads', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (collection as jest.Mock).mockImplementation((...path: unknown[]) => path.slice(1).join('/'));
  });

  it('lists public and private modules without a public-only filter', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ docs: [
      { id: 'public', data: () => ({ title: 'Z Public', isPublic: true }) },
      { id: 'private', data: () => ({ title: 'A Private', isPublic: false }) },
    ] });
    const modules = await getExportModules();
    expect(getDocs).toHaveBeenCalledWith('modules');
    expect(where).not.toHaveBeenCalled();
    expect(orderBy).not.toHaveBeenCalled();
    expect(modules.map((module) => module.id)).toEqual(['private', 'public']);
  });

  it('reads every supported collection, includes legacy unordered steps, and preserves extra fields', async () => {
    (getModuleById as jest.Mock).mockResolvedValue({ id: 'mod_1', title: 'Module', isPublic: false });
    (getDocs as jest.Mock).mockImplementation(async (path: string) => ({ docs:
      path.endsWith('/additionalResources') ? [{ id: 'resource_1', data: () => ({ title: 'Read more', resources: { link: 'https://example.com' }, customField: true }) }]
        : path.endsWith('/videos') ? [{ id: 'video_1', data: () => ({ title: 'Watch', youtubeUrl: 'https://youtube.com' }) }] : [],
    }));
    const exportModule = await getModuleForExport('mod_1');
    expect(getDocs).toHaveBeenCalledTimes(Object.keys(STEP_COLLECTIONS).length);
    expect(orderBy).not.toHaveBeenCalled();
    expect(exportModule.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'resource_1', type: 'additionalResources', customField: true }),
      expect.objectContaining({ id: 'video_1', type: 'video' }),
    ]));
  });

  it('rejects failed step reads instead of returning incomplete content', async () => {
    (getModuleById as jest.Mock).mockResolvedValue({ id: 'mod_1' });
    (getDocs as jest.Mock).mockImplementation(async (path: string) => {
      if (path.endsWith('/polls')) throw new Error('Permission denied');
      return { docs: [] };
    });
    await expect(getModuleForExport('mod_1')).rejects.toThrow('Permission denied');
  });
});
