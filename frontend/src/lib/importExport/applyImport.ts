import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { v4 as uuid } from "uuid";
import { auth, db } from "@/lib/firebase/firebaseConfig";
import { createModule, deleteStep } from "@/lib/firebase/db-operations";
import { uploadStepImage } from "@/lib/firebase/uploadStepImage";
import { STEP_COLLECTIONS, type Step } from "@/lib/firebase/types";
import type { ImportPlan, ParsedModule, ParsedStep } from "./types";

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Apply only the plan explicitly approved in the import preview. */
export async function applyImport(plan: ImportPlan, parsed: ParsedModule, images: File[], userId: string): Promise<{ moduleId: string }> {
  if (!db || !userId || auth?.currentUser?.uid !== userId) throw new Error("Sign in before importing.");
  if (plan.errors.length) throw new Error("Resolve import errors before applying.");
  if (plan.isNewModule !== (parsed.id === undefined)) throw new Error("Module target does not match the plan.");
  if (plan.creates.length + plan.updates.length !== parsed.steps.length) throw new Error("Incomplete import plan.");
  if (parsed.steps.length > 499) throw new Error("Import supports at most 499 steps at a time.");
  const files = new Map(images.map(file => [file.name, file]));
  if (files.size !== images.length) throw new Error("Duplicate image filenames.");
  for (const name of parsed.imageFilenames) {
    const file = files.get(name);
    if (!file) throw new Error(`Missing image: ${name}`);
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error(`Invalid image: ${name}`);
  }
  // Check identities before creating a module or uploading anything.
  const updates = new Map(plan.updates.map(update => [update.parsed, update.live]));
  const creates = new Set(plan.creates);
  for (const step of parsed.steps) {
    const live = updates.get(step);
    if (!creates.has(step) && !live) throw new Error("Step is missing from the approved plan.");
    if (live && (live.moduleId !== parsed.id || live.id !== step.id || live.type !== step.type)) throw new Error("Step target does not match the plan.");
  }
  if (plan.deletes.some(step => step.moduleId !== parsed.id)) throw new Error("Deletion target does not match the module.");

  let moduleData = { title: parsed.title, description: parsed.description, tags: parsed.tags, isPublic: parsed.isPublic };
  const moduleId = plan.isNewModule
    ? (await createModule({ ...moduleData, createdBy: userId, stepCount: 0 })).id
    : parsed.id!;
  const batch = writeBatch(db);
  const uploaded = new Map<string, string>();
  // The parser also accepts images in module title/description text.
  for (const name of parsed.imageFilenames) {
    const source = `src="${escapeAttribute(name)}"`;
    if (!containsString(moduleData, source)) continue;
    const collectionName = STEP_COLLECTIONS[parsed.steps[0]?.type ?? "freeResponse"];
    const { url } = await uploadStepImage(files.get(name)!, moduleId, collectionName, userId);
    uploaded.set(`${collectionName}/${name}`, url);
    moduleData = replaceStrings(moduleData, source, `src="${escapeAttribute(url)}"`) as typeof moduleData;
  }

  for (const [order, step] of parsed.steps.entries()) {
    const live = updates.get(step);
    const collectionName = STEP_COLLECTIONS[step.type];
    const parent = collection(db, "modules", moduleId, collectionName);
    const reference = live ? doc(parent, live.id) : doc(parent);
    let data = prepareData(step, live);
    // Upload into each consuming step collection; replace exact image src values only.
    for (const name of parsed.imageFilenames) {
      const source = `src="${escapeAttribute(name)}"`;
      if (!containsString(data, source)) continue;
      const key = `${collectionName}/${name}`;
      let url = uploaded.get(key);
      if (!url) {
        url = (await uploadStepImage(files.get(name)!, moduleId, collectionName, userId, reference.id)).url;
        uploaded.set(key, url);
      }
      data = replaceStrings(data, source, `src="${escapeAttribute(url)}"`) as Record<string, unknown>;
    }
    const payload = { ...data, title: step.title, type: step.type, order, updatedAt: serverTimestamp() };
    if (live) batch.update(reference, payload);
    else batch.set(reference, {
      ...payload, moduleId, createdBy: userId, createdAt: serverTimestamp(),
      isOptional: data.isOptional ?? false,
      ...(step.type === "flashcards" ? { studyMode: data.studyMode ?? "random" } : {}),
    });
  }
  // deleteStep decrements stepCount for each deletion after this batch commits.
  batch.update(doc(db, "modules", moduleId), {
    ...moduleData, stepCount: parsed.steps.length + plan.deletes.length, updatedAt: serverTimestamp(),
  });
  await batch.commit();
  for (const step of plan.deletes) await deleteStep(moduleId, step.id, step.type);
  return { moduleId };
}

function prepareData(step: ParsedStep, live?: Step): Record<string, unknown> {
  const data = { ...step.data };
  // Import metadata must never override server-managed or immutable fields.
  for (const key of ["id", "moduleId", "createdBy", "createdAt", "updatedAt", "order", "type", "title"]) delete data[key];
  if (step.type === "poll") {
    const options = data.options as { id?: string; text: string }[];
    data.options = options.map(option => ({ id: option.id ?? uuid(), text: option.text,
      votes: live?.type === "poll" ? live.options.find(previous => previous.id === option.id)?.votes ?? 0 : 0 }));
  }
  if (step.type === "sorting") {
    const buckets = (data.buckets as { id?: string; label: string }[]).map(bucket => ({ ...bucket, id: bucket.id ?? uuid() }));
    const cards = (data.cards as { id?: string; text: string }[]).map(card => ({ ...card, id: card.id ?? uuid() }));
    const answerKey: Record<string, string> = { ...(data.answerKey as Record<string, string> ?? {}) };
    for (const { cardIndex, bucketIndex } of (data.sortingAssignments ?? []) as { cardIndex: number; bucketIndex: number }[]) {
      if (!cards[cardIndex] || !buckets[bucketIndex]) throw new Error("Invalid sorting assignment.");
      answerKey[cards[cardIndex].id] = buckets[bucketIndex].id;
    }
    data.buckets = buckets; data.cards = cards; data.answerKey = answerKey;
    delete data.sortingAssignments;
  }
  if (step.type === "additionalResources") {
    const resources = data.resources as { all?: { name: string; url: string; type: string }[] };
    const all = (resources.all ?? []).map(resource => ({ ...resource, id: uuid() }));
    data.resources = { link: all.find(resource => resource.type === "link")?.url ?? "", pdf: all.find(resource => resource.type === "pdf")?.url ?? "", all };
  }
  return data;
}

function containsString(value: unknown, source: string): boolean {
  if (typeof value === "string") return value.includes(source);
  if (Array.isArray(value)) return value.some(item => containsString(item, source));
  return !!value && typeof value === "object" && Object.values(value).some(item => containsString(item, source));
}

function replaceStrings(value: unknown, source: string, replacement: string): unknown {
  if (typeof value === "string") return value.split(source).join(replacement);
  if (Array.isArray(value)) return value.map(item => replaceStrings(item, source, replacement));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceStrings(item, source, replacement)]));
  return value;
}
