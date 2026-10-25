import { serializeModule, type ExportModule } from "@/lib/module-markdown";
import type { Step, StepBase } from "@/lib/firebase/types";
import { parseModule } from "../parse";

const date = new Date("2026-09-28T14:00:00Z");
const base: Omit<StepBase, "type"> = {
  id: "step", moduleId: "module", title: "Title", order: 0, isOptional: false,
  createdBy: "author", createdAt: date, updatedAt: date, estimatedMinutes: 5,
};
const fixtures: Step[] = [
  { ...base, type: "video", youtubeUrl: "https://youtu.be/test", durationSec: 0, thumbnailUrl: "https://example.com/image.png" },
  { ...base, type: "quiz", passingScore: 70, shuffle: false, questions: [
    { prompt: "Question\nMore context", choices: ["Yes\nBecause", "No"], correctIndex: 0, choiceExplanations: ["Correct\nDetails", null], explanation: "First explanation" },
    { prompt: "Second question", choices: ["A", "B"], correctIndex: 1, explanation: "Second explanation" },
  ] },
  { ...base, type: "flashcards", studyMode: "random", cards: [{ front: "Front", back: "Back\nMore" }] },
  { ...base, type: "freeResponse", prompt: "Scenario: consider this\nAnother: detail", sampleAnswer: "Answer", maxLength: 1000 },
  { ...base, type: "poll", question: "Scenario: choose", allowMultipleChoice: false, options: [
    { id: "yes", text: "Yes\nReason\nMore", votes: 4 }, { id: "no", text: "No", votes: 0 },
  ] },
  { ...base, type: "sorting", prompt: "Sort", buckets: [{ id: "b1", label: "First" }, { id: "b2", label: "Second" }],
    cards: [{ id: "c1", text: "Card\nDetails\nMore" }, { id: "c2", text: "Loose" }], answerKey: { c1: "b1" } },
  { ...base, type: "additionalResources", resources: { link: "https://example.com/legacy", pdf: "", all: [
    { id: "resource", name: "Case [study] \\ notes", url: "https://example.com/case (1).pdf", type: "pdf" },
  ] } },
  { ...base, type: "debate", maxStudentTurns: 3, modulePrompt: "Scenario: context\n```md\n### Literal\n```", startQuestion: "What do you think?" },
];
function exported(step: Step): string {
  const module: ExportModule = {
    id: "module", title: "Module", description: "Description", tags: ["ethics"], isPublic: false,
    createdBy: "author", createdAt: date, updatedAt: date, stepCount: 1, collaborators: ["editor"],
    publishedVersion: 2, thumbnailUrl: "https://example.com/thumbnail.png", steps: [step],
  };
  return serializeModule(module);
}

test.each(fixtures)("round trips $type with saved metadata", step => {
  const result = parseModule(exported(step));
  expect(result.errors).toEqual([]);
  expect(result.module).toMatchObject({ id: "module", updatedAt: date.toISOString() });
  const parsed = result.module!.steps[0];
  expect(parsed).toMatchObject({ id: step.id, type: step.type, title: step.title });
  const { id, type, title, moduleId, order, createdAt, updatedAt, createdBy, ...payload } = step;
  void id; void type; void title; void moduleId; void order; void createdAt; void updatedAt; void createdBy;
  const expected: Record<string, unknown> = payload;
  if (step.type === "poll") expected.options = step.options.map(({ id, text }) => ({ id, text }));
  if (step.type === "additionalResources") expected.resources = {
    link: "", pdf: "https://example.com/case%20%281%29.pdf",
    all: [{ name: "Case [study] \\ notes", url: "https://example.com/case%20%281%29.pdf", type: "pdf" }],
  };
  expect(parsed.data).toMatchObject(expected);
  for (const field of ["createdBy", "createdAt", "updatedAt", "moduleId", "order"]) expect(parsed.data).not.toHaveProperty(field);
  expect(result.module).not.toHaveProperty("createdBy");
});

test("readable bodies win over structured backups, including removed items and metadata", () => {
  const poll = fixtures.find(s => s.type === "poll")!;
  const withExtras = { ...poll, options: [{ id: "yes", text: "Yes", votes: 9, color: "blue", createdBy: "author" }, { id: "no", text: "No", votes: 0 }] } as Step;
  const markdown = exported(withExtras).replace('- Yes <!--', '- Edited <!--');
  const result = parseModule(markdown);
  expect(result.errors).toEqual([]);
  expect(result.module!.steps[0].data.options).toEqual([{ id: "yes", text: "Edited" }, { id: "no", text: "No" }]);
});

test.each(["quiz", "flashcards", "sorting"])("ignores extra nested backup fields for %s", type => {
  const source = fixtures.find(s => s.type === type)!;
  const key = type === "quiz" ? "questions" : "cards";
  const items = (source as unknown as Record<string, Record<string, unknown>[]>)[key];
  const step = { ...source, [key]: items.map(item => ({ ...item, extra: "backup", updatedAt: date })) } as Step;
  const parsed = parseModule(exported(step));
  expect(parsed.errors).toEqual([]);
  expect(JSON.stringify(parsed.module!.steps[0].data)).not.toContain("backup");
});
