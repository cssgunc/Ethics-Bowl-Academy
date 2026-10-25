import type { Module, Step } from "@/lib/firebase/types";
import type { ImportPlan, ParsedModule, ParsedStep } from "./types";
import { validTimestamp } from "./parse";

/** Pure preview only. Any errors make the entire plan ineligible to apply. */
export function planImport(parsed: ParsedModule, liveModule: Module | null, liveSteps: Step[]): ImportPlan {
  const plan: ImportPlan = {
    isNewModule: parsed.id === undefined, isStale: false,
    creates: [], updates: [], deletes: [], removedPollOptions: [], errors: [],
  };
  const fail = (line: number, message: string) => { plan.errors.push({ line, message }); };
  const seen = new Set<string>();
  const register = (id: unknown, line: number, kind: string): id is string => {
    if (typeof id !== "string" || !id.trim()) { fail(line, `${kind} ID must be a nonblank string.`); return false; }
    if (seen.has(id)) { fail(line, `Duplicate ID "${id}". Remove copied IDs when creating new items.`); return false; }
    seen.add(id);
    return true;
  };
  if (parsed.id !== undefined) register(parsed.id, 1, "Module");
  const matchesModule = !plan.isNewModule && liveModule !== null && liveModule.id === parsed.id;
  if (!plan.isNewModule && !matchesModule) fail(1, "Module ID does not match a live module. Load the matching module or remove copied IDs to create a new module.");

  let fileTime: number | undefined;
  if (parsed.updatedAt !== undefined) {
    if (typeof parsed.updatedAt !== "string" || !validTimestamp(parsed.updatedAt)) fail(1, "File updatedAt must be a valid timestamp.");
    else fileTime = Date.parse(parsed.updatedAt);
  }
  if (matchesModule) {
    const liveTime = timestampMillis(liveModule.updatedAt);
    if (liveTime === undefined) fail(1, "Live module updatedAt must be a valid Date or Firestore timestamp.");
    else if (fileTime !== undefined) plan.isStale = fileTime < liveTime;
  }

  const liveById = new Map<string, Step>();
  if (matchesModule) {
    for (const step of liveSteps) {
      if (step.moduleId !== parsed.id) { fail(1, `Live step "${step.id}" belongs to a different module.`); continue; }
      if (liveById.has(step.id)) fail(1, `Duplicate live step ID "${step.id}".`);
      else liveById.set(step.id, step);
    }
  }
  const retainedSteps = new Set<string>();
  const warnRemovedOptions = (live: Step, retained = new Set<string>()) => {
    if (live.type !== "poll") return;
    for (const option of live.options) {
      if (!retained.has(option.id) && option.votes > 0) plan.removedPollOptions.push({ stepTitle: live.title, optionText: option.text, votes: option.votes });
    }
  };

  const validateNested = (step: ParsedStep, live: Step | undefined) => {
    const keys = step.type === "poll" ? ["options"] : step.type === "sorting" ? ["buckets", "cards"] : [];
    for (const key of keys) {
      const items = step.data[key];
      const liveItems = live?.type === "poll" && key === "options" ? live.options
        : live?.type === "sorting" ? (key === "buckets" ? live.buckets : live.cards) : [];
      const known = new Set(liveItems.map(item => item.id));
      const retained = new Set<string>();
      if (!Array.isArray(items)) { fail(step.line, `${key} must be an array.`); continue; }
      for (const item of items) {
        if (!item || typeof item !== "object") { fail(step.line, `Invalid item in ${key}.`); continue; }
        if (item.id === undefined) continue;
        if (!register(item.id, step.line, key)) continue;
        if (!known.has(item.id)) fail(step.line, `Unknown ${key} ID "${item.id}" in step "${step.title}". Remove copied IDs when creating new items.`);
        else retained.add(item.id);
      }
      if (key === "options" && live) warnRemovedOptions(live, retained);
    }
  };

  for (const step of parsed.steps) {
    let live: Step | undefined;
    if (step.id === undefined) plan.creates.push(step);
    else {
      // Retain even an invalid update's ID so it is never also offered for deletion.
      retainedSteps.add(step.id);
      const unique = register(step.id, step.line, "Step");
      live = liveById.get(step.id);
      if (!live) fail(step.line, `Unknown step ID "${step.id}". Remove copied IDs when creating new items.`);
      else if (step.type !== live.type) { fail(step.line, `Cannot change step "${step.id}" from ${live.type} to ${step.type}.`); live = undefined; }
      else if (unique) plan.updates.push({ parsed: step, live });
      if (!unique) live = undefined;
      if (plan.isNewModule) plan.creates.push(step);
    }
    validateNested(step, live);
  }
  if (matchesModule) {
    for (const live of liveById.values()) {
      if (!retainedSteps.has(live.id)) {
        plan.deletes.push(live);
        warnRemovedOptions(live);
      }
    }
  }
  return plan;
}

function timestampMillis(value: unknown): number | undefined {
  try {
    let millis: unknown;
    if (value instanceof Date) millis = value.getTime();
    else if (value && typeof value === "object") {
      if ("toMillis" in value && typeof value.toMillis === "function") millis = value.toMillis();
      else if ("toDate" in value && typeof value.toDate === "function") {
        const date: unknown = value.toDate();
        if (date instanceof Date) millis = date.getTime();
      }
    }
    return typeof millis === "number" && Number.isFinite(millis) ? millis : undefined;
  } catch { return undefined; }
}
