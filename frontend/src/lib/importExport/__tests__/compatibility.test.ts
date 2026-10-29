import { parseModule } from "../parse";

const file = (type: string, body: string) => `---\ntitle: Title\ndescription: ""\ntags: []\nisPublic: false\n---\n<!-- step type="${type}" -->\n## Title\n${body}`;
const debate = (turns: string | number) => `maxStudentTurns: ${turns}\n### Context\nContext\n### Starting question\nQuestion`;

test.each([3, 10])("accepts debate turn boundary %d", turns => {
  expect(parseModule(file("debate", debate(turns)))).toMatchObject({ errors: [], module: { steps: [{ data: { maxStudentTurns: turns, modulePrompt: "Context", startQuestion: "Question" } }] } });
});
test.each([2, 11, 3.5, '"3"', "true"])("rejects invalid debate turns %s", turns => {
  expect(parseModule(file("debate", debate(turns))).errors[0].line).toBe(9);
});
test.each([
  "### Context\nContext\n### Starting question\nQuestion",
  "maxStudentTurns: 3\n### Context\nContext",
  "maxStudentTurns: 3\n### Starting question\nQuestion",
  debate(3).replace("\nContext\n", "\n\n"),
  debate(3).replace("\nQuestion", "\n "),
  debate(3) + "\n### Context\nAgain",
  debate(3) + "\n### Starting question\nAgain",
])("rejects missing, blank or duplicate debate requirements", body => {
  const result = parseModule(file("debate", body));
  expect(result.module).toBeNull();
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors.every(e => e.line >= 8)).toBe(true);
});
test("debate preserves fenced code and converts images", () => {
  const result = parseModule(file("debate", debate(3).replace("\nContext\n", "\n![context](context.png)\n```md\n### Literal\n![skip](skip.png)\n```\n")));
  expect(result.errors).toEqual([]);
  expect(result.module!.imageFilenames).toEqual(["context.png"]);
  expect(result.module!.steps[0].data.modulePrompt).toContain('src="context.png"');
  expect(result.module!.steps[0].data.modulePrompt).toContain("### Literal\n![skip](skip.png)");
});
test.each(["spaced", "random"])("parses studyMode %s", mode => {
  expect(parseModule(file("flashcards", `studyMode: ${mode}\n### Front\nBack`))).toMatchObject({ errors: [], module: { steps: [{ data: { studyMode: mode } }] } });
});
test("studyMode is optional and validated", () => {
  expect(parseModule(file("flashcards", "### Front\nBack")).module!.steps[0].data).not.toHaveProperty("studyMode");
  expect(parseModule(file("flashcards", "studyMode: other\n### Front\nBack")).errors).toHaveLength(1);
});
test.each([
  "### Explanation\nOrphan\n### Q\n- [x] A",
  "### Q\n- [x] A\n### Explanation\nFirst\n### Explanation\nSecond",
  "### Explanation <!-- explanation -->\nOrphan",
  "### Q <!-- question -->\n- [x] A\n### Explanation <!-- explanation -->\nFirst\n### Explanation <!-- explanation -->\nSecond",
])("rejects orphaned or duplicate quiz explanations", body => {
  const result = parseModule(file("quiz", "passingScore: 70\nshuffle: false\n" + body));
  expect(result.errors.some(e => e.message.includes("Orphaned or duplicate"))).toBe(true);
});

test("rejects ambiguous legacy Explanation questions with a source-line diagnostic", () => {
  const result = parseModule(file("quiz", "passingScore: 70\nshuffle: false\n### First\n- [x] A\n### Explanation\n- [x] B"));
  expect(result.module).toBeNull();
  expect(result.errors).toEqual([{ line: 13, message: expect.stringContaining("Ambiguous") }]);
});

test("retains unambiguous legacy question feedback", () => {
  const result = parseModule(file("quiz", "passingScore: 70\nshuffle: false\n### First\n- [x] A\n### Explanation\nFeedback\n```md\n- [x] Literal code\n```"));
  expect(result.errors).toEqual([]);
  expect(result.module!.steps[0].data.questions).toMatchObject([{ prompt: "First", explanation: "Feedback\n```md\n- [x] Literal code\n```" }]);
});

test.each([
  "### Q <!-- question --> <!-- question -->",
  "### Q <!-- question id=\"x\" -->",
  "### Q <!-- question --",
  "### Wrong <!-- explanation -->",
])("rejects malformed quiz markers: %s", heading => {
  const result = parseModule(file("quiz", `passingScore: 70\nshuffle: false\n${heading}\n- [x] A`));
  expect(result.module).toBeNull();
  expect(result.errors).toContainEqual({ line: 11, message: expect.stringMatching(/Malformed|Feedback must/) });
});

test.each([
  ["poll", 'allowMultipleChoice: false\nQ\n- A <!-- option id="1" -->\n- B <!-- option id="1" -->'],
  ["sorting", 'Sort\n### A <!-- bucket id="1" -->\n- A <!-- card id="c" -->\n### B <!-- bucket id="1" -->'],
  ["sorting", 'Sort\n### A <!-- bucket id="1" -->\n- A <!-- card id="c" -->\n### B <!-- bucket id="2" -->\n- B <!-- card id="c" -->'],
])("rejects duplicate IDs within a %s collection", (type, body) => {
  const result = parseModule(file(type, body));
  expect(result.module).toBeNull();
  expect(result.errors.some(e => e.message.includes("appears twice"))).toBe(true);
});
test("unknown colon-prefixed prose is never parsed as YAML", () => {
  const prompt = "Scenario: [invalid YAML\nMore prose\nAnother: {not YAML";
  expect(parseModule(file("freeResponse", prompt))).toMatchObject({ errors: [], module: { steps: [{ data: { prompt } }] } });
});
test("ignores the explicit site metadata set and retains module identity", () => {
  const markdown = file("video", "createdBy: user\ncreatedAt: yesterday\nupdatedAt: now\norder: 2\nmoduleId: m\nyoutubeUrl: https://example.com")
    .replace("title: Title", "id: m\nupdatedAt: 2026-09-28T14:00:00Z\ncreatedBy: user\ncreatedAt: yesterday\norder: 2\nstepCount: 1\ncollaborators: []\npublishedVersion: 3\nthumbnailUrl: image\ntitle: Title");
  const result = parseModule(markdown);
  expect(result.errors).toEqual([]);
  expect(result.module).toMatchObject({ id: "m", updatedAt: "2026-09-28T14:00:00Z" });
  expect(result.module!.steps[0].data).toEqual({ youtubeUrl: "https://example.com" });
});
