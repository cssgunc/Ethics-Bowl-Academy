import { parseModule } from "../parse";

const frontmatter = `---
title: The Trolley Problem
description: Introduction to ethics
tags: [intro, ethics]
isPublic: true
---`;
const step = (type: string, body: string, title = "Title") => `<!-- step type="${type}" -->\n## ${title}\n${body}`;
const file = (body: string) => `${frontmatter}\n\n${body}`;
const valid = (body: string) => {
  const result = parseModule(file(body));
  expect(result.errors).toEqual([]);
  expect(result.module).not.toBeNull();
  return result.module!;
};
const invalid = (body: string, message: string) => {
  const result = parseModule(file(body));
  expect(result.module).toBeNull();
  expect(result.errors.some(e => e.message.includes(message))).toBe(true);
  return result.errors;
};

describe("parseModule", () => {
  test("parses a complete seven-type #130 fixture using canonical payloads", () => {
    const body = [
      `<!-- step id="st_1" type="video" -->
## Watch: The Trolley Problem
estimatedMinutes: 5
youtubeUrl: https://www.youtube.com/watch?v=example
thumbnailUrl: https://example.com/thumbnail.png
durationSec: 100
isOptional: true`,
      step("quiz", `passingScore: 70
shuffle: false

### Which principle focuses on outcomes?
- [x] Consequentialism
  > Right. It judges actions by their results.
  > Consider the consequences.
- [ ] Deontology
  > Deontology focuses on duties, not outcomes.

### A second question
- [ ] First
- [x] Second`),
      step("poll", `allowMultipleChoice: false

Would you pull the lever?

- Yes, pull it <!-- option id="op_1" -->
- No, don't pull it <!-- option id="op_2" -->`),
      step("sorting", `Drag each argument into its framework.

### Consequentialist <!-- bucket id="bk_1" -->
- Saving five lives outweighs one <!-- card id="cd_1" -->
### Deontological <!-- bucket id="bk_2" -->
- Killing is wrong regardless of outcome <!-- card id="cd_2" -->`),
      step("flashcards", "### Utilitarianism\nMaximizing overall well-being."),
      step("freeResponse", `maxLength: 2000
What would you do, and why?
![Diagram](https://example.com/image.png)

### Sample answer
I would pull the lever because...`),
      step("additionalResources", `- [Stanford Encyclopedia entry](https://plato.stanford.edu/)
- [Case study](https://example.com/case.pdf) (pdf)`),
    ].join("\n\n");
    const module = valid(body);
    expect(module.steps).toHaveLength(7);
    expect(module.steps[0]).toEqual({ id: "st_1", type: "video", title: "Watch: The Trolley Problem", line: 8, data: { estimatedMinutes: 5, youtubeUrl: "https://www.youtube.com/watch?v=example", thumbnailUrl: "https://example.com/thumbnail.png", durationSec: 100, isOptional: true } });
    expect(module.steps[1].data.questions).toEqual([
      { prompt: "Which principle focuses on outcomes?", choices: ["Consequentialism", "Deontology"], correctIndex: 0, choiceExplanations: ["Right. It judges actions by their results.\nConsider the consequences.", "Deontology focuses on duties, not outcomes."] },
      { prompt: "A second question", choices: ["First", "Second"], correctIndex: 1, choiceExplanations: [null, null] },
    ]);
    expect(module.steps[2].data).toMatchObject({ question: "Would you pull the lever?", options: [{ id: "op_1", text: "Yes, pull it" }, { id: "op_2", text: "No, don't pull it" }] });
    expect(module.steps[3].data).toMatchObject({ answerKey: { cd_1: "bk_1", cd_2: "bk_2" }, sortingAssignments: [{ cardIndex: 0, bucketIndex: 0 }, { cardIndex: 1, bucketIndex: 1 }] });
    expect(module.steps[4].data).toEqual({ cards: [{ front: "Utilitarianism", back: "Maximizing overall well-being." }] });
    expect(module.steps[5].data).toEqual({ maxLength: 2000, prompt: 'What would you do, and why?\n<img src="https://example.com/image.png" alt="Diagram" />', sampleAnswer: "I would pull the lever because..." });
    expect(module.steps[6].data.resources).toEqual({ link: "https://plato.stanford.edu/", pdf: "https://example.com/case.pdf", all: [{ name: "Stanford Encyclopedia entry", url: "https://plato.stanford.edu/", type: "link" }, { name: "Case study", url: "https://example.com/case.pdf", type: "pdf" }] });
    expect(parseModule(file(body))).toEqual(parseModule(file(body)));
  });

  test.each([
    ["video", "youtubeUrl: https://youtu.be/example", { youtubeUrl: "https://youtu.be/example" }],
    ["quiz", "passingScore: 0\nshuffle: true\n### Q\n- [x] A", { passingScore: 0, shuffle: true }],
    ["flashcards", "### Front\nBack", { cards: [{ front: "Front", back: "Back" }] }],
    ["freeResponse", "Prompt", { prompt: "Prompt" }],
    ["poll", "allowMultipleChoice: true\nQuestion\n- A\n- B", { question: "Question", options: [{ text: "A" }, { text: "B" }] }],
    ["sorting", "Prompt\n### A\n- Card\n### B", { buckets: [{ label: "A" }, { label: "B" }], cards: [{ text: "Card" }], answerKey: {}, sortingAssignments: [{ cardIndex: 0, bucketIndex: 0 }] }],
    ["additionalResources", "- [Reading](https://example.com)", { resources: { link: "https://example.com", pdf: "", all: [{ name: "Reading", url: "https://example.com", type: "link" }] } }],
  ])("accepts minimal %s without generating IDs or defaults", (type, body, expected) => {
    const parsed = valid(step(type as string, body as string)).steps[0];
    expect(parsed.data).toMatchObject(expected as object);
    expect(parsed).not.toHaveProperty("id");
    for (const key of ["createdBy", "createdAt", "updatedAt", "moduleId", "order", "isOptional", "estimatedMinutes"]) expect(parsed.data).not.toHaveProperty(key);
  });

  test("preserves module ID/timestamp, empty metadata, settings separated by blanks", () => {
    const result = parseModule(`---\nid: module-id\ntitle: Title\ndescription: ""\ntags: []\nisPublic: false\nupdatedAt: 2026-09-28T14:00:00Z\n---\n${step("video", "\nyoutubeUrl: https://youtu.be/example\n\nisOptional: false\n\nestimatedMinutes: 1.5")}`);
    expect(result.errors).toEqual([]);
    expect(result.module).toMatchObject({ id: "module-id", description: "", tags: [], isPublic: false, updatedAt: "2026-09-28T14:00:00Z" });
    expect(result.module!.steps[0].data).toMatchObject({ isOptional: false, estimatedMinutes: 1.5 });
  });

  test("preserves sorting file order, all existing/new ID combinations and Unsorted", () => {
    const data = valid(step("sorting", `Prompt
### Second <!-- bucket id="b2" -->
- Existing <!-- card id="c2" -->
- New
### Unsorted
- Loose <!-- card id="loose" -->
### First
- Existing card in new bucket <!-- card id="c1" -->
- New in new bucket`)).steps[0].data;
    expect(data.buckets).toEqual([{ id: "b2", label: "Second" }, { label: "First" }]);
    expect(data.cards).toEqual([{ id: "c2", text: "Existing" }, { text: "New" }, { id: "loose", text: "Loose" }, { id: "c1", text: "Existing card in new bucket" }, { text: "New in new bucket" }]);
    expect(data.answerKey).toEqual({ c2: "b2" });
    expect(data.sortingAssignments).toEqual([{ cardIndex: 0, bucketIndex: 0 }, { cardIndex: 1, bucketIndex: 0 }, { cardIndex: 3, bucketIndex: 1 }, { cardIndex: 4, bucketIndex: 1 }]);
  });

  test("retains reordered option IDs without votes", () => {
    expect(valid(step("poll", 'allowMultipleChoice: false\nQ\n- B <!-- option id="b" -->\n- A <!-- option id="a" -->')).steps[0].data.options).toEqual([{ id: "b", text: "B" }, { id: "a", text: "A" }]);
  });

  test("keeps module/step collisions separate from nested collection IDs", () => {
    const input = file([
      '<!-- step id="same" type="poll" -->\n## P\nallowMultipleChoice: false\nQ\n- A <!-- option id="same" -->\n- B',
      '<!-- step type="sorting" -->\n## S\nPrompt\n### A <!-- bucket id="same" -->\n- C <!-- card id="same" -->\n### B',
    ].join("\n")).replace("title: The Trolley Problem", "id: same\ntitle: The Trolley Problem");
    const result = parseModule(input);
    const duplicates = result.errors.filter(e => e.message.includes("appears twice"));
    expect(result.module).toBeNull();
    expect(duplicates.map(e => e.line)).toEqual([9]);
    expect(duplicates.every(e => e.message.includes("line 2"))).toBe(true);
  });

  test("converts images in text fields, escapes attributes and deduplicates filenames in source order", () => {
    const module = valid([
      step("freeResponse", `![a&"<>](<first image.png>)\n![again](first.png)\n![remote](https://example.com/a?x=1&y=2)\n### Sample answer\n![repeat](first.png)`),
      step("flashcards", "### ![front](front.png)\n![back](first.png)"),
      step("quiz", "passingScore: 100\nshuffle: false\n### ![Q](question.png)\n- [x] ![C](choice.png)\n  > ![E](explanation.png)"),
      step("poll", "allowMultipleChoice: false\n![Q](poll.png)\n- ![A](option.png)\n- B"),
      step("sorting", "![P](sort.png)\n### ![B](bucket.png)\n- ![C](card.png)\n### B"),
    ].join("\n"));
    expect(module.imageFilenames).toEqual(["first image.png", "first.png", "front.png", "question.png", "choice.png", "explanation.png", "poll.png", "option.png", "sort.png", "bucket.png", "card.png"]);
    expect(module.steps[0].data.prompt).toContain('<img src="first image.png" alt="a&amp;&quot;&lt;&gt;" />');
    expect(module.steps[0].data.prompt).toContain('src="https://example.com/a?x=1&amp;y=2"');
  });

  test.each(["../image.png", "/image.png", "images/image.png", "C:\\image.png", "file:image.png", "data:image/png;base64,x", "javascript:alert(1)", "//example.com/image.png"])("rejects unsupported image destination %s", destination => {
    invalid(step("freeResponse", `![image](${destination})`), "Unsupported image destination");
  });

  test.each(["```", "~~~~"])("preserves fenced code and ignores structural markers/images within %s", fence => {
    const literal = `${fence}md\n<!-- step type="debate" -->\n## Fake\n### Sample answer\n![code](ignored.png)\n${fence}`;
    const module = valid(step("freeResponse", `Prompt  \n\n${literal}\n\n  trailing whitespace  \n\n`));
    expect(module.steps).toHaveLength(1);
    expect(module.imageFilenames).toEqual([]);
    expect(module.steps[0].data.prompt).toBe(`Prompt  \n\n${literal}\n\n  trailing whitespace  `);
  });

  test("reports multiple independent errors with exact lines, equally for BOM and CRLF", () => {
    const input = file(step("quiz", "passingScore: 101\nshuffle: nope\n### Q\n- [ ] A") + "\n" + step("poll", "allowMultipleChoice: false\nQuestion\n- A"));
    const expected = [
      { line: 10, message: "passingScore must be between 0 and 100." },
      { line: 11, message: 'Setting "shuffle" must be boolean.' },
      { line: 12, message: "Question needs exactly one checked choice." },
      { line: 15, message: 'Poll "Title" needs at least 2 options.' },
    ];
    expect(parseModule(input)).toEqual({ module: null, errors: expected });
    expect(parseModule("\uFEFF" + input.replace(/\n/g, "\r\n"))).toEqual({ module: null, errors: expected });
  });

  test("preserves fenced examples inside quiz explanation blockquotes", () => {
    const module = valid(step("quiz", "passingScore: 70\nshuffle: false\n### Q\n- [x] A\n  > ```md\n  > ![literal](ignored.png)\n  > ### Literal heading\n  > ```"));
    expect(module.imageFilenames).toEqual([]);
    expect(module.steps[0].data.questions).toEqual([{ prompt: "Q", choices: ["A"], correctIndex: 0, choiceExplanations: ["```md\n![literal](ignored.png)\n### Literal heading\n```"] }]);
  });

  test.each([
    ["quiz", "passingScore: 70\nshuffle: false\n### Q\n- [ ] A", "exactly one checked"],
    ["quiz", "passingScore: 70\nshuffle: false\n### Q\n- [x] A\n- [x] B", "exactly one checked"],
    ["quiz", "passingScore: 70\nshuffle: false", "at least one question"],
    ["quiz", "passingScore: 70\nshuffle: false\n###\n- [x]", "must not be blank"],
    ["quiz", "passingScore: 70\nshuffle: false\n### Q", "at least one choice"],
    ["flashcards", "", "at least one card"],
    ["flashcards", "### Front", "Card back must not be blank"],
    ["flashcards", "###\nBack", "Card front must not be blank"],
    ["freeResponse", "### Sample answer\nAnswer", "prompt must not be blank"],
    ["freeResponse", "Prompt\n### Other\nText", "Only one ### Sample answer"],
    ["freeResponse", "Prompt\n### Sample answer\nA\n### Sample answer\nB", "Only one ### Sample answer"],
    ["poll", "allowMultipleChoice: false\n- A\n- B", "question must not be blank"],
    ["poll", 'allowMultipleChoice: false\nQ\n- <!-- option id="a" -->\n- B', "option must not be blank"],
    ["sorting", "Prompt\n### A", "at least 2 buckets"],
    ["sorting", "Prompt\n### A\n### B", "at least one card"],
    ["sorting", "### A\n- C\n### B", "prompt must not be blank"],
    ["sorting", "Prompt\n###\n- C\n### B", "Bucket label must not be blank"],
    ["sorting", 'Prompt\n### A\n- <!-- card id="c" -->\n### B', "Sorting card must not be blank"],
    ["video", "", "Missing required setting"],
    ["video", 'youtubeUrl: ""', "youtubeUrl must not be blank"],
    ["additionalResources", "", "at least one resource"],
    ["additionalResources", "- [](https://example.com)", "Resource name must not be blank"],
    ["additionalResources", "- [R](javascript:alert)", "Resource URL must be a valid"],
  ])("validates required content: %s %s", (type, body, message) => { invalid(step(type, body), message); });

  test.each([
    ["video", "youtubeUrl: https://example.com\nunknown: true", "Unexpected video body"],
    ["video", "youtubeUrl: https://example.com\nyoutubeUrl: https://example.com", "Duplicate setting"],
    ["video", "youtubeUrl: 1", "must be string"],
    ["video", "youtubeUrl: https://example.com\ndurationSec: 1.5", "must be integer"],
    ["video", "youtubeUrl: https://example.com\nisOptional: yes", "must be boolean"],
    ["video", "youtubeUrl: https://example.com\nestimatedMinutes: .inf", "must be number"],
    ["freeResponse", "maxLength: 0\nPrompt", "between 1 and 10,000"],
    ["freeResponse", "maxLength: 10001\nPrompt", "between 1 and 10,000"],
    ["freeResponse", "maxLength: 1.5\nPrompt", "must be integer"],
    ["quiz", "passingScore: -1\nshuffle: false\n### Q\n- [x] A", "between 0 and 100"],
    ["poll", "Q\n- A\n- B", "Missing required setting"],
    ["quiz", "### Q\n- [x] A", "Missing required setting"],
  ])("validates settings: %s %s", (type, body, message) => { invalid(step(type, body), message); });

  test.each([1, 10000])("accepts maxLength boundary %d", max => { valid(step("freeResponse", `maxLength: ${max}\nPrompt`)); });

  test.each([
    ["", "Module must begin"],
    ["---\ntitle: T", "missing its closing"],
    ["---\n- not a mapping\n---", "must be a YAML mapping"],
    [frontmatter.replace("title: The Trolley Problem", "title: T\ntitle: Other"), "Map keys must be unique"],
    [frontmatter.replace("title: The Trolley Problem", 'title: ""'), "title must be a nonblank"],
    [frontmatter.replace("description: Introduction to ethics", "description: 1"), "description must be a string"],
    [frontmatter.replace("tags: [intro, ethics]", "tags: [intro, 1]"), "tags must be an array"],
    [frontmatter.replace("isPublic: true", 'isPublic: "true"'), "isPublic must be a boolean"],
    [frontmatter.replace("isPublic: true", "isPublic: true\nunknown: user"), "Unsupported module metadata"],
    [frontmatter.replace("isPublic: true", "isPublic: true\nid: 123"), "ID must be a nonblank"],
    [frontmatter.replace("isPublic: true", "isPublic: true\nupdatedAt: 2026-02-30T12:00:00Z"), "valid timestamp"],
    [frontmatter.replace("isPublic: true", "isPublic: true\nupdatedAt: 123"), "valid timestamp"],
    [frontmatter.replace("isPublic: true", "isPublic: true\nupdatedAt: yesterday"), "valid timestamp"],
  ])("rejects malformed frontmatter", (input, message) => {
    const result = parseModule(input);
    expect(result.module).toBeNull();
    expect(result.errors.some(e => e.message.includes(message))).toBe(true);
  });

  test.each([
    ['<!-- step type="debate" -->\n## Debate', "Missing required debate section"],
    ['<!-- step type="unknown" -->\n## Unknown', "Unsupported step type"],
    ['<!-- step type="video" extra="x" -->\n## Video', "Malformed step marker"],
    ['<!-- step type="video" type="video" -->\n## Video\nyoutubeUrl: https://example.com', "Duplicate step attribute"],
    ['<!-- step id="s" -->\n## Video', "Unsupported step type"],
    ['<!-- step type="video" -->\n##', "nonblank ## title"],
    [step("freeResponse", "Prompt\n## Unexpected"), "Misplaced section"],
    [step("freeResponse", "Prompt\n<!-- option id=\"bad\" -->"), "Misplaced section"],
    [step("video", "youtubeUrl: https://example.com\nBody"), "Unexpected video body"],
    [step("poll", 'allowMultipleChoice: false\nQ\n- A <!-- card id="bad" -->\n- B'), "Malformed or misplaced option"],
    [step("quiz", "passingScore: 50\nshuffle: false\n### Q\n> orphan\n- [x] A"), "Misplaced section"],
    [step("freeResponse", "Prompt\n```\ncode"), "Unclosed fenced"],
  ])("reports malformed or misplaced structures", (input, message) => { invalid(input, message); });

  test("recovers at subsequent step and question boundaries", () => {
    const errors = invalid('<!-- step broken -->\n## Broken\n' + step("quiz", "passingScore: 50\nshuffle: false\n### First\n- [ ] A\n### Second\n- [x] B\n- [x] C") + "\n" + step("freeResponse", ""), "Malformed step marker");
    expect(errors.filter(e => e.message.includes("exactly one checked"))).toHaveLength(2);
    expect(errors.some(e => e.message.includes("Free response prompt"))).toBe(true);
    expect(errors.map(e => e.line)).toEqual([...errors.map(e => e.line)].sort((a, b) => a - b));
  });

  test("invalid YAML aliases return errors instead of throwing", () => {
    invalid(step("video", "youtubeUrl: *missing"), "Invalid YAML alias");
    const result = parseModule(frontmatter.replace("tags: [intro, ethics]", "tags: *missing"));
    expect(result.module).toBeNull();
    expect(result.errors.some(e => e.message.includes("Invalid YAML aliases"))).toBe(true);
  });

  test("reports misplaced settings and unattached sorting cards", () => {
    invalid(step("freeResponse", "Prompt\nmaxLength: 2"), "Misplaced setting");
    invalid(step("freeResponse", "Prompt\nmaxLength:2"), "Misplaced setting");
    invalid(step("sorting", "Prompt\n- Orphan card\n### A\n- C\n### B"), "Misplaced section");
    invalid('<!-- step type="video"id="s" -->\n## V\nyoutubeUrl: https://example.com', "Malformed step marker");
  });

  test("invalid module images cannot return a partial module", () => {
    const result = parseModule(frontmatter.replace("description: Introduction to ethics", "description: '![bad](../bad.png)'"));
    expect(result.module).toBeNull();
    expect(result.errors).toEqual([{ line: 3, message: 'Unsupported image destination "../bad.png"; use an HTTP(S) URL or a bare filename.' }]);
  });

  test("module images precede step images in the filename list", () => {
    const result = parseModule(file(step("freeResponse", "![step](step.png)")).replace("description: Introduction to ethics", "description: '![module](module.png)'"));
    expect(result.errors).toEqual([]);
    expect(result.module!.imageFilenames).toEqual(["module.png", "step.png"]);
  });

  test("has no runtime dependency on Firebase initialization or database operations", () => {
    jest.isolateModules(() => {
      jest.doMock("@/lib/firebase/firebaseConfig", () => { throw new Error("Firebase initialization must not run"); });
      jest.doMock("@/lib/firebase/db-operations", () => { throw new Error("Database operations must not load"); });
      const pureParser = jest.requireActual<typeof import("../parse")>("../parse");
      expect(pureParser.parseModule(file(step("freeResponse", "Prompt"))).errors).toEqual([]);
    });
  });
});
