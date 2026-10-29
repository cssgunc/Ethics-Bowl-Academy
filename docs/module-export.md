# Module export

On the admin dashboard's Modules tab, select **Export Modules**. The modal lists public and private modules alphabetically, starts with none selected on each opening, and provides a Select all / Select none checkbox. Choose modules and select Export.

- One module downloads as a `.md` file.
- Multiple modules download as a ZIP containing one `.md` file per module.
- Filenames include the module title and ID to distinguish modules with matching titles.
- Export reads saved Firestore content again before generating the download. Unsaved editor drafts are not exported.
- A failed module or step read prevents the download; the modal displays an error and preserves the selection for retry.

## Markdown format

Each document begins with YAML front matter containing `id`, `title`, `description`, `tags`, `isPublic`, and `updatedAt`, followed by other existing module metadata. Module display order is omitted. Dates and Firestore timestamps become UTC ISO strings; strings are quoted safely.

Steps retain their display order, ID comments, and `##` titles. Settings immediately follow the title, including existing timestamps, author information, `estimatedMinutes`, `isOptional`, and additional fields. Nested settings use JSON flow values, which are valid YAML.

Supported content: videos, quizzes, polls, sorting, flashcards, free responses, additional resources, and debates. Unsupported step types, invalid timestamps, corrupt sorting answer keys, and invalid quiz answer indices produce an error instead of a misleading export.

- Quizzes use `### Prompt <!-- question -->` headings, checkbox lists for correct answers, indented blockquotes for choice feedback, and `### Explanation <!-- explanation -->` for question feedback. Explicit markers allow questions named `Explanation`. Legacy unmarked feedback remains importable unless it contains checkbox choices outside fenced code; ambiguous sections require an explicit marker before import.
- Poll questions follow the settings. Poll options retain IDs; vote counts are excluded. Nested IDs are unique within their parent step and item collection, and may repeat across polls or cloned sorting steps.
- Sorting cards appear beneath their correct bucket. Cards without an assigned answer appear beneath `### Unsorted`.
- Flashcard fronts use `###` headings, followed by their backs.
- Free responses retain the prompt and `### Sample answer` when present.
- Resource links retain labels and `(pdf)` annotations. A `resources` setting also retains resource IDs, metadata, and original legacy fields.
- Extra nested fields not represented by the body remain in settings using the original field name (such as `options` or `cards`).
- Debates use `maxStudentTurns` (integer 3–10), `### Context`, and `### Starting question`.

On import, readable bodies take precedence over structured backup settings. Extra
nested fields and resource IDs in backups are not imported; resource legacy URLs
are derived from readable links. Known site metadata is ignored, while module ID
and update time remain available to the import planner. See the
[parser contract](../frontend/src/lib/importExport/README.md) for details.

Existing authored Markdown and hosted image/PDF URLs are retained. Downloads contain Markdown files; linked assets remain hosted at their original URLs. Student responses and progress are not queried.

## Verification and deployment

From `frontend`, run `npm test -- --runInBand`, `npx tsc --noEmit`, and `npm run lint`. Do not run production builds (see `CLAUDE.md`). Run `npm run test:rules` with the Firebase CLI and Java installed to verify admin/private access in the local Firestore emulator.

Deploy the updated `backend/firestore.rules` with the frontend release. The rule change permits existing admins to read private module documents, matching their existing access to private step documents. Without it, listing all modules will be denied by Firestore.
