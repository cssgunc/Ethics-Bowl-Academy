# Repository Guidelines

## Project Structure & Module Organization

Ethics Bowl Academy is a Next.js 15, React 18, and TypeScript learning platform. The application lives in `frontend/`; the root package has no development scripts.

- `frontend/src/app/`: App Router pages and layouts.
- `frontend/src/components/`: shared UI, step views, and step editors.
- `frontend/src/lib/firebase/`: Firebase configuration, database operations, canonical data types, and tests.
- `frontend/src/store/`: Zustand state; `hooks/`, `context/`, and `utils/` contain supporting logic.
- `frontend/public/`: static images and icons.
- `backend/`: Firestore rules/indexes, Firebase configuration, Functions stub, and seed scripts.

## Build, Test, and Development Commands

Run these from `frontend/`:

- `npm install`: install application dependencies.
- `npm run dev`: start local development at `http://localhost:3002` using cross-env.
- `npm run lint`: run ESLint with Next.js Core Web Vitals rules.
- `npm test`: run Jest; `npm run test:watch` reruns tests during edits.
- `npx jest src/lib/firebase/__tests__/db-operations.test.ts`: run one test file.

The build script is `npm run build`, but existing `CLAUDE.md` instructions prohibit running it or other production commands.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, and semicolons; follow surrounding quote style. Name React components and their files in PascalCase, variables/functions in camelCase, and hooks with a `use` prefix. Use `@/` imports for `src/` paths. Reuse existing MUI/Tailwind patterns and Firebase types from `src/lib/firebase/types.ts`.

## Testing Guidelines

Jest uses ts-jest and a Node environment, matching `src/**/__tests__/**/*.test.ts`. Mock Firebase dependencies as existing database tests do. Add regression tests for changed behavior and manually verify affected student/admin flows for UI changes. No coverage threshold is configured; backend's test script is a failing placeholder.

## Commit & Pull Request Guidelines

History mixes concise descriptive subjects with `feat:` and `fix:` prefixes and issue references such as `(#131)`. Use a short, action-oriented subject and reference the relevant issue. In PRs, describe the change, link issues, report validation, and include screenshots for visible UI changes.

## Security & Configuration

Keep Firebase settings in `frontend/.env.local` using `NEXT_PUBLIC_FIREBASE_*` variables; never commit credentials or service-account files. Client-side database access relies on `backend/firestore.rules`: review rules whenever adding fields or write paths.
