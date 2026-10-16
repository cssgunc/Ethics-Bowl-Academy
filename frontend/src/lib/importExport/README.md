# Markdown parser (#132)

`parseModule` reads the [#130 format](https://github.com/cssgunc/Ethics-Bowl-Academy/issues/130)
without contacting Firebase or generating IDs. Errors use one-based source lines;
any error makes `module` null. Debate remains unsupported until #127 provides its
canonical types, editor restrictions, and rules.

Optional settings and IDs stay absent when omitted. Poll options have no vote
counts, and resources have no generated IDs. The planner (#135) checks IDs against
live data and detects stale timestamps. The upload dialog (#137) checks that all
`imageFilenames` have accompanying files; the apply stage (#136) uploads them and
replaces the preserved filenames in image tags.

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
