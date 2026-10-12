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

Supported content: videos, quizzes, polls, sorting, flashcards, free responses, and additional resources. Debate support is deferred. Unsupported step types, invalid timestamps, corrupt sorting answer keys, and invalid quiz answer indices produce an error instead of a misleading export.

- Quizzes use checkbox lists for correct answers, indented blockquotes for choice feedback, and `### Explanation` for legacy question feedback.
- Poll questions follow the settings. Poll options retain IDs; vote counts are excluded.
- Sorting cards appear beneath their correct bucket. Cards without an assigned answer appear beneath `### Unsorted`.
- Flashcard fronts use `###` headings, followed by their backs.
- Free responses retain the prompt and `### Sample answer` when present.
- Resource links retain labels and `(pdf)` annotations. A `resources` setting also retains resource IDs, metadata, and original legacy fields.
- Extra nested fields not represented by the body remain in settings using the original field name (such as `options` or `cards`).

Existing authored Markdown and hosted image/PDF URLs are retained. Downloads contain Markdown files; linked assets remain hosted at their original URLs. Student responses and progress are not queried.

## Verification and deployment

From `frontend`, run `npm test -- --runInBand`, `npx tsc --noEmit`, and `npm run build`. Run `npm run test:rules` with the Firebase CLI and Java installed to verify admin/private access in the local Firestore emulator.

Deploy the updated `backend/firestore.rules` with the frontend release. The rule change permits existing admins to read private module documents, matching their existing access to private step documents. Without it, listing all modules will be denied by Firestore.
