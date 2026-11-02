# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ethics Bowl Academy — a learning platform built by UNC CS + Social Good for the UNC Parr Center (powered by TED-Ed). Admins author modules made of ordered "steps" (video, quiz, flashcards, free response, sorting, poll, additional resources); students work through them, with progress and a personal journal stored per user.

## Layout and commands

The real app lives in `frontend/` (Next.js 15 App Router, React 18, TypeScript, MUI + Tailwind, Zustand). `backend/` is Firebase project config (Firestore rules/indexes, a mostly empty Cloud Functions stub, a seed script). The root `package.json` only holds stray dependencies; `vercel.json` deploys the Next.js app.

Run from `frontend/`:

```bash
npm install
npm run dev          # runs `PORT=3002 next dev` -> http://localhost:3002 (POSIX env syntax; use Git Bash on Windows)
npm run build        # NEVER RUN THIS COMMAND OR ANY PRODUCTION COMMAND
npm run lint
npm test             # jest (ts-jest, node env); only matches src/**/__tests__/**/*.test.ts
npx jest src/lib/firebase/__tests__/db-operations.test.ts   # single file
npx jest -t "name of test"                                  # single test by name
```

Tests mock `firebase/firestore` and `../firebaseConfig` entirely — there is no emulator-backed testing.

`frontend/.env.local` must contain the `NEXT_PUBLIC_FIREBASE_*` keys (API key, auth domain, project ID, storage bucket, messaging sender ID, app ID). Without them `firebaseConfig.ts` exports `db`/`auth`/`app` as `null` rather than throwing, which is why the code uses `db!` everywhere.

Backend (from `backend/`, requires `firebase-tools` and `firebase login`): deploy rules with `firebase deploy --only firestore:rules`. Seed test data with `node scripts/seed-test-modules.js` after placing a service-account JSON in `backend/` and editing the path/`USER_ID` in the script.

## Architecture

**All data access is client-side.** There is no API layer; components and the Zustand store call the Firebase JS SDK directly via `frontend/src/lib/firebase/db-operations.ts`. Security is therefore enforced entirely by `backend/firestore.rules` — any new field or write path must also be allowed there, or it will fail at runtime with a permission error.

**Firestore data model** (`frontend/src/lib/firebase/types.ts` is the source of truth):
- `modules/{moduleId}` — metadata, `stepCount`, `isPublic`, `order`, `createdBy`, `collaborators`.
- Steps are **not** in one collection: each step type lives in its own subcollection under the module, mapped by `STEP_COLLECTIONS` (`video→videos`, `quiz→quizzes`, `freeResponse→freeResponses`, `poll→polls`, etc.). Reading a module's steps means querying every subcollection and merging by `order`. Updating/deleting a step therefore requires knowing its `type`.
- `users/{uid}` — profile plus `isAdmin` flag; subcollections `progress/{moduleId}` and `journal/{entryId}`.
- Poll votes are written by students directly onto the poll step doc (rules allow signed-in users to change only `options` + `updatedAt`).

**Adding or changing a step type touches many places:** the `StepType` union, `STEP_COLLECTIONS` and step interface in `types.ts`; the hardcoded type lists in `db-operations.ts` (`getStepsByModuleId`, `deleteModule`); `firestore.rules` (`validateStep`, `hasMatchingPayloadType`, a `validate*Payload` function, the `validateStepUpdate` allowed-fields list, and a `match` block); an editor in `components/step-editors/` wired through `StepEditorModal`/`AddStepModal`; and a `*StepView.tsx` renderer used by `ModuleContentMUI`. Note those hardcoded lists in `db-operations.ts` currently omit `additionalResources`.

**Roles and routing:** `AuthGate` (with `requireAdmin`) reads `users/{uid}.isAdmin` and redirects admins to `/admin` and students to `/homepage`; `ProtectedRoute` only checks sign-in. Firestore rules mirror this with `isAdmin()` / `isOwner()` / `isCollaborator()`.

**Admin editing flow:** `/admin` → `ModulesPage`/`ModuleEditor`, backed by `store/moduleStore.ts` (Zustand), which wraps `db-operations` CRUD and renumbers step `order` on save/reorder (drag-and-drop via `@dnd-kit`).

**Step text content** can embed `<img src="https://..."/>` tags (uploaded through `uploadStepImage.ts` to Firebase Storage); `StepContent.tsx` parses these safely instead of using `dangerouslySetInnerHTML`.

**Legacy vs current types:** `src/types/module.ts` and `src/data/mock*.ts` are an older mock-data model (`BaseFeature`, `question`/`options`) — use `lib/firebase/types.ts` (`prompt`/`choices`) for real data. `src/lib/importExport/types.ts` holds shared types for the in-progress module import feature (issue #131); its header says not to change them without commenting on #131 first.
