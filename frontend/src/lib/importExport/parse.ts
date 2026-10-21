import { isMap, LineCounter, parseDocument } from "yaml";
import { STEP_COLLECTIONS, type StepType } from "@/lib/firebase/types";
import type { ParsedModule, ParsedStep, ParseError } from "./types";

interface Line { text: string; line: number; code: boolean }
type Data = Record<string, unknown>;
type Item = { id?: string; text: string };
const settingTypes: Record<string, Record<string, string>> = {
  video: { youtubeUrl: "string", thumbnailUrl: "string", durationSec: "integer" },
  quiz: { passingScore: "integer", shuffle: "boolean" },
  freeResponse: { maxLength: "integer" },
  poll: { allowMultipleChoice: "boolean" },
};
const commonSettings = { estimatedMinutes: "number", isOptional: "boolean" };
const reservedFields = new Set([
  ...Object.keys(commonSettings), ...Object.values(settingTypes).flatMap(Object.keys),
  "createdBy", "createdAt", "updatedAt", "moduleId", "order", "votes", "studyMode",
]);
const nonblank = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const heading = (l: Line) => !l.code ? /^###(?:\s+(.*))?$/.exec(l.text.trim()) : null;
const bullet = (l: Line) => !l.code ? /^-\s+(.*)$/.exec(l.text.trim()) : null;
const structural = (l: Line) => !l.code && /^(?:#{1,6}(?:\s|$)|-\s|>\s)|<!--\s*(?:step|option|bucket|card)\b/.test(l.text.trim());
const escapeAttribute = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");

/** Pure #130 parser. Missing IDs remain absent for #135.
 * Sorting includes zero-based sortingAssignments for EVERY assigned card, even
 * when either ID is missing. #136 must generate IDs, resolve these pairs into
 * answerKey, and remove sortingAssignments before writing to Firestore.
 */
export function parseModule(markdown: string): { module: ParsedModule | null; errors: ParseError[] } {
  const errors: ParseError[] = [];
  const ids = new Map<string, number>();
  const imageFilenames: string[] = [];
  const fail = (line: number, message: string) => { errors.push({ line, message }); };
  const register = (id: unknown, line: number): id is string => {
    if (!nonblank(id)) { fail(line, "ID must be a nonblank string."); return false; }
    const first = ids.get(id);
    if (first !== undefined) fail(line, `ID "${id}" appears twice (first appeared on line ${first}). Remove the copied ID to create a new item.`);
    else ids.set(id, line);
    return true;
  };
  const lines: Line[] = markdown.replace(/^\uFEFF/, "").split(/\r?\n/).map((text, i) => ({ text, line: i + 1, code: false }));
  function parseFrontmatter() {
    let bodyStart = 0;
    const metadata: Data = {};
    const fieldLines = new Map<string, number>();
    if (lines[0].text.trim() !== "---") fail(1, "Module must begin with YAML frontmatter (---).");
    else {
      const end = lines.findIndex((l, i) => i > 0 && l.text.trim() === "---");
      if (end < 0) fail(1, "YAML frontmatter is missing its closing ---.");
      else {
        bodyStart = end + 1;
        const counter = new LineCounter();
        const doc = parseDocument(lines.slice(1, end).map(l => l.text).join("\n"), { lineCounter: counter, uniqueKeys: true });
        for (const error of [...doc.errors, ...doc.warnings]) fail(counter.linePos(error.pos[0]).line + 1, `Invalid YAML: ${error.message.split("\n")[0]}`);
        if (!isMap(doc.contents)) fail(2, "Frontmatter must be a YAML mapping.");
        else {
          let values: Data = {};
          try { values = doc.toJS({ maxAliasCount: 100 }) as Data; }
          catch { fail(2, "Invalid YAML aliases in frontmatter."); }
          for (const pair of doc.contents.items) {
            const key = String(pair.key);
            const range = (pair.key as { range?: number[] })?.range;
            const line = range ? counter.linePos(range[0]).line + 1 : 2;
            fieldLines.set(key, line);
            if (!["id", "title", "description", "tags", "isPublic", "updatedAt"].includes(key)) fail(line, `Unsupported module metadata "${key}" (site-managed fields cannot be imported).`);
            Object.defineProperty(metadata, key, { value: values[key], enumerable: true, configurable: true, writable: true });
          }
        }
      }
    }
    const fieldLine = (key: string) => fieldLines.get(key) ?? 1;
    if (!nonblank(metadata.title)) fail(fieldLine("title"), "Module title must be a nonblank string.");
    if (typeof metadata.description !== "string") fail(fieldLine("description"), "Module description must be a string.");
    if (!Array.isArray(metadata.tags) || !metadata.tags.every(t => typeof t === "string")) fail(fieldLine("tags"), "Module tags must be an array of strings.");
    if (typeof metadata.isPublic !== "boolean") fail(fieldLine("isPublic"), "Module isPublic must be a boolean.");
    if ("id" in metadata) register(metadata.id, fieldLine("id"));
    if ("updatedAt" in metadata && (typeof metadata.updatedAt !== "string" || !validTimestamp(metadata.updatedAt))) fail(fieldLine("updatedAt"), "Module updatedAt must be a valid timestamp string.");
    return { bodyStart, metadata, fieldLine };
  }
  const { bodyStart, metadata, fieldLine } = parseFrontmatter();

  markFencedCode(lines.slice(bodyStart), fail);

  function convertImages(l: Line): string {
    return l.text.replace(/!\[((?:\\.|[^\]\\])*)\]\((<[^>\n]*>|(?:\\.|[^()\n]|\([^()\n]*\))*)\)/g, (whole, alt: string, raw: string) => {
      const destination = raw.startsWith("<") ? raw.slice(1, -1) : raw;
      const src = destination.replace(/\\([\\()[\]])/g, "$1");
      const remote = validWebUrl(src);
      if (!remote) {
        if (!src || /[\\/:?#\x00-\x1f]/.test(src) || src === "." || src === "..") {
          fail(l.line, `Unsupported image destination "${src}"; use an HTTP(S) URL or a bare filename.`);
          return whole;
        }
        if (!imageFilenames.includes(src)) imageFilenames.push(src);
      }
      return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt.replace(/\\(.)/g, "$1"))}" />`;
    });
  }

  const text = (ls: Line[], allowLists = false): string => {
    const trimmed = [...ls];
    while (trimmed.length && !trimmed[0].text.trim()) trimmed.shift();
    while (trimmed.length && !trimmed[trimmed.length - 1].text.trim()) trimmed.pop();
    return trimmed.map(l => {
      if (l.code) return l.text;
      if (structural(l) && (!allowLists || /^#{1,3}(?:\s|$)|<!--\s*(?:step|option|bucket|card)\b/.test(l.text.trim()))) fail(l.line, "Misplaced section, item, or malformed marker in text content.");
      const lateSetting = /^([A-Za-z][\w]*):/.exec(l.text);
      if (lateSetting && reservedFields.has(lateSetting[1])) fail(l.line, `Misplaced setting or site-managed field "${lateSetting[1]}"; settings belong immediately after the step title.`);
      return convertImages(l);
    }).join("\n");
  };
  const requiredText = (value: string, line: number, name: string) => { if (!value.trim()) fail(line, `${name} must not be blank.`); };
  const item = (raw: string, kind: string, line: number): Item => {
    const match = /^(.*?)\s*<!--\s*(option|bucket|card)\s+id="([^"]*)"\s*-->\s*$/.exec(raw);
    if (match && match[2] === kind) {
      const result: Item = { text: match[1] };
      if (register(match[3], line)) result.id = match[3];
      return result;
    }
    if (/<!--/.test(raw)) fail(line, `Malformed or misplaced ${kind} ID marker.`);
    return { text: raw };
  };
  // Visit module text first so local filenames follow source order.
  const moduleText = { title: "", description: "" };
  const textFields = ["title", "description"] as const;
  for (const key of [...textFields].sort((a, b) => fieldLine(a) - fieldLine(b))) {
    const value = metadata[key];
    if (typeof value === "string") {
      const content = linesForMetadata(value, fieldLine(key));
      markFencedCode(content, fail);
      moduleText[key] = text(content, true);
    }
  }
  const steps: ParsedStep[] = [];
  const starts = lines.map((l, i) => !l.code && /^\s*<!--\s*step\b/.test(l.text) ? i : -1).filter(i => i >= bodyStart);
  for (const l of lines.slice(bodyStart, starts[0] ?? lines.length)) if (l.text.trim()) fail(l.line, "Content outside a step; expected <!-- step type=\"...\" -->.");
  for (let s = 0; s < starts.length; s++) {
    const start = starts[s];
    const opening = lines[start];
    const block = lines.slice(start + 1, starts[s + 1] ?? lines.length);
    const marker = /^\s*<!--\s*step\s+((?:id|type)="[^"]*"(?:\s+(?:id|type)="[^"]*")*)\s*-->\s*$/.exec(opening.text);
    if (!marker) { fail(opening.line, "Malformed step marker; expected <!-- step type=\"...\" --> with optional id."); continue; }
    const attrs: Data = {};
    for (const attr of marker[1].matchAll(/(id|type)="([^"]*)"/g)) {
      if (attr[1] in attrs) fail(opening.line, `Duplicate step attribute "${attr[1]}".`);
      attrs[attr[1]] = attr[2];
    }
    if ("id" in attrs) register(attrs.id, opening.line);
    if (typeof attrs.type !== "string" || !Object.prototype.hasOwnProperty.call(STEP_COLLECTIONS, attrs.type)) { fail(opening.line, `Unsupported step type "${attrs.type ?? ""}"${attrs.type === "debate" ? "; debate is deferred until #127" : ""}.`); continue; }
    const type = attrs.type as StepType;
    let cursor = 0;
    while (cursor < block.length && !block[cursor].text.trim()) cursor++;
    const titleLine = block[cursor];
    const titleMatch = titleLine && !titleLine.code ? /^##\s+(.*)$/.exec(titleLine.text.trim()) : null;
    if (!titleMatch || !titleMatch[1].trim()) { fail(titleLine?.line ?? opening.line, "Step needs a nonblank ## title immediately after its marker."); continue; }
    const title = text([{ ...titleLine, text: titleMatch[1] }]);
    cursor++;
    function parseSettings() {
      const data: Data = {};
      const settings = new Map<string, number>();
      const allowed: Record<string, string> = { ...commonSettings, ...settingTypes[type] };
      while (cursor < block.length) {
        const l = block[cursor];
        if (!l.text.trim()) { cursor++; continue; }
        const m = !l.code && /^([A-Za-z][\w]*):(?:\s+(.*)|\s*)$/.exec(l.text);
        if (!m) break;
        cursor++;
        if (settings.has(m[1])) fail(l.line, `Duplicate setting "${m[1]}".`);
        settings.set(m[1], l.line);
        if (!Object.prototype.hasOwnProperty.call(allowed, m[1])) { fail(l.line, `Unknown setting "${m[1]}" for ${type}.`); continue; }
        const doc = parseDocument(m[2] ?? "");
        if (doc.errors.length || doc.warnings.length) { fail(l.line, `Invalid setting "${m[1]}".`); continue; }
        let value: unknown;
        try { value = doc.toJS({ maxAliasCount: 100 }); }
        catch { fail(l.line, `Invalid YAML alias in setting "${m[1]}".`); continue; }
        const expected = allowed[m[1]];
        if ((expected === "integer" ? !Number.isInteger(value) : typeof value !== expected) || (typeof value === "number" && !Number.isFinite(value))) fail(l.line, `Setting "${m[1]}" must be ${expected}.`);
        else data[m[1]] = value;
      }
      return { data, settings };
    }
    const { data, settings } = parseSettings();
    const settingLine = (key: string) => settings.get(key) ?? titleLine.line;
    const requireSetting = (key: string) => { if (!settings.has(key)) fail(titleLine.line, `Missing required setting "${key}".`); };
    const body = block.slice(cursor);
    function parseStepBody() {
      const sectionStarts = body.map((l, i) => heading(l) ? i : -1).filter(i => i >= 0);
      const prefix = body.slice(0, sectionStarts[0] ?? body.length);
      if (type === "video") {
        requireSetting("youtubeUrl");
        if (settings.has("youtubeUrl") && !nonblank(data.youtubeUrl)) fail(settingLine("youtubeUrl"), "youtubeUrl must not be blank.");
        for (const l of body) if (l.text.trim()) fail(l.line, "Unexpected video body; use video settings.");
      } else if (type === "freeResponse") {
        data.prompt = text(prefix, true);
        requiredText(data.prompt as string, titleLine.line, "Free response prompt");
        sectionStarts.forEach((i, n) => {
          if (heading(body[i])?.[1] !== "Sample answer" || n > 0) fail(body[i].line, "Only one ### Sample answer section is allowed.");
          else data.sampleAnswer = text(body.slice(i + 1, sectionStarts[n + 1] ?? body.length), true);
        });
        if (typeof data.maxLength === "number" && (data.maxLength < 1 || data.maxLength > 10000)) fail(settingLine("maxLength"), "maxLength must be between 1 and 10,000.");
      } else if (type === "flashcards" || type === "quiz") {
        for (const l of prefix) if (l.text.trim()) fail(l.line, `Expected a ### ${type === "quiz" ? "question" : "card"} heading.`);
        if (!sectionStarts.length) fail(titleLine.line, `${type} needs at least one ${type === "quiz" ? "question" : "card"}.`);
        const entries = sectionStarts.map((i, n) => {
          const h = body[i];
          const prompt = text([{ ...h, text: heading(h)?.[1] ?? "" }]);
          requiredText(prompt, h.line, type === "quiz" ? "Question prompt" : "Card front");
          const content = body.slice(i + 1, sectionStarts[n + 1] ?? body.length);
          if (type === "flashcards") {
            const back = text(content, true);
            requiredText(back, h.line, "Card back");
            return { front: prompt, back };
          }
          const choices: string[] = [];
          const choiceExplanations: (string | null)[] = [];
          const checked: number[] = [];
          let canExplain = false;
          for (let j = 0; j < content.length; j++) {
            const l = content[j];
            const choice = !l.code && /^-\s+\[([ xX])\](?:\s+(.*)|\s*)$/.exec(l.text.trim());
            if (choice) {
              const value = text([{ ...l, text: choice[2] ?? "" }]);
              requiredText(value, l.line, "Quiz choice");
              if (choice[1].toLowerCase() === "x") checked.push(choices.length);
              choices.push(value); choiceExplanations.push(null); canExplain = true;
            } else if (!l.code && /^\s*>/.test(l.text) && canExplain) {
              const quotes: Line[] = [];
              while (j < content.length && !content[j].code && /^\s*>/.test(content[j].text)) {
                quotes.push({ ...content[j], text: content[j].text.replace(/^\s*> ?/, "") }); j++;
              }
              j--;
              markFencedCode(quotes, fail);
              choiceExplanations[choices.length - 1] = text(quotes, true);
              canExplain = false;
            } else if (l.text.trim()) { fail(l.line, "Expected a checkbox choice or a consecutive explanation blockquote."); canExplain = false; }
            else canExplain = false;
          }
          if (!choices.length) fail(h.line, "Question needs at least one choice.");
          if (checked.length !== 1) fail(h.line, "Question needs exactly one checked choice.");
          return { prompt, choices, correctIndex: checked[0] ?? -1, choiceExplanations };
        });
        data[type === "quiz" ? "questions" : "cards"] = entries;
        if (type === "quiz") {
          requireSetting("passingScore"); requireSetting("shuffle");
          if (typeof data.passingScore === "number" && (data.passingScore < 0 || data.passingScore > 100)) fail(settingLine("passingScore"), "passingScore must be between 0 and 100.");
        }
      } else if (type === "poll") {
        requireSetting("allowMultipleChoice");
        const first = body.findIndex(l => bullet(l));
        const question = text(body.slice(0, first < 0 ? body.length : first));
        requiredText(question, titleLine.line, "Poll question");
        const options: Data[] = [];
        for (const l of body.slice(first < 0 ? body.length : first)) {
          if (!l.text.trim()) continue;
          const b = bullet(l);
          if (!b) { fail(l.line, "Expected a poll option bullet."); continue; }
          const option = item(b[1], "option", l.line);
          option.text = text([{ ...l, text: option.text }]);
          requiredText(option.text, l.line, "Poll option");
          options.push({ ...option });
        }
        if (options.length < 2) fail(titleLine.line, `Poll "${title}" needs at least 2 options.`);
        data.question = question; data.options = options;
      } else if (type === "sorting") {
        data.prompt = text(prefix);
        requiredText(data.prompt as string, titleLine.line, "Sorting prompt");
        const buckets: { id?: string; label: string }[] = [];
        const cards: Item[] = [];
        const answerKey: Record<string, string> = {};
        const sortingAssignments: { cardIndex: number; bucketIndex: number }[] = [];
        let sawUnsorted = false;
        sectionStarts.forEach((i, n) => {
          const h = body[i];
          const bucket = item(heading(h)?.[1] ?? "", "bucket", h.line);
          const unsorted = bucket.text.trim() === "Unsorted";
          if (unsorted && (bucket.id || sawUnsorted)) fail(h.line, "Unsorted must appear once at most and cannot have a bucket ID.");
          if (unsorted) sawUnsorted = true;
          else {
            const label = text([{ ...h, text: bucket.text }]);
            requiredText(label, h.line, "Bucket label");
            buckets.push({ ...(bucket.id ? { id: bucket.id } : {}), label });
          }
          for (const l of body.slice(i + 1, sectionStarts[n + 1] ?? body.length)) {
            if (!l.text.trim()) continue;
            const b = bullet(l);
            if (!b) { fail(l.line, "Expected a sorting card bullet."); continue; }
            const card = item(b[1], "card", l.line);
            card.text = text([{ ...l, text: card.text }]);
            requiredText(card.text, l.line, "Sorting card");
            if (!unsorted) {
              sortingAssignments.push({ cardIndex: cards.length, bucketIndex: buckets.length - 1 });
              if (card.id && bucket.id) Object.defineProperty(answerKey, card.id, { value: bucket.id, enumerable: true, configurable: true, writable: true });
            }
            cards.push(card);
          }
        });
        if (buckets.length < 2) fail(titleLine.line, "Sorting needs at least 2 buckets.");
        if (!cards.length) fail(titleLine.line, "Sorting needs at least one card.");
        Object.assign(data, { buckets, cards, answerKey, sortingAssignments });
      } else if (type === "additionalResources") {
        const all: { name: string; url: string; type: "link" | "pdf" }[] = [];
        for (const l of body) {
          if (!l.text.trim()) continue;
          const m = !l.code && /^-\s+\[([^\]]*)\]\(([^\s]+)\)(?:\s+\(pdf\))?\s*$/.exec(l.text.trim());
          if (!m) { fail(l.line, "Expected a resource link bullet with optional (pdf) suffix."); continue; }
          requiredText(m[1], l.line, "Resource name");
          if (!validWebUrl(m[2])) fail(l.line, "Resource URL must be a valid HTTP(S) URL.");
          all.push({ name: m[1], url: m[2], type: /\s\(pdf\)\s*$/.test(l.text) ? "pdf" : "link" });
        }
        if (!all.length) fail(titleLine.line, "Additional resources needs at least one resource.");
        data.resources = { link: all.find(r => r.type === "link")?.url ?? "", pdf: all.find(r => r.type === "pdf")?.url ?? "", all };
      } else fail(opening.line, `Unsupported step type "${type}"; no parser is available yet.`);
    }
    parseStepBody();
    steps.push({ ...(typeof attrs.id === "string" ? { id: attrs.id } : {}), type, title, line: opening.line, data });
  }
  errors.sort((a, b) => a.line - b.line);
  if (errors.length) return { module: null, errors };
  return { module: {
    ...(typeof metadata.id === "string" ? { id: metadata.id } : {}),
    title: moduleText.title, description: moduleText.description,
    tags: metadata.tags as string[], isPublic: metadata.isPublic as boolean,
    ...(typeof metadata.updatedAt === "string" ? { updatedAt: metadata.updatedAt } : {}), steps, imageFilenames,
  }, errors };
}

function markFencedCode(lines: Line[], fail: (line: number, message: string) => void): void {
  let fence: { char: string; length: number; line: number } | undefined;
  for (const l of lines) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(l.text);
    l.code = !!fence;
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
    } else if (marker && (marker[1][0] !== "`" || !marker[2].includes("`"))) {
      l.code = true;
      fence = { char: marker[1][0], length: marker[1].length, line: l.line };
    }
  }
  if (fence) fail(fence.line, "Unclosed fenced code block.");
}

function linesForMetadata(value: string, line: number): Line[] {
  return value.split("\n").map((text, i) => ({ text, line: line + i, code: false }));
}

function validWebUrl(value: string): boolean {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !!url.hostname; } catch { return false; }
}

function validTimestamp(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!m || !Number.isFinite(Date.parse(value))) return false;
  const [, y, month, day, hour, minute, second, zoneHour, zoneMinute] = m;
  const days = new Date(Date.UTC(Number(y), Number(month), 0)).getUTCDate();
  return +month >= 1 && +month <= 12 && +day >= 1 && +day <= days && +hour < 24 && +minute < 60 && +second < 60 && (!zoneHour || (+zoneHour < 24 && +zoneMinute < 60));
}
