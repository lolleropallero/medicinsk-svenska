# Medicinsk svenska

A calm, static study application for Finnish medical students practising medical Swedish. It offers bidirectional flashcards and a Swedish-only anatomical description exercise. The learner-facing app has no backend, accounts, analytics, advertising, external runtime APIs, or cloud progress.

## Scope

V1 is designed only for medical students. It contains five decks—Anatomy, Diseases and ailments, First aid, Medicines and medication, and Departments—and Swedish descriptions of anatomy and physiology. It has no nursing mode, audio, AI, social features, or spaced-repetition algorithm.

Flashcard progress is stored only in the current browser. It is not tied to an account, synchronized between devices, or retained as long-term learning history.

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
- `src/types/content.ts` – explicit application content and client-payload types
- `content/` – version-controlled curated learning data
- `scripts/validate-content.ts` – deployment-blocking content validation
- `tests/` – Vitest unit tests and Playwright browser/accessibility tests

Published content is filtered at build time and mapped to explicit client payloads. Publication status and maintenance-only fields are never sent to the browser. There is no server state.

### Flashcard session persistence

Starting an exercise creates a unique session URL and stores one versioned active session in `localStorage`. The stored state includes the originally selected card IDs, queues, mastery and attempt state, the session start time, and absolute retry timestamps. Reloading or backgrounding therefore does not resample cards or reset a five-minute retry countdown.

Stored state is accepted only when its schema version, card references, typed values, and mutually exclusive card states are valid against the current static content. Missing, malformed, incompatible, or unrelated stored state is discarded and a session is created from the URL parameters. This persistence is intentionally limited to the active flashcard exercise; it is not spaced-repetition history.

## Content workflow

### Add a deck

1. Add its typed metadata to `content/decks.json` with a unique lowercase ID and `published` status.
2. Add cards that use that exact `deckId`.
3. Run `npm run validate:content` and all tests.

### Add a flashcard

Add an object to `content/flashcards.json` with a unique ID, one Finnish lexical item, one canonical Swedish lexical item, a publication status, and one of the closed `partOfSpeech` values. Store `en` or `ett` in `article`, never in `sv`. Optional grammar belongs in `inflection`, not in the term.

The canonical-term rule is strict: no slash-separated alternatives, synonym lists, multiple meanings, phrases, definitions, or examples. Hyphenated and closed compounds count as one lexical item. Omit an entry when its canonical mapping cannot be established confidently.

### Add a description

Add a Swedish object to `content/descriptions.json`. The prompt and canonical answer must be Swedish. `acceptedInflections` may contain only grammatical forms of that same answer, never synonyms. Keep descriptions concise, natural, medically correct, and unambiguous.

## Tests and accessibility

Vitest covers directions, deterministic unique session selection, typed grading transitions, exact delayed retries, completion rules, stored-session validation, answer normalisation and inflections, and malformed/duplicate content. Playwright covers the core routes, both directions, keyboard and tap use, refresh-stable sessions, the compact delayed-retry waiting state, all session sizes and lucky mode, mobile control sizing, description outcomes, direct static routes, 320 px overflow, visual QA, and serious/critical axe violations.

## Deployment

The existing Cloudflare Workers Static Assets integration deploys repository changes from GitHub. `wrangler.jsonc` retains the application name `medicinsk-svenska` and serves `./dist`; there is deliberately no Worker `main` entry point and no GitHub deployment workflow.

Content changes follow the same route as code: commit to GitHub, verify in CI, and let the existing Cloudflare integration deploy the generated static assets.
