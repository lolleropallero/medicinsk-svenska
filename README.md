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

- `src/pages/` – static Astro routes (`/`, `/kortit`, `/kortit/harjoitus`, `/kuvailu`, `/kuvailu/harjoitus`)
- `src/lib/` – framework-free, independently tested session and answer logic
- `src/scripts/` – minimal browser TypeScript for active exercises
- `src/styles/` – repository-owned responsive CSS; no runtime font or asset request
- `src/types/content.ts` – explicit application content and client-payload types
- `content/` – version-controlled curated learning data
- `scripts/validate-content.ts` – deployment-blocking content validation
- `tests/` – Vitest unit tests and Playwright browser/accessibility tests

Published content is filtered at build time and mapped to explicit client payloads. Publication status and maintenance-only fields are never sent to the browser. There is no server state.

### Flashcard session persistence

Each compact deck row is one complete link, so its name, card count, empty space, and `Aloita` affordance all start the configured exercise. Starting an exercise creates a unique session URL and stores one versioned active session in `localStorage`. The stored state includes the originally selected card IDs, queues, mastery and attempt state, the session start time, and absolute retry timestamps. Reloading or backgrounding therefore does not resample cards, reset elapsed time, or reset a five-minute retry countdown. Durations use `MM:SS` below one hour and `H:MM:SS` thereafter.

Stored state is accepted only when its schema version, URL configuration, deck ownership, card references, typed values, counters, timestamps, and mutually exclusive card states are valid against the current static content. Missing stored state is recreated from a valid URL; malformed or incompatible URLs fail closed. This persistence is intentionally limited to the active flashcard exercise; it is not spaced-repetition history.

Completion shows first-attempt successes, every `En osannut` action, and elapsed time. `Uusi kierros` retains mode, deck, direction, and requested amount while creating a new identifier, start time, sample, order, and empty progress state.

### Description exercise sessions

The description setup offers seven anatomical and physiological categories plus `Kaikki aiheet`, with 10, 25, 50, or all unique exercises. Each complete category row is one keyboard-accessible link. A typed, versioned description session stores its selected shuffled IDs, current position, draft, resolved feedback, results, selection configuration, round, and absolute start time in the browser. Refreshing or backgrounding preserves the question and the `MM:SS` or `H:MM:SS` elapsed timer.

Answer matching is deterministic: it accepts the canonical Swedish answer, explicitly stored grammatical forms, and an optional correct indefinite article with the canonical lemma. It does not guess synonyms or approximate spellings. Completion reports correct answers, errors, and elapsed time. Missed and revealed items can start an immediate, separately persisted retry round; `Uusi kierros` instead resamples the retained category or all-topics configuration with a new identifier and timestamp.

Description URLs validate mode, category, amount, round, and session identifier against local state and current category membership. Invalid initial configurations and unrestorable retry links fail closed. Randomness and time are injectable or controllable in tests.

## Content workflow

### Add a deck

1. Add its typed metadata to `content/decks.json` with a unique lowercase ID and `published` status.
2. Add cards that use that exact `deckId`.
3. Run `npm run validate:content` and all tests.

### Add a flashcard

Add an object to `content/flashcards.json` with a unique ID, one Finnish lexical item, one canonical Swedish lexical item, a publication status, and one of the closed `partOfSpeech` values. Store `en` or `ett` in `article`, never in `sv`. Optional grammar belongs in `inflection`, not in the term.

The canonical-term rule is strict: no slash-separated alternatives, synonym lists, multiple meanings, phrases, definitions, or examples. Hyphenated and closed compounds count as one lexical item. Omit an entry when its canonical mapping cannot be established confidently.

### Add a description

Add a Swedish object to `content/descriptions.json` and assign exactly one published `categoryId` from `content/description-categories.json`. The prompt and canonical answer must be Swedish. `acceptedInflections` may contain only grammatical forms of that same answer, never synonyms. Keep descriptions concise, natural, medically correct, and unambiguous. Category records contain only a stable ID, Finnish name, and publication status; keep every published category non-empty.

## Tests and accessibility

Vitest covers directions, duration formatting, deterministic unique session and new-round selection, summary statistics, typed transitions, URL matching, strict deck- and category-aware stored-session validation, answer normalisation, articles and inflections, and malformed content. Playwright uses controlled clocks and randomness for elapsed timing and stable selections, and covers full-row activation, focus transitions, refresh-stable sessions and drafts, description retries, new rounds, invalid URLs, all session sizes, mobile control sizing, responsive overflow, visual QA, and serious/critical axe violations.

## Deployment

The existing Cloudflare Workers Static Assets integration deploys repository changes from GitHub. `wrangler.jsonc` retains the application name `medicinsk-svenska` and serves `./dist`; there is deliberately no Worker `main` entry point and no GitHub deployment workflow.

Content changes follow the same route as code: commit to GitHub, verify in CI, and let the existing Cloudflare integration deploy the generated static assets.
