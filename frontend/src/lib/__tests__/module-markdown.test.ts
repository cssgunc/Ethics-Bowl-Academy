import { moduleFilename, serializeModule } from '../module-markdown';
import type { ExportModule } from '../module-markdown';
import type { Step, StepBase } from '../firebase/types';

const date = new Date('2026-09-28T14:00:00Z');
const base: Omit<StepBase, 'type'> = {
  id: 'st_1', moduleId: 'mod_abc123', title: 'Step title', order: 0,
  estimatedMinutes: 5, isOptional: false, createdBy: 'author', createdAt: date, updatedAt: date,
};
export function fixture(steps: Step[] = []): ExportModule {
  return {
    id: 'mod_abc123', title: 'The Trolley Problem', description: 'Introduction to ethics',
    tags: ['intro', 'consequentialism'], isPublic: false, updatedAt: date,
    createdAt: date, createdBy: 'author', stepCount: steps.length, steps,
  };
}

describe('module Markdown export', () => {
  it('exports front matter, private status, optional extra metadata and Firestore timestamps', () => {
    const exportModule = { ...fixture(), order: 12, thumbnailUrl: 'https://example.com/image.png' };
    const timestamp = { toDate: () => date };
    const markdown = serializeModule({ ...exportModule, updatedAt: timestamp as unknown as Date });
    expect(markdown).toContain('---\nid: "mod_abc123"\ntitle: "The Trolley Problem"');
    expect(markdown).toContain('tags: ["intro","consequentialism"]');
    expect(markdown).toContain('isPublic: false\nupdatedAt: "2026-09-28T14:00:00.000Z"');
    expect(markdown).toContain('thumbnailUrl: "https://example.com/image.png"');
    expect(markdown).toContain('createdBy: "author"');
    expect(markdown).not.toContain('order:');
  });

  it('safely quotes multiline metadata and YAML-like text', () => {
    const title = 'Title: "yes"\n---\n# Heading';
    const markdown = serializeModule({ ...fixture(), title, description: 'true', tags: ['a, b', '#tag'] });
    expect(markdown).toContain(`title: ${JSON.stringify(title)}\n`);
    expect(markdown).toContain('description: "true"');
    expect(markdown.match(/^---$/gm)).toHaveLength(2);
  });

  it('exports video settings directly after the title and preserves zero and false values', () => {
    const markdown = serializeModule(fixture([{ ...base, type: 'video', youtubeUrl: 'https://youtube.com/watch?v=test', durationSec: 0 }]));
    expect(markdown).toContain('<!-- step id="st_1" type="video" -->\n## Step title\nmoduleId:');
    expect(markdown).toContain('estimatedMinutes: 5');
    expect(markdown).toContain('isOptional: false');
    expect(markdown).toContain('durationSec: 0');
    expect(markdown).toContain('youtubeUrl: "https://youtube.com/watch?v=test"');
  });

  it('preserves quiz answers, multiline choices and feedback, images, and legacy explanations', () => {
    const markdown = serializeModule(fixture([{ ...base, type: 'quiz', passingScore: 70, shuffle: false,
      questions: [{ prompt: 'Which principle?\n![Diagram](https://example.com/image.png)', choices: ['Outcomes\nSecond line', 'Duties'], correctIndex: 0,
        choiceExplanations: ['Correct.\nMore detail.', 'Focuses on duties.'], explanation: 'Legacy explanation.' }],
    }]));
    expect(markdown).toContain('passingScore: 70');
    expect(markdown).toContain('shuffle: false');
    expect(markdown).toContain('### Which principle? <!-- question -->\n![Diagram](https://example.com/image.png)');
    expect(markdown).toContain('- [x] Outcomes\n  Second line\n  > Correct.\n  > More detail.');
    expect(markdown).toContain('- [ ] Duties\n  > Focuses on duties.');
    expect(markdown).toContain('### Explanation <!-- explanation -->\nLegacy explanation.');
  });

  it('exports poll question separately from its title, with option IDs and no vote counts', () => {
    const markdown = serializeModule(fixture([{ ...base, type: 'poll', question: 'Would you pull the lever?', allowMultipleChoice: false,
      options: [{ id: 'op_1', text: 'Yes', votes: 32 }, { id: 'op_2', text: 'No', votes: 17 }],
    }]));
    expect(markdown).toContain('allowMultipleChoice: false\n\nWould you pull the lever?\n\n- Yes <!-- option id="op_1" -->');
    expect(markdown).not.toContain('votes');
    expect(markdown).not.toContain('options:');
  });

  it('preserves extra nested fields without exporting votes', () => {
    const option = { id: 'op_1', text: 'Yes', votes: 32, color: 'blue' };
    const markdown = serializeModule(fixture([{ ...base, type: 'poll', question: '?', allowMultipleChoice: false, options: [option] }]));
    expect(markdown).toContain('"color":"blue"');
    expect(markdown).not.toContain('votes');
  });

  it('groups sorting cards by answer key and exports unassigned cards under Unsorted', () => {
    const markdown = serializeModule(fixture([{ ...base, type: 'sorting', prompt: 'Sort these arguments.',
      buckets: [{ id: 'bk_1', label: 'Consequentialist' }, { id: 'bk_2', label: 'Deontological' }],
      cards: [{ id: 'cd_1', text: 'Save five lives' }, { id: 'cd_2', text: 'Killing is wrong' }, { id: 'cd_3', text: 'Unassigned' }],
      answerKey: { cd_1: 'bk_1', cd_2: 'bk_2' },
    }]));
    expect(markdown).toContain('### Consequentialist <!-- bucket id="bk_1" -->\n- Save five lives <!-- card id="cd_1" -->');
    expect(markdown).toContain('### Deontological <!-- bucket id="bk_2" -->\n- Killing is wrong <!-- card id="cd_2" -->');
    expect(markdown).toContain('### Unsorted\n- Unassigned <!-- card id="cd_3" -->');
  });

  it('handles a missing sorting answer key', () => {
    const markdown = serializeModule(fixture([{ ...base, type: 'sorting', prompt: 'Sort.', buckets: [], cards: [{ id: 'cd_1', text: 'Card' }] }]));
    expect(markdown).toContain('### Unsorted\n- Card <!-- card id="cd_1" -->');
  });

  it('treats an empty bucket assignment as Unsorted', () => {
    const markdown = serializeModule(fixture([{ ...base, type: 'sorting', prompt: 'Sort.', buckets: [],
      cards: [{ id: 'cd_1', text: 'Card' }], answerKey: { cd_1: '' },
    }]));
    expect(markdown).toContain('### Unsorted\n- Card <!-- card id="cd_1" -->');
  });

  it('rejects quizzes without a valid integer answer index', () => {
    expect(() => serializeModule(fixture([{ ...base, type: 'quiz', shuffle: false, passingScore: 70,
      questions: [{ prompt: 'Question', choices: ['Yes', 'No'], correctIndex: NaN }],
    }]))).toThrow('invalid correct answer');
  });

  it('rejects a corrupt sorting answer key instead of silently losing it', () => {
    expect(() => serializeModule(fixture([{ ...base, type: 'sorting', prompt: 'Sort.', buckets: [],
      cards: [{ id: 'cd_1', text: 'Card' }], answerKey: { cd_1: 'missing' },
    }]))).toThrow('missing card or bucket');
  });

  it('preserves flashcards, study mode, and embedded Markdown', () => {
    const markdown = serializeModule(fixture([{ ...base, type: 'flashcards', studyMode: 'random',
      cards: [{ front: 'Utilitarianism', back: '**Well-being.**\n![Image](https://example.com/image.png)' }],
    }]));
    expect(markdown).toContain('studyMode: "random"');
    expect(markdown).toContain('### Utilitarianism\n**Well-being.**\n![Image](https://example.com/image.png)');
  });

  it('exports free response settings, prompt, and sample answer', () => {
    const markdown = serializeModule(fixture([{ ...base, type: 'freeResponse', maxLength: 2000,
      prompt: 'What would you do?\n![Diagram](https://example.com/image.png)', sampleAnswer: 'I would pull the lever.',
    }]));
    expect(markdown).toContain('maxLength: 2000\n\nWhat would you do?');
    expect(markdown).toContain('### Sample answer\nI would pull the lever.');
  });

  it('exports named resource links, PDFs, IDs, and legacy resource fields', () => {
    const markdown = serializeModule(fixture([{ ...base, type: 'additionalResources', resources: {
      link: 'https://example.com/legacy', pdf: '', all: [{ id: 'r1', name: 'Case [study]', url: 'https://example.com/case(1).pdf', type: 'pdf' }],
    } }]));
    expect(markdown).toContain('- [Case \\[study\\]](https://example.com/case%281%29.pdf) (pdf)');
    expect(markdown).toContain('"id":"r1"');
    expect(markdown).toContain('https://example.com/legacy');
    const legacy = serializeModule(fixture([{ ...base, type: 'additionalResources', resources: { link: 'https://example.com/article', pdf: 'https://example.com/doc.pdf' } }]));
    expect(legacy).toContain('- [External link](https://example.com/article)');
    expect(legacy).toContain('- [PDF document](https://example.com/doc.pdf) (pdf)');
  });

  it('preserves step order without mutating the input', () => {
    const steps: Step[] = [
      { ...base, id: 'st_later', order: 10, type: 'video', youtubeUrl: 'later' },
      { ...base, id: 'st_first', order: 1, type: 'video', youtubeUrl: 'first' },
    ];
    const markdown = serializeModule(fixture(steps));
    expect(markdown.indexOf('st_first')).toBeLessThan(markdown.indexOf('st_later'));
    expect(steps[0].id).toBe('st_later');
  });

  it('rejects unsupported step types', () => {
    expect(() => serializeModule(fixture([{ ...base, type: 'unknown' } as unknown as Step]))).toThrow('Unsupported step type: unknown');
  });

  it('uses safe, unique filenames for duplicate titles and unsafe title characters', () => {
    expect(moduleFilename({ id: 'mod_abc123', title: 'The Trolley Problem' })).toBe('the-trolley-problem--mod_abc123.md');
    expect(moduleFilename({ id: 'one', title: '../Éthics: / test' })).toBe('ethics-test--one.md');
    expect(moduleFilename({ id: 'two', title: '../Éthics: / test' })).toBe('ethics-test--two.md');
    expect(moduleFilename({ id: 'three', title: '🧠' })).toBe('module--three.md');
  });
});
