import type { Module, Step, StepBase } from "@/lib/firebase/types";
import type { ParsedModule, ParsedStep } from "../types";
import { planImport } from "../planImport";

const date = new Date("2026-09-28T14:00:00Z");
const moduleFixture: Module = { id: "module", title: "Module", description: "", tags: [], isPublic: false, createdBy: "author", createdAt: date, updatedAt: date, stepCount: 0 };
const base: Omit<StepBase, "type"> = { id: "step", moduleId: "module", title: "Live title", order: 0, isOptional: false, createdBy: "author", createdAt: date, updatedAt: date };
const liveVideo = (id: string): Step => ({ ...base, id, type: "video", youtubeUrl: "https://example.com" });
const parsedVideo = (id?: string): ParsedStep => ({ ...(id === undefined ? {} : { id }), type: "video", title: "Video", line: 12, data: { youtubeUrl: "https://example.com" } });
const parsedModule = (steps: ParsedStep[] = [], id: string | undefined = "module"): ParsedModule => ({ id, title: "Module", description: "", tags: [], isPublic: false, steps, imageFilenames: [] });
const poll: Step = { ...base, id: "poll", type: "poll", question: "Q", allowMultipleChoice: false, options: [
  { id: "yes", text: "Live yes", votes: 5 }, { id: "no", text: "Live no", votes: 0 }, { id: "maybe", text: "Live maybe", votes: 2 },
] };
const parsedPoll = (options: unknown[], id: string | undefined = "poll"): ParsedStep => ({ id, type: "poll", title: "Edited poll", line: 20, data: { options } });
const sorting: Step = { ...base, id: "sort", type: "sorting", prompt: "Sort", buckets: [{ id: "b1", label: "A" }, { id: "b2", label: "B" }], cards: [{ id: "c1", text: "Card" }, { id: "c2", text: "Unsorted" }], answerKey: { c1: "b1" } };

test("initializes empty new plans and ignores unrelated live data", () => {
  const file = { ...parsedModule(), id: undefined };
  expect(planImport(file, moduleFixture, [poll])).toEqual({ isNewModule: true, isStale: false, creates: [], updates: [], deletes: [], removedPollOptions: [], errors: [] });
});
test("populated new modules create every step without generating IDs", () => {
  const steps = [parsedVideo(), { ...parsedPoll([{ text: "New" }]), id: undefined }];
  const file = { ...parsedModule(steps), id: undefined, updatedAt: "2020-01-01T00:00:00Z" };
  const plan = planImport(file, moduleFixture, [poll]);
  expect(plan).toMatchObject({ isNewModule: true, isStale: false, creates: steps, updates: [], deletes: [], errors: [] });
  expect(plan.creates[0]).toBe(steps[0]);
});
test("new modules reject copied step and nested IDs", () => {
  const steps = [parsedPoll([{ id: "yes", text: "Yes" }])];
  const plan = planImport({ ...parsedModule(steps), id: undefined }, moduleFixture, [poll]);
  expect(plan.creates).toEqual(steps);
  expect(plan.errors).toHaveLength(2);
  expect(plan.errors.every(e => e.line === 20 && e.message.includes("Remove copied IDs"))).toBe(true);
  expect(plan.deletes).toEqual([]);
});
test("classifies unchanged/reordered matches and new steps in file order; deletes in live order", () => {
  const live = [liveVideo("a"), liveVideo("b"), liveVideo("c"), liveVideo("d")];
  const steps = [parsedVideo("c"), parsedVideo(), parsedVideo("a"), parsedVideo()];
  const plan = planImport(parsedModule(steps), moduleFixture, live);
  expect(plan.errors).toEqual([]);
  expect(plan.updates).toEqual([{ parsed: steps[0], live: live[2] }, { parsed: steps[2], live: live[0] }]);
  expect(plan.creates).toEqual([steps[1], steps[3]]);
  expect(plan.deletes).toEqual([live[1], live[3]]);
});
test.each([null, { ...moduleFixture, id: "other" }])("rejects missing or mismatched live module without deleting unrelated steps", live => {
  const plan = planImport(parsedModule([parsedVideo("a")]), live, [liveVideo("a"), poll]);
  expect(plan.errors[0]).toMatchObject({ line: 1 });
  expect(plan.deletes).toEqual([]);
  expect(plan.updates).toEqual([]);
  expect(plan.creates).toEqual([]);
});
test("unknown IDs are errors, never creates", () => {
  const plan = planImport(parsedModule([parsedVideo("unknown")]), moduleFixture, []);
  expect(plan.errors).toEqual([expect.objectContaining({ line: 12, message: expect.stringContaining("Unknown step ID") })]);
  expect(plan.creates).toEqual([]);
});
test("rejects step type changes without deleting the original", () => {
  const plan = planImport(parsedModule([parsedVideo("poll")]), moduleFixture, [poll]);
  expect(plan.errors[0].message).toContain("Cannot change step");
  expect(plan.updates).toEqual([]);
  expect(plan.deletes).toEqual([]);
});
test("detects duplicate step IDs and module/step collisions", () => {
  const plan = planImport(parsedModule([parsedVideo("a"), parsedVideo("a"), parsedVideo("module")]), moduleFixture, [liveVideo("a")]);
  expect(plan.errors.filter(e => e.message.includes("Duplicate ID"))).toHaveLength(2);
  expect(plan.updates).toHaveLength(1);
});
test("retains nested IDs, allows missing IDs, and reports only removed positive vote counts", () => {
  const step = parsedPoll([{ id: "yes", text: "Changed" }, { text: "New" }]);
  const plan = planImport(parsedModule([step]), moduleFixture, [poll]);
  expect(plan.errors).toEqual([]);
  expect(plan.removedPollOptions).toEqual([{ stepTitle: "Live title", optionText: "Live maybe", votes: 2 }]);
  expect(step.data.options).toEqual([{ id: "yes", text: "Changed" }, { text: "New" }]);
});
test("includes voted options from deleted polls exactly once", () => {
  const plan = planImport(parsedModule(), moduleFixture, [poll]);
  expect(plan.deletes).toEqual([poll]);
  expect(plan.removedPollOptions).toEqual([
    { stepTitle: "Live title", optionText: "Live yes", votes: 5 }, { stepTitle: "Live title", optionText: "Live maybe", votes: 2 },
  ]);
});
test("retaining all voted options suppresses warnings", () => {
  expect(planImport(parsedModule([parsedPoll([{ id: "yes" }, { id: "maybe" }])]), moduleFixture, [poll]).removedPollOptions).toEqual([]);
});
test("unknown and cross-parent poll IDs fail", () => {
  const other: Step = { ...poll, id: "other", options: [{ id: "foreign", text: "Other", votes: 1 }] };
  const plan = planImport(parsedModule([parsedPoll([{ id: "foreign" }, { id: "unknown" }])]), moduleFixture, [poll, other]);
  expect(plan.errors).toHaveLength(2);
  expect(plan.errors.every(e => e.line === 20 && e.message.includes("Unknown options ID"))).toBe(true);
});
test("new steps cannot retain nested IDs from existing steps", () => {
  const step = { ...parsedPoll([{ id: "yes" }]), id: undefined };
  expect(planImport(parsedModule([step]), moduleFixture, [poll]).errors[0].message).toContain("Unknown options ID");
});
test("rejects duplicate nested IDs", () => {
  const plan = planImport(parsedModule([parsedPoll([{ id: "yes" }, { id: "yes" }])]), moduleFixture, [poll]);
  expect(plan.errors[0].message).toContain("Duplicate ID");
});

test("scopes reused nested IDs and vote removal warnings to each poll", () => {
  const other: Step = { ...poll, id: "other" };
  const plan = planImport(parsedModule([
    parsedPoll(poll.options), parsedPoll([{ id: "no" }, { id: "maybe" }], "other"),
  ]), moduleFixture, [poll, other]);
  expect(plan.errors).toEqual([]);
  expect(plan.updates).toHaveLength(2);
  expect(plan.removedPollOptions).toEqual([{ stepTitle: other.title, optionText: "Live yes", votes: 5 }]);
});

test.each(["buckets", "cards"])("rejects duplicate sorting %s", key => {
  const step: ParsedStep = { id: "sort", type: "sorting", title: "Sort", line: 30,
    data: { buckets: sorting.buckets, cards: sorting.cards, [key]: key === "buckets" ? [sorting.buckets[0], sorting.buckets[0]] : [sorting.cards[0], sorting.cards[0]] } };
  expect(planImport(parsedModule([step]), moduleFixture, [sorting]).errors[0].message).toContain("Duplicate ID");
});

test.each([123.999, -123.999])("normalizes fractional live milliseconds %s like Date", millis => {
  for (const offset of [-1, 0, 1]) {
    const updatedAt = new Date(Math.trunc(millis) + offset).toISOString();
    const plan = planImport({ ...parsedModule(), updatedAt }, { ...moduleFixture, updatedAt: { toMillis: () => millis } as unknown as Date }, []);
    expect(plan.errors).toEqual([]);
    expect(plan.isStale).toBe(offset < 0);
  }
});
test("preserves sorting assignments across existing/new cards, buckets and unsorted cards", () => {
  const assignments = [{ cardIndex: 0, bucketIndex: 1 }, { cardIndex: 1, bucketIndex: 0 }, { cardIndex: 2, bucketIndex: 1 }];
  const step: ParsedStep = { id: "sort", type: "sorting", title: "Sort", line: 30, data: {
    buckets: [{ id: "b1", label: "A" }, { label: "New" }], cards: [{ id: "c1", text: "Card" }, { text: "New" }, { text: "Other" }, { id: "c2", text: "Unsorted" }],
    sortingAssignments: assignments, answerKey: {},
  } };
  const plan = planImport(parsedModule([step]), moduleFixture, [sorting]);
  expect(plan.errors).toEqual([]);
  expect(plan.updates[0].parsed.data.sortingAssignments).toBe(assignments);
  expect(plan.updates[0].parsed.data.answerKey).toEqual({});
});
test("rejects wrong-kind and unknown sorting IDs", () => {
  const step: ParsedStep = { id: "sort", type: "sorting", title: "Sort", line: 30, data: { buckets: [{ id: "c1" }, { id: "unknown" }], cards: [{ id: "b1" }] } };
  const plan = planImport(parsedModule([step]), moduleFixture, [sorting]);
  expect(plan.errors).toHaveLength(3);
  expect(plan.errors.every(e => e.line === 30 && e.message.startsWith("Unknown"))).toBe(true);
});
test.each([
  ["2026-09-28T13:59:59Z", true], ["2026-09-28T14:00:00Z", false],
  ["2026-09-28T14:00:01Z", false], ["2026-09-28T10:00:00-04:00", false],
  ["2026-09-28T09:59:59-04:00", true], [undefined, false],
])("compares file timestamp %s", (updatedAt, isStale) => {
  for (const liveTime of [date, { toMillis: () => date.getTime() }, { toDate: () => date }]) {
    const plan = planImport({ ...parsedModule(), updatedAt }, { ...moduleFixture, updatedAt: liveTime as Date }, []);
    expect(plan.errors).toEqual([]);
    expect(plan.isStale).toBe(isStale);
  }
});
test.each(["yesterday", "2026-02-30T12:00:00Z", "", "2026-13-01T12:00:00Z"])("invalid file timestamp %s is an error", updatedAt => {
  const plan = planImport({ ...parsedModule(), updatedAt }, moduleFixture, []);
  expect(plan.errors).toEqual([{ line: 1, message: "File updatedAt must be a valid timestamp." }]);
  expect(plan.isStale).toBe(false);
});
test.each([new Date(NaN), { toMillis: () => NaN }, { toDate: () => "bad" }, { toMillis: () => { throw new Error("bad"); } }, undefined])("invalid live timestamp is an error", updatedAt => {
  expect(planImport(parsedModule(), { ...moduleFixture, updatedAt: updatedAt as Date }, []).errors[0].line).toBe(1);
});
test("unrelated live steps are errors and cannot become deletions", () => {
  const plan = planImport(parsedModule(), moduleFixture, [{ ...poll, moduleId: "other" }]);
  expect(plan.errors).toHaveLength(1);
  expect(plan.deletes).toEqual([]);
});
test("is deterministic and does not mutate deeply frozen inputs", () => {
  function freeze<T>(value: T): T {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  const file = freeze(parsedModule([parsedPoll([{ id: "yes" }, { text: "New" }]), parsedVideo()]));
  const live = freeze([poll, liveVideo("deleted")]);
  const module = freeze(moduleFixture);
  const before = JSON.stringify({ file, live, module });
  expect(planImport(file, module, live)).toEqual(planImport(file, module, live));
  expect(JSON.stringify({ file, live, module })).toBe(before);
});
test("does not load Firebase initialization or database operations", () => {
  jest.isolateModules(() => {
    jest.doMock("@/lib/firebase/firebaseConfig", () => { throw new Error("No Firebase initialization"); });
    jest.doMock("@/lib/firebase/db-operations", () => { throw new Error("No database operations"); });
    const pure = jest.requireActual<typeof import("../planImport")>("../planImport");
    expect(pure.planImport(parsedModule(), moduleFixture, []).errors).toEqual([]);
  });
});
