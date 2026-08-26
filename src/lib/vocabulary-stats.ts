export const WORD_STATS_SCHEMA_VERSION = 1 as const;
export const WORD_STATS_KEY = 'medicinsk-svenska.word-stats.v1';
const MAX_TRACKED_CARDS = 3000;
const RECENCY_HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;
const MASTERY_DAMPING = 0.5;
const MASTERY_STREAK_CUTOFF = 5;

export interface WordStatEntry {
  attempts: number;
  incorrect: number;
  correctStreak: number;
  lastAttemptAt: number;
  lastIncorrectAt?: number;
}

export interface WordStatsStateV1 {
  schemaVersion: typeof WORD_STATS_SCHEMA_VERSION;
  cards: Record<string, WordStatEntry>;
}

export interface WeakCard {
  cardId: string;
  score: number;
}

export function createWordStatsState(): WordStatsStateV1 {
  return { schemaVersion: WORD_STATS_SCHEMA_VERSION, cards: {} };
}

function pruneCards(cards: Record<string, WordStatEntry>): Record<string, WordStatEntry> {
  const entries = Object.entries(cards);
  if (entries.length <= MAX_TRACKED_CARDS) return cards;
  entries.sort((a, b) => b[1].lastAttemptAt - a[1].lastAttemptAt);
  return Object.fromEntries(entries.slice(0, MAX_TRACKED_CARDS));
}

export function recordWordAttempt(
  state: WordStatsStateV1,
  cardId: string,
  correct: boolean,
  now: number,
): WordStatsStateV1 {
  const previous = state.cards[cardId];
  const lastIncorrectAt = correct ? previous?.lastIncorrectAt : now;
  const entry: WordStatEntry = {
    attempts: (previous?.attempts ?? 0) + 1,
    incorrect: (previous?.incorrect ?? 0) + (correct ? 0 : 1),
    correctStreak: correct ? (previous?.correctStreak ?? 0) + 1 : 0,
    lastAttemptAt: now,
    ...(lastIncorrectAt === undefined ? {} : { lastIncorrectAt }),
  };
  return { ...state, cards: pruneCards({ ...state.cards, [cardId]: entry }) };
}

// Weighted toward recent, repeated misses; decays with a 14-day half-life and zeroes out once a
// word has been answered correctly five times in a row so "mastered again" words stop surfacing.
export function weaknessScore(entry: WordStatEntry, now: number): number {
  if (entry.incorrect <= 0 || entry.correctStreak >= MASTERY_STREAK_CUTOFF) return 0;
  const errorRate = entry.incorrect / Math.max(1, entry.attempts);
  const daysSinceIncorrect = entry.lastIncorrectAt === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(0, now - entry.lastIncorrectAt) / RECENCY_HALF_LIFE_MS;
  const recency = 2 ** -daysSinceIncorrect;
  const damping = MASTERY_DAMPING ** entry.correctStreak;
  return (entry.incorrect + errorRate * 2) * (0.25 + 0.75 * recency) * damping;
}

export function rankWeakCards(
  state: WordStatsStateV1,
  knownCardIds: ReadonlySet<string>,
  now = Date.now(),
): WeakCard[] {
  return Object.entries(state.cards)
    .filter(([cardId]) => knownCardIds.has(cardId))
    .map(([cardId, entry]) => ({ cardId, score: weaknessScore(entry, now) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.cardId.localeCompare(b.cardId));
}

export function selectWeakCardIds(
  state: WordStatsStateV1,
  knownCardIds: ReadonlySet<string>,
  limit: number,
  now = Date.now(),
): string[] {
  return rankWeakCards(state, knownCardIds, now).slice(0, Math.max(0, limit)).map((item) => item.cardId);
}

export function selectWeakCards<T extends { id: string }>(
  state: WordStatsStateV1,
  cards: readonly T[],
  limit: number,
  now = Date.now(),
): T[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  return selectWeakCardIds(state, new Set(byId.keys()), limit, now)
    .map((id) => byId.get(id))
    .filter((card): card is T => card !== undefined);
}

function isWordStatEntry(value: unknown): value is WordStatEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<WordStatEntry>;
  return (
    Number.isInteger(entry.attempts) && entry.attempts! >= 0 &&
    Number.isInteger(entry.incorrect) && entry.incorrect! >= 0 && entry.incorrect! <= entry.attempts! &&
    Number.isInteger(entry.correctStreak) && entry.correctStreak! >= 0 && entry.correctStreak! <= entry.attempts! &&
    typeof entry.lastAttemptAt === 'number' && Number.isFinite(entry.lastAttemptAt) && entry.lastAttemptAt >= 0 &&
    (entry.lastIncorrectAt === undefined ||
      (typeof entry.lastIncorrectAt === 'number' && Number.isFinite(entry.lastIncorrectAt) && entry.lastIncorrectAt >= 0))
  );
}

export function isWordStatsState(value: unknown): value is WordStatsStateV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Partial<WordStatsStateV1>;
  if (state.schemaVersion !== WORD_STATS_SCHEMA_VERSION) return false;
  if (!state.cards || typeof state.cards !== 'object' || Array.isArray(state.cards)) return false;
  return Object.entries(state.cards).every(([id, entry]) => typeof id === 'string' && id.length > 0 && isWordStatEntry(entry));
}

export function loadWordStats(storage: Pick<Storage, 'getItem'> = localStorage): WordStatsStateV1 {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(WORD_STATS_KEY) ?? 'null');
    if (isWordStatsState(parsed)) return parsed;
  } catch {
    // Falls through to a fresh state below.
  }
  return createWordStatsState();
}

export function saveWordStats(state: WordStatsStateV1, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(WORD_STATS_KEY, JSON.stringify(state));
  } catch {
    // The session remains usable in memory when storage is unavailable.
  }
}
