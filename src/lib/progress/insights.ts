import { addLocalDays, daysBetween, localDayKey } from './calendar';
import type { ExerciseMode, ProgressStateV1 } from './types';
import { rankWeakCards, type WordStatsStateV1 } from '../vocabulary-stats';

// Recency window used to decide whether a week-over-week trend is meaningful (needs two full weeks
// of possible history since account creation, otherwise an early learner would just see noise).
const TREND_HISTORY_DAYS = 13;
const TREND_RATIO_UP = 1.1;
const TREND_RATIO_DOWN = 0.9;
const DEFAULT_CATEGORY_MIN_ATTEMPTS = 5;
const DEFAULT_CATEGORY_COUNT = 2;
const DEFAULT_HARDEST_WORDS_LIMIT = 5;
const MODE_VOLUME_WINDOW_DAYS = 30;
const EXERCISE_MODES: readonly ExerciseMode[] = ['flashcards', 'phrases', 'descriptions'];

export interface InsightsCard {
  id: string;
  deckId: string;
  fi: string;
  sv: string;
  article?: 'en' | 'ett';
}

export interface InsightsDeck {
  id: string;
  nameFi: string;
}

export interface ActivityWindow {
  activeDays: number;
  itemsStudied: number;
  activeMinutes: number;
}

export type ActivityTrend = 'up' | 'down' | 'flat' | null;

export interface RecentActivity {
  last7: ActivityWindow;
  last30: ActivityWindow;
  trend: ActivityTrend;
}

export interface AccuracySummary {
  attempts: number;
  incorrect: number;
  correct: number;
  accuracyPercent: number | null;
}

export interface ModeVolume {
  mode: ExerciseMode;
  items: number;
}

export interface CategoryStat {
  deckId: string;
  nameFi: string;
  attempts: number;
  incorrect: number;
  accuracyPercent: number;
}

export interface HardestWord {
  cardId: string;
  fi: string;
  sv: string;
  article?: 'en' | 'ett';
  deckId: string;
  deckNameFi: string;
  attempts: number;
  incorrect: number;
  score: number;
}

export interface InsightsSummary {
  hasHistory: boolean;
  activity: RecentActivity;
  accuracy: AccuracySummary;
  modeVolume: ModeVolume[];
  strongestCategories: CategoryStat[];
  weakestCategories: CategoryStat[];
  hardestWords: HardestWord[];
}

/** Local day keys for the trailing `count` days, oldest first, ending today. */
export function recentDayKeys(now: number, count: number): string[] {
  const today = localDayKey(now);
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const key = addLocalDays(today, -offset);
    if (key) keys.push(key);
  }
  return keys;
}

export function activityWindow(daily: ProgressStateV1['daily'], dayKeys: readonly string[]): ActivityWindow {
  let activeDays = 0;
  let itemsStudied = 0;
  let activeMs = 0;
  for (const key of dayKeys) {
    const day = daily[key];
    if (!day) continue;
    if (day.uniqueItemIds.length > 0) activeDays += 1;
    itemsStudied += day.uniqueItemIds.length;
    activeMs += day.activeStudyMs;
  }
  return { activeDays, itemsStudied, activeMinutes: Math.floor(activeMs / 60_000) };
}

export function recentActivity(
  progress: Pick<ProgressStateV1, 'daily' | 'createdAt'>,
  now = Date.now(),
): RecentActivity {
  const days30 = recentDayKeys(now, 30);
  const last7Keys = days30.slice(23);
  const prior7Keys = days30.slice(16, 23);
  const last7 = activityWindow(progress.daily, last7Keys);
  const last30 = activityWindow(progress.daily, days30);
  const prior7 = activityWindow(progress.daily, prior7Keys);

  const historyLongEnough = (daysBetween(localDayKey(progress.createdAt), localDayKey(now)) ?? 0) >= TREND_HISTORY_DAYS;
  let trend: ActivityTrend = null;
  if (historyLongEnough) {
    if (last7.itemsStudied > prior7.itemsStudied * TREND_RATIO_UP) trend = 'up';
    else if (prior7.itemsStudied > 0 && last7.itemsStudied < prior7.itemsStudied * TREND_RATIO_DOWN) trend = 'down';
    else trend = 'flat';
  }
  return { last7, last30, trend };
}

/** Attempt-level accuracy from Smart Review's per-word stats, scoped to cards that still exist. */
export function wordAccuracy(wordStats: WordStatsStateV1, knownCardIds: ReadonlySet<string>): AccuracySummary {
  let attempts = 0;
  let incorrect = 0;
  for (const [cardId, entry] of Object.entries(wordStats.cards)) {
    if (!knownCardIds.has(cardId)) continue;
    attempts += entry.attempts;
    incorrect += entry.incorrect;
  }
  const correct = attempts - incorrect;
  return { attempts, incorrect, correct, accuracyPercent: attempts > 0 ? Math.round((correct / attempts) * 100) : null };
}

/** How many items were studied per top-level exercise mode over the trailing window. */
export function modeVolume(
  progress: Pick<ProgressStateV1, 'daily'>,
  now = Date.now(),
  windowDays = MODE_VOLUME_WINDOW_DAYS,
): ModeVolume[] {
  const counts: Record<ExerciseMode, number> = { flashcards: 0, phrases: 0, descriptions: 0 };
  for (const key of recentDayKeys(now, windowDays)) {
    const day = progress.daily[key];
    if (!day) continue;
    for (const uniqueId of day.uniqueItemIds) {
      const mode = uniqueId.slice(0, uniqueId.indexOf(':'));
      if (mode === 'flashcards' || mode === 'phrases' || mode === 'descriptions') counts[mode] += 1;
    }
  }
  return EXERCISE_MODES.map((mode) => ({ mode, items: counts[mode] }));
}

/** Per-deck accuracy from word-stats, ranked best-first; decks below the attempt threshold are dropped as noise. */
export function categoryStats(
  wordStats: WordStatsStateV1,
  cards: readonly InsightsCard[],
  decks: readonly InsightsDeck[],
  minAttempts = DEFAULT_CATEGORY_MIN_ATTEMPTS,
): CategoryStat[] {
  const deckNameById = new Map(decks.map((deck) => [deck.id, deck.nameFi]));
  const deckIdByCard = new Map(cards.map((card) => [card.id, card.deckId]));
  const totals = new Map<string, { attempts: number; incorrect: number }>();
  for (const [cardId, entry] of Object.entries(wordStats.cards)) {
    const deckId = deckIdByCard.get(cardId);
    if (!deckId) continue;
    const bucket = totals.get(deckId) ?? { attempts: 0, incorrect: 0 };
    bucket.attempts += entry.attempts;
    bucket.incorrect += entry.incorrect;
    totals.set(deckId, bucket);
  }
  const stats: CategoryStat[] = [];
  for (const [deckId, { attempts, incorrect }] of totals) {
    if (attempts < minAttempts) continue;
    const nameFi = deckNameById.get(deckId);
    if (!nameFi) continue;
    stats.push({ deckId, nameFi, attempts, incorrect, accuracyPercent: Math.round(((attempts - incorrect) / attempts) * 100) });
  }
  return stats.sort((a, b) => b.accuracyPercent - a.accuracyPercent || b.attempts - a.attempts || a.deckId.localeCompare(b.deckId));
}

export function strongestWeakestCategories(
  stats: readonly CategoryStat[],
  count = DEFAULT_CATEGORY_COUNT,
): { strongest: CategoryStat[]; weakest: CategoryStat[] } {
  const strongest = stats.slice(0, count);
  const strongestIds = new Set(strongest.map((item) => item.deckId));
  const weakest: CategoryStat[] = [];
  for (let index = stats.length - 1; index >= 0 && weakest.length < count; index -= 1) {
    const item = stats[index]!;
    if (!strongestIds.has(item.deckId)) weakest.push(item);
  }
  return { strongest, weakest };
}

/** The learner's current hardest words, reusing Smart Review's own weakness ranking. */
export function hardestWords(
  wordStats: WordStatsStateV1,
  cards: readonly InsightsCard[],
  decks: readonly InsightsDeck[],
  limit = DEFAULT_HARDEST_WORDS_LIMIT,
  now = Date.now(),
): HardestWord[] {
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const deckNameById = new Map(decks.map((deck) => [deck.id, deck.nameFi]));
  const ranked = rankWeakCards(wordStats, new Set(cardById.keys()), now).slice(0, Math.max(0, limit));
  return ranked.map(({ cardId, score }) => {
    const card = cardById.get(cardId)!;
    const entry = wordStats.cards[cardId]!;
    return {
      cardId,
      fi: card.fi,
      sv: card.sv,
      ...(card.article ? { article: card.article } : {}),
      deckId: card.deckId,
      deckNameFi: deckNameById.get(card.deckId) ?? '',
      attempts: entry.attempts,
      incorrect: entry.incorrect,
      score,
    };
  });
}

export interface InsightsInput {
  progress: Pick<ProgressStateV1, 'daily' | 'createdAt' | 'lifetime'>;
  wordStats: WordStatsStateV1;
  cards: readonly InsightsCard[];
  decks: readonly InsightsDeck[];
  now?: number;
}

export function buildInsightsSummary({ progress, wordStats, cards, decks, now = Date.now() }: InsightsInput): InsightsSummary {
  const knownCardIds = new Set(cards.map((card) => card.id));
  const accuracy = wordAccuracy(wordStats, knownCardIds);
  const stats = categoryStats(wordStats, cards, decks);
  // A single strongest/weakest pair keeps the card compact and, critically, stays distinct even
  // when only two categories qualify (a top-2/top-2 split would otherwise swallow both into
  // "strongest" and leave "weakest" empty).
  const { strongest, weakest } = strongestWeakestCategories(stats, 1);
  return {
    hasHistory: progress.lifetime.completedItems > 0 || accuracy.attempts > 0,
    activity: recentActivity(progress, now),
    accuracy,
    modeVolume: modeVolume(progress, now),
    strongestCategories: strongest,
    weakestCategories: weakest,
    hardestWords: hardestWords(wordStats, cards, decks, DEFAULT_HARDEST_WORDS_LIMIT, now),
  };
}
