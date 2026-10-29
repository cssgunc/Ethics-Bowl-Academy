import type { Module, Step } from './firebase/types';

export type ExportModule = Module & { steps: Step[] };

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return (value.toDate() as Date).toISOString();
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]));
  }
  return value;
}

// JSON flow values are also valid YAML, including quoted multiline strings.
function settings(data: object, omitted: string[] = []): string[] {
  return Object.entries(data)
    .filter(([key, value]) => !omitted.includes(key) && value !== undefined)
    .map(([key, value]) => `${/^[a-zA-Z][\w]*$/.test(key) ? key : JSON.stringify(key)}: ${JSON.stringify(normalizeValue(value))}`);
}

function idComment(kind: string, id?: string) {
  if (!id) return '';
  if (!/^[\w-]+$/.test(id) || id.includes('--')) throw new Error(`Invalid ${kind} ID: ${id}`);
  return ` <!-- ${kind} id="${id}" -->`;
}

function listItem(text: string) {
  return text.replace(/\r\n?/g, '\n').replace(/\n/g, '\n  ');
}

/** Preserve extra nested fields in a setting only when the readable body cannot represent them. */
function nestedSetting(key: string, items: object[], represented: string[]): string[] {
  return items.some((item) => Object.keys(item).some((field) => !represented.includes(field)))
    ? settings({ [key]: items })
    : [];
}

function serializeStep(step: Step): string {
  const body: string[] = [];
  let omitted: string[] = [];
  const extraSettings: string[] = [];

  switch (step.type) {
    case 'video':
      break;
    case 'debate':
      omitted = ['modulePrompt', 'startQuestion'];
      body.push('### Context', step.modulePrompt, '', '### Starting question', step.startQuestion);
      break;
    case 'quiz':
      omitted = ['questions'];
      extraSettings.push(...nestedSetting('questions', step.questions, [
        'prompt', 'choices', 'correctIndex', 'choiceExplanations', 'explanation',
      ]));
      for (const question of step.questions) {
        if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= question.choices.length) {
          throw new Error(`Quiz "${step.title}" has an invalid correct answer.`);
        }
        const [firstLine, ...promptLines] = question.prompt.replace(/\r\n?/g, '\n').split('\n');
        body.push(`### ${firstLine} <!-- question -->`, ...promptLines);
        question.choices.forEach((choice, index) => {
          body.push(`- [${index === question.correctIndex ? 'x' : ' '}] ${listItem(choice)}`);
          const feedback = question.choiceExplanations?.[index];
          if (feedback) body.push(...feedback.replace(/\r\n?/g, '\n').split('\n').map((line) => `  > ${line}`));
        });
        if (question.explanation) body.push('', '### Explanation <!-- explanation -->', question.explanation);
        body.push('');
      }
      break;
    case 'poll':
      omitted = ['question', 'options'];
      extraSettings.push(...nestedSetting('options', step.options.map(({ votes, ...option }) => {
        void votes;
        return option;
      }), ['id', 'text']));
      body.push(step.question, '');
      for (const option of step.options) body.push(`- ${listItem(option.text)}${idComment('option', option.id)}`);
      break;
    case 'sorting': {
      omitted = ['prompt', 'buckets', 'cards', 'answerKey'];
      extraSettings.push(...nestedSetting('buckets', step.buckets, ['id', 'label']));
      extraSettings.push(...nestedSetting('cards', step.cards, ['id', 'text']));
      const answerKey = step.answerKey ?? {};
      const bucketIds = new Set(step.buckets.map((bucket) => bucket.id));
      for (const [cardId, bucketId] of Object.entries(answerKey)) {
        if (!bucketId) continue;
        if (!bucketIds.has(bucketId) || !step.cards.some((card) => card.id === cardId)) {
          throw new Error(`Sorting step "${step.title}" has an answer key referencing a missing card or bucket.`);
        }
      }
      body.push(step.prompt, '');
      for (const bucket of step.buckets) {
        body.push(`### ${bucket.label}${idComment('bucket', bucket.id)}`);
        for (const card of step.cards.filter((item) => answerKey[item.id] === bucket.id)) {
          body.push(`- ${listItem(card.text)}${idComment('card', card.id)}`);
        }
        body.push('');
      }
      const unsorted = step.cards.filter((card) => !answerKey[card.id]);
      if (unsorted.length) {
        body.push('### Unsorted');
        for (const card of unsorted) body.push(`- ${listItem(card.text)}${idComment('card', card.id)}`);
      }
      break;
    }
    case 'flashcards':
      omitted = ['cards'];
      extraSettings.push(...nestedSetting('cards', step.cards, ['front', 'back']));
      for (const card of step.cards) body.push(`### ${card.front}`, card.back, '');
      break;
    case 'freeResponse':
      omitted = ['prompt', 'sampleAnswer'];
      body.push(step.prompt);
      if (step.sampleAnswer !== undefined) body.push('', '### Sample answer', step.sampleAnswer);
      break;
    case 'additionalResources': {
      // Retain the resource IDs and original legacy fields alongside the readable links.
      const resources = step.resources.all ?? [
        ...(step.resources.link ? [{ name: 'External link', url: step.resources.link, type: 'link' }] : []),
        ...(step.resources.pdf ? [{ name: 'PDF document', url: step.resources.pdf, type: 'pdf' }] : []),
      ];
      for (const resource of resources) {
        const label = resource.name.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\r?\n/g, ' ');
        const url = resource.url.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
        body.push(`- [${label}](${url})${resource.type === 'pdf' ? ' (pdf)' : ''}`);
      }
      break;
    }
    default:
      throw new Error(`Unsupported step type: ${(step as { type: string }).type}`);
  }

  const marker = step.id
    ? `<!-- step id="${step.id}" type="${step.type}" -->`
    : `<!-- step type="${step.type}" -->`;
  if (step.id) idComment('step', step.id);
  const lines = [marker, `## ${step.title}`, ...settings(step, ['id', 'type', 'title', ...omitted]), ...extraSettings];
  if (body.length) lines.push('', ...body);
  return lines.join('\n').trimEnd();
}

export function serializeModule(module: ExportModule): string {
  const { steps, id, title, description, tags, isPublic, updatedAt, ...metadata } = module;
  const frontMatter = settings({
    id, title, description, tags, isPublic, updatedAt,
    ...metadata,
  }, ['order']);
  const orderedSteps = [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return ['---', ...frontMatter, '---'].join('\n') + '\n'
    + (orderedSteps.length ? '\n' + orderedSteps.map(serializeStep).join('\n\n') + '\n' : '');
}

export function moduleFilename(module: Pick<Module, 'id' | 'title'>): string {
  const slug = module.title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'module';
  const id = module.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${slug}--${id}.md`;
}
