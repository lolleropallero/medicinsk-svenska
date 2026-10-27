import { describe, expect, it } from 'vitest';
import {
  WORD_STATS_KEY,
  createWordStatsState,
  isWordStatsState,
  loadWordStats,
  rankWeakCards,
  recordWordAttempt,
  saveWordStats,
  selectWeakCardIds,
  selectWeakCards,
  selectDifficultCardIds,
  weaknessScore,
  type WordStatsStateV1,
} from '../../src/lib/vocabulary-stats';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('word attempt recording', () => {
  it('starts empty', () => {
    expect(createWordStatsState()).toEqual({ schemaVersion: 1, cards: {} });
  });

  it('tracks attempts, misses, and a correct streak per card', () => {
    let state = createWordStatsState();
    state = recordWordAttempt(state, 'c1', false, 1_000);
    expect(state.cards.c1).toEqual({ attempts: 1, incorrect: 1, correctStreak: 0, firstAttemptCorrectStreak: 0, lastAttemptAt: 1_000, lastIncorrectAt: 1_000 });
    state = recordWordAttempt(state, 'c1', true, 2_000);
    expect(state.cards.c1).toEqual({ attempts: 2, incorrect: 1, correctStreak: 1, firstAttemptCorrectStreak: 0, lastAttemptAt: 2_000, lastIncorrectAt: 1_000 });
    state = recordWordAttempt(state, 'c1', true, 3_000);
    expect(state.cards.c1).toEqual({ attempts: 3, incorrect: 1, correctStreak: 2, firstAttemptCorrectStreak: 0, lastAttemptAt: 3_000, lastIncorrectAt: 1_000 });
  });

  it('resets the correct streak and refreshes lastIncorrectAt on a fresh miss', () => {
    let state = createWordStatsState();
    state = recordWordAttempt(state, 'c1', true, 1_000);
    state = recordWordAttempt(state, 'c1', true, 2_000);
    state = recordWordAttempt(state, 'c1', false, 3_000);
    expect(state.cards.c1).toEqual({ attempts: 3, incorrect: 1, correctStreak: 0, firstAttemptCorrectStreak: 0, lastAttemptAt: 3_000, lastIncorrectAt: 3_000 });
  });

  it('never records an explicit undefined lastIncorrectAt for an always-correct card', () => {
    let state = createWordStatsState();
    state = recordWordAttempt(state, 'c1', true, 1_000);
    expect(Object.hasOwn(state.cards.c1!, 'lastIncorrectAt')).toBe(false);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('keeps attempt records independent across cards', () => {
    let state = createWordStatsState();
    state = recordWordAttempt(state, 'a', false, 1_000);
    state = recordWordAttempt(state, 'b', true, 1_000);
    expect(state.cards.a!.incorrect).toBe(1);
    expect(state.cards.b!.incorrect).toBe(0);
  });

  it('clears review on a correct first attempt while preserving errors and attempt history', () => {
    let state = recordWordAttempt(createWordStatsState(), 'c1', false, 1_000, { firstAttempt: true });
    state = recordWordAttempt(state, 'c1', true, 2_000, { firstAttempt: true });
    expect(state.cards.c1).toEqual({ attempts: 2, incorrect: 1, correctStreak: 1, firstAttemptCorrectStreak: 1, lastAttemptAt: 2_000, lastIncorrectAt: 1_000, reviewClearedAt: 2_000 });
    expect(selectWeakCardIds(state, new Set(['c1']), 10, 2_000)).toEqual([]);
    const storage = new MemoryStorage();
    saveWordStats(state, storage);
    expect(loadWordStats(storage)).toEqual(state);
    expect(selectWeakCardIds(loadWordStats(storage), new Set(['c1']), 10, 3_000)).toEqual([]);
  });

  it('keeps a successful retry in review until a later round is correct on its first attempt', () => {
    let state = recordWordAttempt(createWordStatsState(), 'c1', false, 1_000, { firstAttempt: true });
    state = recordWordAttempt(state, 'c1', true, 2_000, { firstAttempt: false });
    expect(selectWeakCardIds(state, new Set(['c1']), 10, 2_000)).toEqual(['c1']);
    state = recordWordAttempt(state, 'c1', true, 3_000, { firstAttempt: true });
    expect(selectWeakCardIds(state, new Set(['c1']), 10, 3_000)).toEqual([]);
  });

  it('puts a cleared card back in review immediately after a later miss', () => {
    let state = recordWordAttempt(createWordStatsState(), 'c1', false, 1_000);
    state = recordWordAttempt(state, 'c1', true, 2_000, { firstAttempt: true });
    state = recordWordAttempt(state, 'c1', false, 3_000, { firstAttempt: true });
    expect(state.cards.c1!.reviewClearedAt).toBeUndefined();
    expect(state.cards.c1!.incorrect).toBe(2);
    expect(selectWeakCardIds(state, new Set(['c1']), 10, 3_000)).toEqual(['c1']);
  });
});

describe('difficult card review', () => {
  const known = new Set(['c1']);
  const missedState = (): WordStatsStateV1 => ({ schemaVersion: 1, cards: {
    c1: { attempts: 3, incorrect: 3, correctStreak: 0, lastAttemptAt: 1_000, lastIncorrectAt: 1_000 },
  } });

  it('enters on the third miss and excludes unknown cards and cards with fewer misses', () => {
    let state = createWordStatsState();
    for (let i = 1; i <= 2; i++) state = recordWordAttempt(state, 'c1', false, i, { firstAttempt: true });
    expect(selectDifficultCardIds(state, known)).toEqual([]);
    state = recordWordAttempt(state, 'c1', false, 3, { firstAttempt: false });
    expect(selectDifficultCardIds(state, known)).toEqual(['c1']);
    expect(selectDifficultCardIds(state, new Set(['other']))).toEqual([]);
  });

  it('uses saved miss history without treating legacy retries as first-attempt successes', () => {
    const state = missedState();
    state.cards.c1 = { ...state.cards.c1!, attempts: 8, correctStreak: 5, reviewClearedAt: 2_000 };
    expect(isWordStatsState(state)).toBe(true);
    expect(selectDifficultCardIds(state, known)).toEqual(['c1']);
    expect(selectWeakCardIds(state, known, 10)).toEqual([]);
  });

  it('stays after two first-attempt successes, clears after three, and returns on a later miss', () => {
    let state = missedState();
    const storage = new MemoryStorage();
    for (let streak = 1; streak <= 3; streak++) {
      state = recordWordAttempt(state, 'c1', true, 1_000 + streak, { firstAttempt: true });
      saveWordStats(state, storage);
      state = loadWordStats(storage);
      expect(state.cards.c1!.firstAttemptCorrectStreak).toBe(streak);
      expect(state.cards.c1!.incorrect).toBe(3);
      expect(selectWeakCardIds(state, known, 10)).toEqual([]);
      expect(selectDifficultCardIds(state, known)).toEqual(streak < 3 ? ['c1'] : []);
    }
    state = recordWordAttempt(state, 'c1', false, 2_000, { firstAttempt: true });
    expect(selectDifficultCardIds(state, known)).toEqual(['c1']);
    expect(state.cards.c1!.firstAttemptCorrectStreak).toBe(0);
    expect(state.cards.c1!.incorrect).toBe(4);
  });

  it('resets on a miss and never advances mastery for a correct retry', () => {
    let state = recordWordAttempt(missedState(), 'c1', true, 2_000, { firstAttempt: true });
    state = recordWordAttempt(state, 'c1', false, 3_000, { firstAttempt: true });
    for (let i = 1; i <= 5; i++) state = recordWordAttempt(state, 'c1', true, 3_000 + i, { firstAttempt: false });
    expect(state.cards.c1!.firstAttemptCorrectStreak).toBe(0);
    expect(selectDifficultCardIds(state, known)).toEqual(['c1']);
  });

  it.each([-1, 0.5, 4, Number.NaN, '2'])('rejects malformed first-attempt streak %s', streak => {
    const state = missedState();
    expect(isWordStatsState({ ...state, cards: { c1: { ...state.cards.c1, firstAttemptCorrectStreak: streak } } })).toBe(false);
  });
});

describe('weakness scoring', () => {
  it('is zero for a card that has never been missed', () => {
    expect(weaknessScore({ attempts: 5, incorrect: 0, correctStreak: 5, lastAttemptAt: 1_000 }, 1_000)).toBe(0);
  });

  it('is positive right after a miss', () => {
    const score = weaknessScore({ attempts: 1, incorrect: 1, correctStreak: 0, lastAttemptAt: 1_000, lastIncorrectAt: 1_000 }, 1_000);
    expect(score).toBeGreaterThan(0);
  });

  it('decays as the most recent miss recedes into the past', () => {
    const entry = { attempts: 3, incorrect: 1, correctStreak: 0, lastAttemptAt: 1_000, lastIncorrectAt: 1_000 };
    const fresh = weaknessScore(entry, 1_000);
    const aWeekLater = weaknessScore(entry, 1_000 + 7 * DAY_MS);
    const aMonthLater = weaknessScore(entry, 1_000 + 30 * DAY_MS);
    expect(aWeekLater).toBeLessThan(fresh);
    expect(aMonthLater).toBeLessThan(aWeekLater);
    expect(aMonthLater).toBeGreaterThan(0);
  });

  it('is dampened by an ongoing correct streak and zeroed once the word "graduates"', () => {
    const missed = { attempts: 5, incorrect: 1, correctStreak: 0, lastAttemptAt: 1_000, lastIncorrectAt: 1_000 };
    const recovering = { ...missed, correctStreak: 2, attempts: 3 };
    const graduated = { ...missed, correctStreak: 5, attempts: 6 };
    expect(weaknessScore(recovering, 1_000)).toBeLessThan(weaknessScore(missed, 1_000));
    expect(weaknessScore(graduated, 1_000)).toBe(0);
  });

  it('weighs a higher error rate more heavily at equal recency and streak', () => {
    const oneOfTwo = { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: 1_000, lastIncorrectAt: 1_000 };
    const oneOfFive = { attempts: 5, incorrect: 1, correctStreak: 0, lastAttemptAt: 1_000, lastIncorrectAt: 1_000 };
    expect(weaknessScore(oneOfTwo, 1_000)).toBeGreaterThan(weaknessScore(oneOfFive, 1_000));
  });
});

describe('weak card ranking and selection', () => {
  const stateFor = (entries: Record<string, { attempts: number; incorrect: number; correctStreak: number; lastAttemptAt: number; lastIncorrectAt?: number }>): WordStatsStateV1 =>
    ({ schemaVersion: 1, cards: entries });

  it('is empty for a brand-new learner with no history', () => {
    const state = createWordStatsState();
    expect(rankWeakCards(state, new Set(['a', 'b']), 1_000)).toEqual([]);
    expect(selectWeakCardIds(state, new Set(['a', 'b']), 10, 1_000)).toEqual([]);
  });

  it('excludes cards that have never been missed even if they were attempted', () => {
    const state = stateFor({ a: { attempts: 4, incorrect: 0, correctStreak: 4, lastAttemptAt: 1_000 } });
    expect(rankWeakCards(state, new Set(['a']), 1_000)).toEqual([]);
  });

  it('only ranks cards that are still known (published) content', () => {
    const state = stateFor({
      known: { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: 1_000, lastIncorrectAt: 1_000 },
      removed: { attempts: 2, incorrect: 2, correctStreak: 0, lastAttemptAt: 1_000, lastIncorrectAt: 1_000 },
    });
    expect(rankWeakCards(state, new Set(['known']), 1_000).map((item) => item.cardId)).toEqual(['known']);
  });

  it('ranks the most recently and severely missed word first', () => {
    const state = stateFor({
      stale: { attempts: 3, incorrect: 1, correctStreak: 0, lastAttemptAt: 1_000, lastIncorrectAt: 1_000 },
      fresh: { attempts: 3, incorrect: 2, correctStreak: 0, lastAttemptAt: 1_000 + 30 * DAY_MS, lastIncorrectAt: 1_000 + 30 * DAY_MS },
    });
    const now = 1_000 + 30 * DAY_MS;
    expect(rankWeakCards(state, new Set(['stale', 'fresh']), now).map((item) => item.cardId)).toEqual(['fresh', 'stale']);
  });

  it('breaks score ties deterministically by card ID', () => {
    const entry = { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: 1_000, lastIncorrectAt: 1_000 };
    const state = stateFor({ zeta: entry, alpha: entry });
    expect(rankWeakCards(state, new Set(['zeta', 'alpha']), 1_000).map((item) => item.cardId)).toEqual(['alpha', 'zeta']);
  });

  it('caps selection at the requested limit', () => {
    const entry = (offset: number) => ({ attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: 1_000 + offset, lastIncorrectAt: 1_000 + offset });
    const state = stateFor({ a: entry(1), b: entry(2), c: entry(3) });
    expect(selectWeakCardIds(state, new Set(['a', 'b', 'c']), 2, 2_000)).toHaveLength(2);
  });

  it('maps ranked IDs back to full card objects and drops unknown ones', () => {
    const state = stateFor({ a: { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: 1_000, lastIncorrectAt: 1_000 } });
    const cards = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];
    expect(selectWeakCards(state, cards, 10, 1_000)).toEqual([{ id: 'a', label: 'A' }]);
  });
});

describe('word-stats persistence', () => {
  it('validates schema and rejects malformed records', () => {
    expect(isWordStatsState({ schemaVersion: 1, cards: {} })).toBe(true);
    expect(isWordStatsState({ schemaVersion: 1, cards: { a: { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: 1 } } })).toBe(true);
    expect(isWordStatsState(null)).toBe(false);
    expect(isWordStatsState({ schemaVersion: 2, cards: {} })).toBe(false);
    expect(isWordStatsState({ schemaVersion: 1, cards: [] })).toBe(false);
    expect(isWordStatsState({ schemaVersion: 1, cards: { a: { attempts: 1, incorrect: 2, correctStreak: 0, lastAttemptAt: 1 } } })).toBe(false);
    expect(isWordStatsState({ schemaVersion: 1, cards: { a: { attempts: 1, incorrect: 0, correctStreak: 0, lastAttemptAt: -1 } } })).toBe(false);
    expect(isWordStatsState({ schemaVersion: 1, cards: { a: { attempts: 2, incorrect: 1, correctStreak: 1, lastAttemptAt: 2, reviewClearedAt: -1 } } })).toBe(false);
  });

  it('loads a fresh state when storage is empty or corrupt', () => {
    const storage = new MemoryStorage();
    expect(loadWordStats(storage)).toEqual(createWordStatsState());
    storage.setItem(WORD_STATS_KEY, '{not json');
    expect(loadWordStats(storage)).toEqual(createWordStatsState());
    storage.setItem(WORD_STATS_KEY, JSON.stringify({ schemaVersion: 99 }));
    expect(loadWordStats(storage)).toEqual(createWordStatsState());
  });

  it('round-trips a recorded attempt through save and load', () => {
    const storage = new MemoryStorage();
    const state = recordWordAttempt(createWordStatsState(), 'c1', false, 1_000);
    saveWordStats(state, storage);
    expect(loadWordStats(storage)).toEqual(state);
  });
});
