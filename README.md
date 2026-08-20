# Medicinsk svenska

A calm, static study application for Finnish medical students practising medical Swedish. It offers bidirectional flashcards and a Swedish-only anatomical description exercise. The learner-facing app has no backend, accounts, analytics, advertising, external runtime APIs, or cloud progress.

## Scope

V1 is designed only for medical students. It contains five decks—Anatomy, Diseases and ailments, First aid, Medicines and medication, and Departments—and Swedish descriptions of anatomy and physiology. It has no nursing mode, audio, AI, social features, or spaced-repetition algorithm.

Progress lives only in the current browser session and is not tied to an account.

## Requirements and commands

- Node.js 20 or newer
- npm

```sh
npm ci
npm run dev
npm run validate:content
npm run check
npm test
npm run test:e2e
npm run build
npm run preview
```

`npm run build` validates content before Astro writes the static site to `dist/`. Playwright is intentionally separate from the production build because it requires an installed browser.

## Architecture

- `src/pages/` – static Astro routes (`/`, `/kortit`, `/kortit/harjoitus`, `/kuvailu`)
- `src/lib/` – framework-free, independently tested session and answer logic
- `src/scripts/` – minimal browser TypeScript for active exercises
- `src/styles/` – repository-owned responsive CSS; no runtime font or asset request
- `src/types/content.ts` – explicit deck, card, description, and source types
- `content/` – version-controlled curated JSON and human review notes
- `scripts/validate-content.ts` – deployment-blocking content validation
- `tests/` – Vitest unit tests and Playwright browser/accessibility tests

The PDF-derived JSON is committed and is never parsed in the browser. Active sessions are reconstructed from static content and URL parameters, with no server state.

## Content workflow

### Add a deck

1. Add its typed metadata to `content/decks.json` with a unique lowercase ID and `published` status.
2. Add cards that use that exact `deckId`.
3. Run `npm run validate:content` and all tests.

### Add a flashcard

Add an object to `content/flashcards.json` with a unique ID, one Finnish lexical item, one canonical Swedish lexical item, status, and source document/page/item. Store `en` or `ett` in `article`, never in `sv`. Optional grammar belongs in `partOfSpeech` and `inflection`, not in the term.

The canonical-term rule is strict: no slash-separated alternatives, synonym lists, multiple meanings, phrases, definitions, or examples. Hyphenated and closed compounds count as one lexical item. If a row cannot be resolved directly from its PDF, omit it rather than guessing.

### Add a description

Add a Swedish object to `content/descriptions.json`. The prompt and canonical answer must be Swedish and have document, page, and section metadata. `acceptedInflections` may contain only grammatical forms of that same answer, never synonyms. Keep descriptions concise and source-grounded.

### Corrections and review

Record every source correction, canonical alternative choice, duplicate, phrase omission, and ambiguous row in `content/review-notes.md`. Maintenance notes are not displayed to learners. Re-run validation after every content edit.

## Tests and accessibility

Vitest covers directions, sides, grading transitions, summaries, missed-card retries, answer normalisation and inflections, deterministic unique lucky selection, and malformed/duplicate content. Playwright covers the core routes, both directions, keyboard use, a completed/retried session, a 50-card lucky session, description outcomes, direct static routes, a 320 px viewport, and serious/critical axe violations.

## Deployment

The existing Cloudflare Workers Static Assets integration deploys repository changes from GitHub. `wrangler.jsonc` retains the application name `medicinsk-svenska` and serves `./dist`; there is deliberately no Worker `main` entry point and no GitHub deployment workflow.

Content changes follow the same route as code: commit to GitHub, verify in CI, and let the existing Cloudflare integration deploy the generated static assets.
