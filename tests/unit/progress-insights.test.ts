import { describe, expect, it } from 'vitest';
import { createProgressState, emptyDay } from '../../src/lib/progress/core';
import type { ProgressStateV1 } from '../../src/lib/progress/types';
import type { WordStatsStateV1 } from '../../src/lib/vocabulary-stats';
import {
  activityWindow,
  buildInsightsSummary,
  categoryStats,
  hardestWords,
  modeVolume,
  recentActivity,
  recentDayKeys,
  strongestWeakestCategories,
  wordAccuracy,
  type InsightsCard,
  type InsightsDeck,
} from '../../src/lib/progress/insights';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date(2026, 7, 24, 12).getTime(); // 2026-08-24, well clear of DST edges

const wordStatsOf = (
  cards: Record<string, { attempts: number; incorrect: number; correctStreak: number; lastAttemptAt: number; lastIncorrectAt?: number }>,
): WordStatsStateV1 => ({ schemaVersion: 1, cards });

const CARDS: InsightsCard[] = [
  { id: 'anatomi-1', deckId: 'anatomi', fi: 'sydän', sv: 'hjärtat' },
  { id: 'anatomi-2', deckId: 'anatomi', fi: 'maksa', sv: 'levern' },
  { id: 'sjukdomar-1', deckId: 'sjukdomar', fi: 'kuume', sv: 'feber' },
  { id: 'sjukdomar-2', deckId: 'sjukdomar', fi: 'yskä', sv: 'hosta' },
];
const DECKS: InsightsDeck[] = [
  { id: 'anatomi', nameFi: 'Anatomia' },
  { id: 'sjukdomar', nameFi: 'Sairaudet ja vaivat' },
];

function withDay(state: ProgressStateV1, key: string, mutate: (day: ReturnType<typeof emptyDay>) => void): ProgressStateV1 {
  const day = state.daily[key] ?? emptyDay(state, key);
  mutate(day);
  state.daily[key] = day;
  return state;
}

describe('recentDayKeys', () => {
  it('returns count consecutive local day keys, oldest first, ending today', () => {
    const keys = recentDayKeys(now, 7);
    expect(keys).toHaveLength(7);
    expect(keys[6]).toBe('2026-08-24');
    expect(keys[0]).toBe('2026-08-18');
    expect(keys).toEqual([...keys].sort());
  });
});

describe('activityWindow', () => {
  it('sums items, active days, and minutes across the given keys, treating missing days as zero', () => {
    const daily: ProgressStateV1['daily'] = {
      '2026-08-24': { ...emptyDay(createProgressState(now, 'x'), '2026-08-24'), uniqueItemIds: ['flashcards:a', 'flashcards:b'], activeStudyMs: 90_000 },
      '2026-08-23': { ...emptyDay(createProgressState(now, 'x'), '2026-08-23'), uniqueItemIds: [], activeStudyMs: 0 },
    };
    const window = activityWindow(daily, ['2026-08-22', '2026-08-23', '2026-08-24']);
    expect(window).toEqual({ activeDays: 1, itemsStudied: 2, activeMinutes: 1 });
  });
});

describe('recentActivity', () => {
  const stateWithItems = (perDay: Record<string, number>) => {
    let state = createProgressState(now - 20 * DAY_MS, 'trend');
    for (const [key, count] of Object.entries(perDay)) {
      state = withDay(state, key, (day) => { day.uniqueItemIds = Array.from({ length: count }, (_, i) => `flashcards:${key}-${i}`); });
    }
    return state;
  };

  it('reports an upward trend when the last 7 days clearly beat the prior 7', () => {
    const state = stateWithItems({ '2026-08-24': 15, '2026-08-11': 10 });
    expect(recentActivity(state, now).trend).toBe('up');
  });

  it('reports a downward trend when the last 7 days clearly trail the prior 7', () => {
    const state = stateWithItems({ '2026-08-24': 5, '2026-08-11': 10 });
    expect(recentActivity(state, now).trend).toBe('down');
  });

  it('reports flat when both windows are within 10% of each other, including both-zero', () => {
    expect(recentActivity(stateWithItems({ '2026-08-24': 10, '2026-08-11': 10 }), now).trend).toBe('flat');
    expect(recentActivity(stateWithItems({}), now).trend).toBe('flat');
  });

  it('withholds a trend until the account has at least two full weeks of possible history', () => {
    const freshState = createProgressState(now - 5 * DAY_MS, 'fresh-trend');
    expect(recentActivity(freshState, now).trend).toBeNull();
  });

  it('splits a 30-day window into last-7 and last-30 correctly', () => {
    const state = stateWithItems({ '2026-08-24': 4, '2026-08-01': 3 });
    const activity = recentActivity(state, now);
    expect(activity.last7.itemsStudied).toBe(4);
    expect(activity.last30.itemsStudied).toBe(7);
  });
});

describe('wordAccuracy', () => {
  it('aggregates attempts and incorrect counts across known cards only', () => {
    const stats = wordStatsOf({
      'anatomi-1': { attempts: 5, incorrect: 2, correctStreak: 0, lastAttemptAt: now },
      'removed-card': { attempts: 9, incorrect: 9, correctStreak: 0, lastAttemptAt: now },
    });
    const result = wordAccuracy(stats, new Set(CARDS.map((c) => c.id)));
    expect(result).toEqual({ attempts: 5, incorrect: 2, correct: 3, accuracyPercent: 60 });
  });

  it('reports a null accuracy percent when nothing has been attempted', () => {
    expect(wordAccuracy(wordStatsOf({}), new Set(['a']))).toEqual({ attempts: 0, incorrect: 0, correct: 0, accuracyPercent: null });
  });
});

describe('modeVolume', () => {
  it('tallies items studied per mode within the window and ignores older days', () => {
    let state = createProgressState(now, 'mode-volume');
    state = withDay(state, '2026-08-24', (day) => { day.uniqueItemIds = ['flashcards:a', 'flashcards:b', 'phrases:p1']; });
    state = withDay(state, '2026-06-01', (day) => { day.uniqueItemIds = ['descriptions:d1']; });
    const volume = modeVolume(state, now, 30);
    expect(volume).toEqual([
      { mode: 'flashcards', items: 2 },
      { mode: 'phrases', items: 1 },
      { mode: 'descriptions', items: 0 },
    ]);
  });
});

describe('categoryStats', () => {
  it('ranks decks by accuracy, drops decks below the attempt threshold, and ignores unknown cards/decks', () => {
    const stats = wordStatsOf({
      'anatomi-1': { attempts: 4, incorrect: 0, correctStreak: 4, lastAttemptAt: now },
      'anatomi-2': { attempts: 2, incorrect: 0, correctStreak: 2, lastAttemptAt: now }, // 6 attempts total, 100%
      'sjukdomar-1': { attempts: 5, incorrect: 3, correctStreak: 0, lastAttemptAt: now }, // 5 attempts, 40%
      'sjukdomar-2': { attempts: 2, incorrect: 2, correctStreak: 0, lastAttemptAt: now }, // below threshold alone but merges into sjukdomar
      unknownCard: { attempts: 10, incorrect: 10, correctStreak: 0, lastAttemptAt: now },
    });
    const result = categoryStats(stats, CARDS, DECKS, 5);
    expect(result).toEqual([
      { deckId: 'anatomi', nameFi: 'Anatomia', attempts: 6, incorrect: 0, accuracyPercent: 100 },
      { deckId: 'sjukdomar', nameFi: 'Sairaudet ja vaivat', attempts: 7, incorrect: 5, accuracyPercent: 29 },
    ]);
  });

  it('drops a deck entirely when it never reaches the minimum attempt count', () => {
    const stats = wordStatsOf({ 'anatomi-1': { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: now } });
    expect(categoryStats(stats, CARDS, DECKS, 5)).toEqual([]);
  });
});

describe('strongestWeakestCategories', () => {
  it('never lists the same category as both strongest and weakest', () => {
    const stats = [
      { deckId: 'a', nameFi: 'A', attempts: 10, incorrect: 0, accuracyPercent: 100 },
      { deckId: 'b', nameFi: 'B', attempts: 10, incorrect: 5, accuracyPercent: 50 },
      { deckId: 'c', nameFi: 'C', attempts: 10, incorrect: 9, accuracyPercent: 10 },
    ];
    const { strongest, weakest } = strongestWeakestCategories(stats, 2);
    expect(strongest.map((s) => s.deckId)).toEqual(['a', 'b']);
    expect(weakest.map((s) => s.deckId)).toEqual(['c']);
  });

  it('returns an empty weakest list when there is only one qualifying category', () => {
    const stats = [{ deckId: 'a', nameFi: 'A', attempts: 10, incorrect: 0, accuracyPercent: 100 }];
    const { strongest, weakest } = strongestWeakestCategories(stats, 2);
    expect(strongest).toHaveLength(1);
    expect(weakest).toEqual([]);
  });
});

describe('hardestWords', () => {
  it('reuses Smart Review weakness ranking and joins in card and deck details', () => {
    const stats = wordStatsOf({
      'anatomi-1': { attempts: 3, incorrect: 2, correctStreak: 0, lastAttemptAt: now, lastIncorrectAt: now },
      'anatomi-2': { attempts: 6, incorrect: 1, correctStreak: 5, lastAttemptAt: now, lastIncorrectAt: now - DAY_MS }, // graduated, excluded
    });
    const result = hardestWords(stats, CARDS, DECKS, 5, now);
    expect(result).toEqual([
      { cardId: 'anatomi-1', fi: 'sydän', sv: 'hjärtat', deckId: 'anatomi', deckNameFi: 'Anatomia', attempts: 3, incorrect: 2, score: expect.any(Number) },
    ]);
  });

  it('respects the requested limit', () => {
    const stats = wordStatsOf(Object.fromEntries(CARDS.map((card, index) => [
      card.id, { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: now - index, lastIncorrectAt: now - index },
    ])));
    expect(hardestWords(stats, CARDS, DECKS, 2, now)).toHaveLength(2);
  });
});

describe('buildInsightsSummary', () => {
  it('reports no history for a brand-new learner without fabricating any stats', () => {
    const state = createProgressState(now, 'brand-new');
    const summary = buildInsightsSummary({ progress: state, wordStats: wordStatsOf({}), cards: CARDS, decks: DECKS, now });
    expect(summary.hasHistory).toBe(false);
    expect(summary.activity.last7).toEqual({ activeDays: 0, itemsStudied: 0, activeMinutes: 0 });
    expect(summary.accuracy).toEqual({ attempts: 0, incorrect: 0, correct: 0, accuracyPercent: null });
    expect(summary.modeVolume.every((m) => m.items === 0)).toBe(true);
    expect(summary.strongestCategories).toEqual([]);
    expect(summary.weakestCategories).toEqual([]);
    expect(summary.hardestWords).toEqual([]);
  });

  it('flags history from lifetime completions even if the last 30 days are quiet', () => {
    const state = createProgressState(now - 60 * DAY_MS, 'dormant');
    state.lifetime.completedItems = 12;
    const summary = buildInsightsSummary({ progress: state, wordStats: wordStatsOf({}), cards: CARDS, decks: DECKS, now });
    expect(summary.hasHistory).toBe(true);
    expect(summary.activity.last30.itemsStudied).toBe(0);
  });

  it('keeps strongest and weakest distinct when exactly two categories qualify', () => {
    const state = createProgressState(now - 20 * DAY_MS, 'two-categories');
    const stats = wordStatsOf({
      'anatomi-1': { attempts: 5, incorrect: 1, correctStreak: 0, lastAttemptAt: now }, // anatomi 80%
      'sjukdomar-1': { attempts: 5, incorrect: 4, correctStreak: 0, lastAttemptAt: now, lastIncorrectAt: now }, // sjukdomar 20%
    });
    const summary = buildInsightsSummary({ progress: state, wordStats: stats, cards: CARDS, decks: DECKS, now });
    expect(summary.strongestCategories.map((c) => c.deckId)).toEqual(['anatomi']);
    expect(summary.weakestCategories.map((c) => c.deckId)).toEqual(['sjukdomar']);
  });

  it('wires accuracy, categories, and hardest words together for an active learner', () => {
    const state = createProgressState(now - 20 * DAY_MS, 'active');
    withDay(state, '2026-08-24', (day) => { day.uniqueItemIds = ['flashcards:anatomi-1', 'flashcards:anatomi-2']; });
    const stats = wordStatsOf({
      'anatomi-1': { attempts: 5, incorrect: 3, correctStreak: 0, lastAttemptAt: now, lastIncorrectAt: now },
      'anatomi-2': { attempts: 5, incorrect: 0, correctStreak: 5, lastAttemptAt: now },
    });
    const summary = buildInsightsSummary({ progress: state, wordStats: stats, cards: CARDS, decks: DECKS, now });
    expect(summary.hasHistory).toBe(true);
    expect(summary.accuracy).toEqual({ attempts: 10, incorrect: 3, correct: 7, accuracyPercent: 70 });
    expect(summary.hardestWords[0]?.cardId).toBe('anatomi-1');
    expect(summary.activity.last7.itemsStudied).toBe(2);
  });
});
