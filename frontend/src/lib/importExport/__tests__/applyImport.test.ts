jest.mock('uuid', () => ({ v4: jest.fn() }));
jest.mock('@/lib/firebase/firebaseConfig', () => ({ db: {}, auth: { currentUser: { uid: 'owner' } } }));
jest.mock('@/lib/firebase/db-operations', () => ({ createModule: jest.fn(), deleteStep: jest.fn() }));
jest.mock('@/lib/firebase/uploadStepImage', () => ({ uploadStepImage: jest.fn() }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn(), serverTimestamp: jest.fn(), writeBatch: jest.fn() }));
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { v4 as uuid } from 'uuid';
import { createModule, deleteStep } from '@/lib/firebase/db-operations';
import { uploadStepImage } from '@/lib/firebase/uploadStepImage';
import { applyImport } from '../applyImport';
import { parseModule } from '../parse';
import { planImport } from '../planImport';
import type { ImportPlan, ParsedModule, ParsedStep } from '../types';
import type { Module, Step } from '@/lib/firebase/types';

const batch = { set: jest.fn(), update: jest.fn(), commit: jest.fn() };
let counter = 0;
const parsedModule = (steps: ParsedStep[], extra: Partial<ParsedModule> = {}): ParsedModule => ({ title: 'Module', description: '', tags: [], isPublic: true, steps, imageFilenames: [], ...extra });
const newPlan = (parsed: ParsedModule): ImportPlan => ({ isNewModule: true, isStale: false, creates: parsed.steps, updates: [], deletes: [], removedPollOptions: [], errors: [] });
const baseStep = { id: 'old', moduleId: 'module1', title: 'Old', order: 0, isOptional: false, createdBy: 'owner', createdAt: new Date(0), updatedAt: new Date(0) };

beforeEach(() => {
  jest.resetAllMocks(); counter = 0;
  jest.mocked(uuid).mockImplementation(() => `uuid-${++counter}` as never);
  jest.mocked(collection).mockImplementation((...parts: unknown[]) => parts.slice(1).join('/') as never);
  jest.mocked(doc).mockImplementation((...parts: unknown[]) => ({ id: typeof parts[0] === 'string' ? parts[1] ?? `auto-${++counter}` : parts.at(-1), path: parts.join('/') }) as never);
  jest.mocked(serverTimestamp).mockReturnValue('timestamp' as never);
  jest.mocked(writeBatch).mockReturnValue(batch as never);
  batch.commit.mockResolvedValue(undefined);
  jest.mocked(createModule).mockResolvedValue({ id: 'new-module' } as Module);
  jest.mocked(uploadStepImage).mockResolvedValue({ url: 'https://example.com/image.png', contentType: 'image/png' });
});

it('creates a new module and batches steps with required defaults and file order', async () => {
  const steps: ParsedStep[] = [
    { type: 'flashcards', title: 'Cards', line: 10, data: { cards: [{ front: 'A', back: 'B' }] } },
    { type: 'debate', title: 'Debate', line: 20, data: { modulePrompt: 'Context', startQuestion: 'Why?', maxStudentTurns: 5 } },
  ];
  const parsed = parsedModule(steps);
  expect(await applyImport(newPlan(parsed), parsed, [], 'owner')).toEqual({ moduleId: 'new-module' });
  expect(createModule).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 'owner', title: 'Module' }));
  expect(batch.set.mock.calls[0][1]).toMatchObject({ moduleId: 'new-module', createdBy: 'owner', createdAt: 'timestamp', isOptional: false, studyMode: 'random', order: 0 });
  expect(batch.set.mock.calls[1][1]).toMatchObject({ type: 'debate', order: 1, maxStudentTurns: 5 });
  expect(collection).toHaveBeenCalledWith(expect.anything(), 'modules', 'new-module', 'debates');
  expect(batch.commit).toHaveBeenCalledTimes(1);
  expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ stepCount: 2 }));
});

it('updates with batch.update, retains poll votes and immutable fields, and deletes after commit', async () => {
  const live = { ...baseStep, type: 'poll', question: 'Why?', allowMultipleChoice: false, options: [{ id: 'keep', text: 'Yes', votes: 9 }, { id: 'remove', text: 'No', votes: 3 }] } as Step;
  const step: ParsedStep = { id: 'old', type: 'poll', title: 'Poll', line: 10, data: { question: 'Why?', allowMultipleChoice: false, options: [{ id: 'keep', text: 'Yes edited' }, { text: 'New' }], createdBy: 'bad', createdAt: 'bad' } };
  const deleted = { ...baseStep, id: 'deleted', type: 'video' } as Step;
  const parsed = parsedModule([step], { id: 'module1' });
  const plan: ImportPlan = { ...newPlan(parsed), isNewModule: false, creates: [], updates: [{ parsed: step, live }], deletes: [deleted] };
  await applyImport(plan, parsed, [], 'owner');
  expect(createModule).not.toHaveBeenCalled();
  expect(batch.set).not.toHaveBeenCalled();
  const payload = batch.update.mock.calls[0][1];
  expect(payload.options).toEqual([{ id: 'keep', text: 'Yes edited', votes: 9 }, { id: expect.any(String), text: 'New', votes: 0 }]);
  expect(payload).not.toHaveProperty('createdAt'); expect(payload).not.toHaveProperty('createdBy');
  expect(batch.update.mock.calls[1][1].stepCount).toBe(2); // deleteStep decrements to the final count of 1
  expect(deleteStep).toHaveBeenCalledWith('module1', 'deleted', 'video');
  expect(batch.commit.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(deleteStep).mock.invocationCallOrder[0]);
});

it('resolves sorting assignments after generating nested IDs and does not mutate parsed data', async () => {
  const step: ParsedStep = { type: 'sorting', title: 'Sort', line: 10, data: { prompt: 'Sort these', buckets: [{ label: 'A' }, { label: 'B' }], cards: [{ text: 'Assigned' }, { text: 'Unsorted' }], sortingAssignments: [{ cardIndex: 0, bucketIndex: 1 }] } };
  const parsed = parsedModule([step]);
  await applyImport(newPlan(parsed), parsed, [], 'owner');
  const payload = batch.set.mock.calls[0][1];
  expect(payload.answerKey).toEqual({ [payload.cards[0].id]: payload.buckets[1].id });
  expect(payload).not.toHaveProperty('sortingAssignments');
  expect(step.data.cards).toEqual([{ text: 'Assigned' }, { text: 'Unsorted' }]);
});

it('uploads local images with collection names and replaces only complete image sources', async () => {
  const step: ParsedStep = { type: 'freeResponse', title: 'Image', line: 10, data: { prompt: '<img src="photo.png" alt="photo.png" /> photo.png' } };
  const parsed = parsedModule([step], { imageFilenames: ['photo.png'] });
  const image = { name: 'photo.png', type: 'image/png', size: 10 } as File;
  await applyImport(newPlan(parsed), parsed, [image], 'owner');
  expect(uploadStepImage).toHaveBeenCalledWith(image, 'new-module', 'freeResponses', 'owner', expect.any(String));
  expect(batch.set.mock.calls[0][1].prompt).toBe('<img src="https://example.com/image.png" alt="photo.png" /> photo.png');
  expect(step.data.prompt).toContain('src="photo.png"');
});

it('builds additional resources in the existing editor shape', async () => {
  const parsed = parsedModule([{ type: 'additionalResources', title: 'Read', line: 10, data: { resources: { all: [{ name: 'Website', url: 'https://example.com', type: 'link' }, { name: 'PDF', url: 'https://example.com/a.pdf', type: 'pdf' }] } } }]);
  await applyImport(newPlan(parsed), parsed, [], 'owner');
  expect(batch.set.mock.calls[0][1].resources).toEqual({ link: 'https://example.com', pdf: 'https://example.com/a.pdf', all: [expect.objectContaining({ id: expect.any(String), type: 'link' }), expect.objectContaining({ id: expect.any(String), type: 'pdf' })] });
});

it('uploads a local image referenced only in a step title', async () => {
  const result = parseModule('---\ntitle: Ethics\ndescription: Learn\ntags: []\nisPublic: true\n---\n\n<!-- step type="freeResponse" -->\n## Reflect ![Diagram](photo.png)\n\nWhat do you think?\n');
  expect(result.errors).toEqual([]);
  const parsed = result.module!;
  const image = { name: 'photo.png', type: 'image/png', size: 10 } as File;
  await applyImport(planImport(parsed, null, []), parsed, [image], 'owner');
  expect(uploadStepImage).toHaveBeenCalledWith(image, 'new-module', 'freeResponses', 'owner', expect.any(String));
  expect(batch.set.mock.calls[0][1].title).toBe('Reflect <img src="https://example.com/image.png" alt="Diagram" />');
});

it('does no writes for invalid plans, missing images or wrong authentication', async () => {
  const parsed = parsedModule([]);
  await expect(applyImport({ ...newPlan(parsed), errors: [{ line: 1, message: 'Error' }] }, parsed, [], 'owner')).rejects.toThrow('Resolve');
  await expect(applyImport(newPlan(parsed), { ...parsed, imageFilenames: ['missing.png'] }, [], 'owner')).rejects.toThrow('Missing image');
  await expect(applyImport(newPlan(parsed), parsed, [], 'other-user')).rejects.toThrow('Sign in');
  expect(createModule).not.toHaveBeenCalled(); expect(writeBatch).not.toHaveBeenCalled();
});

it('propagates a failed batch without starting deletions', async () => {
  const parsed = parsedModule([]);
  batch.commit.mockRejectedValue(new Error('offline'));
  await expect(applyImport(newPlan(parsed), parsed, [], 'owner')).rejects.toThrow('offline');
  expect(deleteStep).not.toHaveBeenCalled();
});

it('runs real markdown through parser, planner and apply', async () => {
  const result = parseModule('---\ntitle: Ethics\ndescription: Learn\ntags: []\nisPublic: true\n---\n\n<!-- step type="debate" -->\n## Discuss\nmaxStudentTurns: 5\n\n### Context\nConsider fairness.\n\n### Starting question\nWhat is fair?\n');
  expect(result.errors).toEqual([]);
  const parsed = result.module!;
  const plan = planImport(parsed, null, []);
  expect(plan.errors).toEqual([]);
  await applyImport(plan, parsed, [], 'owner');
  expect(batch.set.mock.calls[0][1]).toMatchObject({ type: 'debate', modulePrompt: 'Consider fairness.', startQuestion: 'What is fair?', maxStudentTurns: 5 });
});

it('replaces images in module metadata even when the module has no steps', async () => {
  const parsed = parsedModule([], { description: '<img src="cover.png" alt="Cover" />', imageFilenames: ['cover.png'] });
  const image = { name: 'cover.png', type: 'image/png', size: 10 } as File;
  await applyImport(newPlan(parsed), parsed, [image], 'owner');
  expect(uploadStepImage).toHaveBeenCalledWith(image, 'new-module', 'freeResponses', 'owner');
  expect(batch.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ description: '<img src="https://example.com/image.png" alt="Cover" />' }));
});
