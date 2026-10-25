# Markdown parser (#132)

`parseModule` reads the [#130 format](https://github.com/cssgunc/Ethics-Bowl-Academy/issues/130)
without contacting Firebase or generating IDs. Errors use one-based source lines;
any error makes `module` null. All eight canonical step types are supported.
Debates require integer `maxStudentTurns` (3–10), nonblank `### Context`, and
nonblank `### Starting question`, each occurring exactly once.

Optional settings and IDs stay absent when omitted. Poll options have no vote
counts, and resources have no generated IDs. The planner (#135) checks IDs against
live data and detects stale timestamps. The upload dialog (#137) checks that all
`imageFilenames` have accompanying files; the apply stage (#136) uploads them and
replaces the preserved filenames in image tags.

## Export compatibility and precedence

Flashcards accept optional `studyMode: spaced` or `studyMode: random` without a
default. A quiz `### Explanation` belongs to the preceding question, alongside
its per-choice blockquotes; orphaned and duplicate explanation sections fail.
`Explanation` is therefore reserved as a quiz section heading.
Two-space-indented continuation lines preserve multiline quiz choices, poll
options and sorting cards. Quiz prompt lines before the first choice are retained.

Module `id` and `updatedAt` are retained. Site metadata (`createdBy`, `createdAt`,
`moduleId`, `order`, `votes`, `stepCount`, `collaborators`, `publishedVersion`) is
ignored, as are module `thumbnailUrl` and step `updatedAt`. Video `thumbnailUrl`
remains editable. Unknown module frontmatter fields fail validation.
Step settings stop at the first unknown key, retaining that line and the rest as
body text. Thus `Scenario: ...` is ordinary prose, even if its value is invalid YAML.
Recognized editable settings still require valid values and placement.

Readable bodies are authoritative. Serializer backup settings (`questions`,
`options`, `cards`, `buckets`, `resources`, where applicable) must be valid YAML
arrays (or an object for resources), but their contents are not imported. Extra
nested fields, resource IDs, votes and timestamps cannot override body edits or
reintroduce deleted items. This deliberately preserves the existing apply contract:
resources contain `{ link, pdf, all }`, with `all` entries containing only
`{ name, url, type }`; the apply stage creates resource IDs. `link` and `pdf` are
derived from the first readable resource of each type, not legacy backup URLs.
Escaped resource labels are unescaped; percent-encoded URL characters remain encoded.

## Sorting contract for #135 and #136

Buckets and cards remain in file order, with missing IDs absent. `answerKey`
contains entries only when both the card and its bucket already have IDs.
`data.sortingAssignments` contains zero-based `{ cardIndex, bucketIndex }` pairs
for **every assigned card**, including items that already have IDs. Cards under
`### Unsorted` have no pair and no answer-key entry.

For example, a new card at index 2 under a new bucket at index 1 has
`{ cardIndex: 2, bucketIndex: 1 }` even though neither item has an ID yet. #135
continues treating absent IDs as new items. #136 must generate those IDs, resolve
all pairs into `answerKey`, and **remove `sortingAssignments` before writing**.
This parser-only field is not a Firestore payload field.

## Import planner (#135)

`planImport(parsed, liveModule, liveSteps)` is pure: it performs no reads, writes,
ID generation or input mutation. Matching IDs are updates even when unchanged;
missing IDs are creates; omitted live steps are deletes. Creates and updates
follow file order, deletes follow live order. Returned entries reference their
original inputs; consumers must not mutate them.

No module ID means a new module: all steps are creates, no live steps are deleted,
and the plan is never stale. Copied step/nested IDs still produce errors. A supplied
module ID must match the loaded module; unrelated live data cannot become deletes.
Existing step types cannot change. Unknown, blank and duplicate IDs are errors.
Nested poll options, sorting cards and sorting buckets must belong to the matching
parent and item collection; omitted IDs remain absent for the apply stage.

Removed poll options with positive votes are reported using live text and counts,
including options in entirely deleted polls. Zero-vote removals do not warn.
The planner compares file ISO timestamps numerically against live Dates or
Firestore timestamps (`toMillis`/`toDate`). Only an older file is stale; equal,
newer or omitted file timestamps are not. Invalid supplied timestamps produce
errors. Step/nested errors use the step's source line; module errors use line 1.

**Any errors make the whole plan ineligible to apply**, even when its arrays contain
valid entries. The apply stage must resolve errors before writing. Preview UI and
database application are outside this module's scope.
