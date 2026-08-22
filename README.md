# Medicinsk svenska

A calm, static study application for Finnish medical students practising medical Swedish. It offers bidirectional flashcards, Finnish-to-Swedish clinical phrase recall, and a Swedish-only anatomical description exercise. The learner-facing app has no backend, accounts, analytics, advertising, external runtime APIs, or cloud progress.

## Scope

V1 is designed only for medical students. It contains seven decks: Anatomia (130 cards), Sairaudet ja vaivat (125), Ensiapu (56), Lääkkeet ja lääkitys (49), Osastot (18), Vastaanotto ja anamneesi (27), and Tutkimukset ja hoito (50). The 455 flashcards are accompanied by 73 clinical phrases in three categories and 51 Swedish descriptions of anatomy and physiology. It has no nursing mode, audio, AI, social features, or spaced-repetition algorithm.

Exercise sessions and long-term progress are stored only in the current browser. They are not tied to an account or synchronized between devices.

## Requirements and commands

- Node.js 20 or newer
- npm

```sh
npm ci
npm run dev
npm run validate:content
npm run audit:assets
npm run check
npm test
npm run test:e2e
npm run build
npm run preview
```

`npm run build` audits the Nordic assets, validates content, builds the static site, and audits emitted copy and media. Playwright is intentionally separate from the production build because it requires an installed browser.

## Architecture

- `src/pages/` – static Astro routes (`/`, `/kortit`, `/kortit/harjoitus`, `/fraasit`, `/fraasit/harjoitus`, `/kuvailu`, `/kuvailu/harjoitus`)
- `src/lib/` – framework-free, independently tested session and answer logic
- `src/scripts/` – minimal browser TypeScript for active exercises
- `src/styles/` – repository-owned responsive CSS; no external font or asset request
- `src/assets/nordic-v1/` – 34 retained brand, rarity, achievement, league, and deck SVGs
- `src/assets/visual-fix-v4/` – 13 retained Visual Fix V4 reward, category, and background assets
- `src/assets/standard-box-v5/` – three transparent Standard Box V5 PNG variants
- `src/lib/nordic-asset-inventory.ts` and `src/lib/nordic-assets.ts` – exact typed inventory and Vite-managed local asset URLs
- `src/lib/visual-fix-asset-inventory.ts` and `src/lib/visual-fix-assets.ts` – exact retained V4 paths and static Vite URL imports
- `src/lib/standard-box-v5-asset-inventory.ts` and `src/lib/reward-box-assets.ts` – exact V5 paths and kind/size-aware reward resolution
- `src/types/content.ts` – explicit application content and client-payload types
- `content/` – version-controlled curated learning data
- `scripts/validate-content.ts` – deployment-blocking content validation
- `tests/` – Vitest unit tests and Playwright browser/accessibility tests

Published content is filtered at build time and mapped to explicit client payloads. Publication status and maintenance-only fields are never sent to the browser. There is no server state.

### Nordic Asset Pack V1

`src/assets/nordic-v1/` retains 34 production SVGs: five brand assets, four rarity frames, twelve achievement badges, six league shields, and seven deck icons. `src/assets/visual-fix-v4/` retains thirteen production assets: two genuine golden/legendary reward SVGs, seven anatomical category SVGs, and four local WebP backgrounds. `src/assets/standard-box-v5/` contains exactly three transparent standard-box PNGs for HUD, card, and hero use. Package previews, reference sheets, and source archives are excluded. The typed inventories expose Vite-managed hashed same-origin URLs, and `npm run audit:assets` verifies counts, mapping completeness, PNG alpha channels, WebP policy, and SVG safety. The audit is part of `npm run build`.

The supplied brand mark is used in the application header and favicon. Finnish and Swedish cross tiles provide compact shared-language identity. Language corners are text-free decorative images: Finnish content uses `language-corner-fi.svg`, Swedish content uses `language-corner-sv.svg`, and actual language remains expressed with `lang="fi"` or `lang="sv"`. Active exercises must never add visible `Suomi`, `Svenska`, `Suomeksi`, or `Ruotsiksi` labels.

Standard Box V5 maps `small → box-standard-hud.png`, `normal → box-standard-card.png`, and `large → box-standard-hero.png`. Golden and legendary rewards use their genuine V4 illustrations at every size, including compact chips. Reward artwork is never composed with a separate seal, badge, medallion, flag overlay, or cross primitive. The seven description category IDs map one-to-one to `cells`, `skeleton`, `neuro`, `cardio`, `blood`, `digestion`, and `hormones`, rendered directly without another icon tile.

Backgrounds use `home-dark.webp` on `/`, `rewards-dark.webp` on rewards and season surfaces, `shell-light.webp` on setup and progress routes, and `study-light.webp` on active, waiting, and completion exercise states. They render at normal opacity with `background-size: cover`; readable content remains on its own surface. The four WebP backgrounds and three Standard Box V5 PNGs are the only allowed raster assets. HUD chips keep icon, label, primary value, and optional secondary value in separate elements; phones use a two-by-two grid and wider screens use four columns.

Achievement IDs map one-to-one to the twelve same-named SVGs. Stored league tiers map as `Pronssi → bronze`, `Hopea → silver`, `Kulta → gold`, `Platina → platinum`, `Timantti → diamond`, and `Konsultti → master`, while visible Swedish labels remain unchanged. Deck IDs map as `anatomi → anatomy`, `sjukdomar → diseases`, `forsta-hjalpen → first-aid`, `mediciner → medicines`, `avdelningar → departments`, `vastaanotto-anamneesi → anamnesis`, and `tutkimukset-hoito → examinations`.

To replace one asset safely, preserve its filename, format, dimensions or viewBox, paths, gradients, filters, title, and transparency. Update the relevant typed inventory and static import, keep decorative images at `alt=""` plus `aria-hidden="true"` when adjacent HTML names them, and run `npm run audit:assets`, unit tests, the production build, and Playwright. Do not inline, recolour, rasterize an SVG, convert a background away from WebP, or add previews or archives to production assets.

Styles are split into `tokens.css`, `base.css`, `shell.css`, `components.css`, `exercises.css`, `metagame.css`, `rewards.css`, `season.css`, `responsive.css`, and `nordic-assets.css`. `src/lib/visuals.ts` retains generic UI icons only for actions and navigation not covered by the pack, plus validated display and cosmetic tokens.

Phones use a compact brand bar and a safe-area-aware five-item bottom navigation. Active exercise routes omit all global chrome. Themes affect the shell palette and major surfaces, card styles affect study-card pattern and geometry, progress frames affect passport framing, and titles remain limited to metagame surfaces. Reduced-motion preferences and `Lugnt läge` retain colour and layout while suppressing anticipation and celebration motion.

Visual regression work uses the Playwright matrix at 320 × 568, 390 × 844, 768 × 1024, and 1440 × 900. Review home, each setup and active exercise state, the daily sheet, passport, badges, boxes, shop, collection, season route, league shields, dialogs, calm mode, and reduced motion; functional and accessibility assertions remain the acceptance gate rather than screenshots alone.

### Flashcard session persistence

Each compact deck row is one complete link, so its name, card count, empty space, and `Aloita` affordance all start the configured exercise. Starting an exercise creates a unique session URL and stores one versioned active session in `localStorage`. The stored state includes the originally selected card IDs, queues, mastery and attempt state, the session start time, and absolute retry timestamps. Reloading or backgrounding therefore does not resample cards, reset elapsed time, or reset a five-minute retry countdown. Durations use `MM:SS` below one hour and `H:MM:SS` thereafter.

Stored state is accepted only when its schema version, URL configuration, deck ownership, card references, typed values, counters, timestamps, and mutually exclusive card states are valid against the current static content. Missing stored state is recreated from a valid URL; malformed or incompatible URLs fail closed. This persistence is intentionally limited to the active flashcard exercise; it is not spaced-repetition history.

Completion shows first-attempt successes, every `En osannut` action, and elapsed time. `Uusi kierros` retains mode, deck, direction, and requested amount while creating a new identifier, start time, sample, order, and empty progress state.

### Description exercise sessions

The description setup offers seven anatomical and physiological categories plus `Kaikki aiheet`, with 10, 25, 50, or all unique exercises. Each complete category row is one keyboard-accessible link. A typed, versioned description session stores its selected shuffled IDs, current position, draft, resolved feedback, results, selection configuration, round, and absolute start time in the browser. Refreshing or backgrounding preserves the question and the `MM:SS` or `H:MM:SS` elapsed timer.

Answer matching is deterministic: it accepts the canonical Swedish answer, explicitly stored grammatical forms, and an optional correct indefinite article with the canonical lemma. It does not guess synonyms or approximate spellings. Completion reports correct answers, errors, and elapsed time. Missed and revealed items can start an immediate, separately persisted retry round; `Uusi kierros` instead resamples the retained category or all-topics configuration with a new identifier and timestamp.

Description URLs validate mode, category, amount, round, and session identifier against local state and current category membership. Invalid initial configurations and unrestorable retry links fail closed. Randomness and time are injectable or controllable in tests.

### Clinical phrase sessions

`Vastaanottofraasit` provides Taustatiedot, Oireet ja vointi, and Hoito ja lääkitys categories plus all-phrase practice. Sessions select 10, 25, or all unique phrases. The Finnish cue is recalled actively in Swedish, revealed by tapping the complete card, and self-assessed with `En osannut` or `Osasin`; there is no automatic language scoring.

The typed phrase session persists its exact shuffled selection, current item, reveal and mastery state, attempts, absolute start time, and absolute five-minute retry times under its own browser-storage key. The waiting countdown resumes automatically when a missed phrase is due. A new round retains category and amount while creating a new identifier, timestamp, selection, and empty learning state. Phrase URLs and restored category membership are validated independently of flashcards and descriptions. The shared duration formatter, shuffle seam, controlled clocks, and single retry-delay constant keep timing deterministic in tests.

## Content workflow

### Add a deck

1. Add its typed metadata to `content/decks.json` with a unique lowercase ID and `published` status.
2. Add cards that use that exact `deckId`.
3. Run `npm run validate:content` and all tests.

### Add a flashcard

Add an object to `content/flashcards.json` with a unique ID, one Finnish lexical item, one canonical Swedish lexical item, a publication status, and one of the closed `partOfSpeech` values. Store `en` or `ett` in `article`, never in `sv`. Optional grammar belongs in `inflection`, not in the term.

The canonical-term rule is strict: no slash-separated alternatives, synonym lists, multiple meanings, phrases, definitions, or examples. Hyphenated and closed compounds count as one lexical item. Omit an entry when its canonical mapping cannot be established confidently.

Flashcards are curated for physician-relevant study. Every Finnish and Swedish side must be one lexical item, and uniqueness is global and bidirectional: a normalized term maps to exactly one term in the other language across all seven decks.

### Add a description

Add a Swedish object to `content/descriptions.json` and assign exactly one published `categoryId` from `content/description-categories.json`. The prompt and canonical answer must be Swedish. `acceptedInflections` may contain only grammatical forms of that same answer, never synonyms. Keep descriptions concise, natural, medically correct, and unambiguous. Category records contain only a stable ID, Finnish name, and publication status; keep every published category non-empty.

### Add a clinical phrase

Add one complete natural Finnish cue and one canonical Swedish phrase to `content/phrases.json`, assigned to a published category from `content/phrase-categories.json`. Full phrases are maintained separately from one-word flashcards. Do not add alternatives, placeholders, incomplete fragments, explanations, or duplicate normalized cues. Keep every phrase category non-empty and run content validation before committing.

## Tests and accessibility

Vitest covers directions, duration formatting, deterministic unique session and new-round selection, delayed phrase recall, summary statistics, typed transitions, URL matching, strict deck- and category-aware stored-session validation, answer normalisation, articles and inflections, and malformed content. Playwright uses controlled clocks and randomness for elapsed timing and stable selections, and covers full-row activation, focus transitions, refresh-stable sessions and drafts, retries, new rounds, invalid URLs, all session sizes, mobile control sizing, responsive overflow, visual QA, and serious/critical axe violations.

## Local progress model

Progress uses the versioned browser key `medicinsk-svenska.progress.v1`; active exercise sessions remain in their original separate keys. There is no account, backend, telemetry, payment, advertising, or real-money currency.

Learning setup, answers, and exercise controls remain Finnish. The metagame is Swedish-first: the global HUD, progress, rewards, season, league, achievements, cosmetics, shop, notifications, and completion rewards use Swedish. Daily and weekly quests use Swedish primary text with a separately marked Finnish helper. The document language remains Finnish, while Swedish metagame nodes use `lang="sv"` and Finnish helpers use `lang="fi"`.

The mobile homepage is a compact launcher rather than a dashboard. After the global header and four-item HUD it contains one full-width daily launcher followed immediately by the three Finnish practice actions. The persistent HUD shows level with XP, streak, credits, and unopened boxes on non-active routes; boxes link directly to opening and receive restrained emphasis when available. Season and league detail stay on their existing pages.

Daily detail appears once in an accessible modal bottom sheet on phones and a centred dialog on larger screens. It contains the compact daily goal, three bilingual quest rows with progress and rewards, rerolls, and the all-three bonus. An eligible incomplete day opens automatically only on `/`, at most once after dismissal per local date, and never in calm mode or over another modal. The launcher always reopens it manually. Dismissal is stored separately from the economy in `medicinsk-svenska.ui.v1`, fails safely when corrupt, and becomes eligible again on the next local date.

Incomplete quest rows start study directly. Stored sessions are validated against current static content before flashcards, phrases, or descriptions are resumed; otherwise the resolver creates the smallest valid session required by that quest. Generic, active-time, variety, retry, and session-completion quests select an appropriate last-used or unused mode without changing quest, retry, reward, or session-size semantics. Calm mode suppresses automatic opening and HUD pulse while leaving the launcher, progress, credits, boxes, and manual dialog fully available.

Visible progress copy is derived in `src/lib/progress/copy.ts` from stable quest semantics, achievement IDs, cosmetic IDs, reward structures, notification kinds, and stored internal league values. Economy functions return semantic values instead of display sentences. Loading existing V1 progress normalizes legacy notification and session-summary strings without resetting the storage key or changing XP, credits, boxes, pity, inventory, claimed quests, streaks, seasons, leagues, event IDs, or active exercise storage. This is a copy migration only; economy rules and probabilities are unchanged.

All exercise modes emit semantic `session-started`, `item-completed`, `session-completed`, and `active-study` events into one reducer. Session/item event IDs prevent replay after reload, duplicate input, or cross-tab reconciliation. Storage retains at most 10,000 recent event IDs, about 400 daily summaries, 100 openings, 12 seasons, and 104 settled weeks while lifetime totals remain intact.

The first completion of each unique item per local day gives 2 XP regardless of correctness. The level threshold is `10 × (level − 1) × level`; a level describes practice volume, not proficiency. Every new level gives 10 credits, every fifth gives a capsule, and every tenth substitutes a golden capsule.

The daily goal is 5, 10, 20, or 30 unique items (default 10). Its first completion gives a standard capsule, 10 credits, and 20 season points. Streaks use goal-qualified local days. Up to two streak freezes are consumed automatically; one unprotected missed day can be rescued immediately the next day with 20 unique items, at most once per 30 days.

The deterministic daily quests are: 10 unique items; either 10 flashcards, 5 phrases, or 5 descriptions; and either 5 active minutes, two modes, three mastered retries, or two sessions. Weekly quests are five study days, 100 unique items, and all three modes. One free daily reroll is followed by token rerolls. Persisted labels are ignored when rendering.

Active study time is separate from session wall time. It requires a visible unresolved exercise, interaction within 90 seconds, and ownership of a renewable local tab lease. Absolute timestamps are flushed in bounded intervals and on visibility/page exit.

Credits can only be earned locally and used in the deterministic four-offer daily shop. The cosmetic catalog has four defaults and 36 earnable items: 16 common, 10 rare, 7 epic, and 3 legendary, across themes, card styles, progress frames, and titles. Cosmetics have no learning advantage.

Published standard-capsule probabilities are Common 65%, Rare 25%, Epic 8%, and Legendary 2%. Golden guarantees at least Rare; Legendary guarantees Legendary. Pity guarantees Rare by opening 4, Epic by 12, and Legendary by 40. An unowned cosmetic of the rolled rarity or higher is selected before credit conversion. Capsule outcome and pity are persisted before reveal.

The free season is a 28-day, 30-step track using epoch 2026-08-17. The first 25 unique items per day, goals, and quests grant points. Stored internal league tiers retain their V1 values for compatibility and are displayed as Brons, Silver, Guld, Platina, Diamant, and Mästare. The personal weekly league has no opponents and moves at most one tier per settlement. Comeback rules grant a 10-item 1.5× boost after 2–6 days, a golden box plus 20-item 2× boost after 7–29 days, or a persistent three-stage legendary-box chain after 30 days.

Calm mode removes anticipation and urgency without changing rules. Export creates a versioned JSON envelope. Import validates schema, dates, inventory, capsules, pity, seasons, and cosmetic IDs before confirmed replacement. Reset restores progress defaults without deleting active exercise sessions. Time and random selection are isolated behind deterministic test seams.

## Deployment

The existing Cloudflare Workers Static Assets integration deploys repository changes from GitHub. `wrangler.jsonc` retains the application name `medicinsk-svenska` and serves `./dist`; there is deliberately no Worker `main` entry point and no GitHub deployment workflow.

Content changes follow the same route as code: commit to GitHub, verify in CI, and let the existing Cloudflare integration deploy the generated static assets.
