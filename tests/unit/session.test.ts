import { describe, expect, it } from 'vitest';
import {
  RETRY_DELAY_MS,
  advanceSession,
  cardSides,
  createNewRoundSession,
  createSession,
  gradeCurrentCard,
  isSessionComplete,
  isStoredSession,
  revealCurrentCard,
  seededRandom,
  selectSessionCards,
  summarizeSession,
  type FlashcardSession,
  type SessionValidationContext,
} from '../../src/lib/session';
import type { FlashcardClient } from '../../src/types/content';

const card = (n: number, deckId = 'd'): FlashcardClient => ({
  id: `c${n}`,
  deckId,
  fi: `fi${n}`,
  sv: `sv${n}`,
  article: 'en',
  partOfSpeech: 'noun',
});
const options = { sessionId: 'session-1', mode: 'deck' as const, sourceDeckId: 'd', direction: 'fi-sv' as const, requestedAmount: 10 as const };
const contextFor = (
  session: FlashcardSession,
  cardDeckById = new Map(session.selectedCardIds.map((id) => [id, 'd'])),
  expected: Parameters<typeof createSession>[1] = options,
): SessionValidationContext => ({ cardDeckById, validDeckIds: new Set(['d', 'other']), expected });

describe('flashcard selection', () => {
  it('selects the correct card sides in both directions', () => {
    expect(cardSides(card(1), 'fi-sv')).toEqual({ front: 'fi1', back: 'en sv1' });
    expect(cardSides(card(1), 'sv-fi')).toEqual({ front: 'en sv1', back: 'fi1' });
  });

  it.each([10, 25, 50] as const)('selects at most %s unique random cards', (amount) => {
    const chosen = selectSessionCards(Array.from({ length: 70 }, (_, index) => card(index)), amount, seededRandom(4));
    expect(chosen).toHaveLength(amount);
    expect(new Set(chosen.map((item) => item.id)).size).toBe(amount);
  });

  it('uses the whole smaller pool and shuffles Kaikki', () => {
    const items = Array.from({ length: 7 }, (_, index) => card(index));
    expect(selectSessionCards(items, 50, seededRandom(2))).toHaveLength(7);
    expect(selectSessionCards(items, 'all', seededRandom(9)).map((item) => item.id)).not.toEqual(items.map((item) => item.id));
  });

  it('is deterministic with an injected random source', () => {
    const items = Array.from({ length: 60 }, (_, index) => card(index));
    expect(selectSessionCards(items, 25, seededRandom(9)).map((item) => item.id)).toEqual(
      selectSessionCards(items, 25, seededRandom(9)).map((item) => item.id),
    );
  });

  it('deduplicates identities in an already published client pool', () => {
    const duplicate = card(1);
    expect(selectSessionCards([duplicate, duplicate], 10, seededRandom(1)).map((item) => item.id)).toEqual(['c1']);
  });
});

describe('persisted session state', () => {
  it('stores the selection and starts with one current card', () => {
    const session = createSession(Array.from({ length: 12 }, (_, index) => card(index)), options, 1_000, seededRandom(1));
    expect(session.selectedCardIds).toHaveLength(10);
    expect(session.currentCardId).toBe(session.selectedCardIds[0]);
    expect(session.unseenCardQueue).toEqual(session.selectedCardIds.slice(1));
    expect(session.startedAt).toBe(1_000);
  });

  it('masters a correct card and immediately advances', () => {
    const initial = createSession([card(1), card(2)], options, 1_000, seededRandom(1));
    const firstId = initial.currentCardId!;
    const graded = gradeCurrentCard(revealCurrentCard(initial), true, 2_000);
    expect(graded.masteredCardIds).toEqual([firstId]);
    expect(graded.currentCardId).not.toBe(firstId);
    expect(graded.firstAttemptCorrectByCard[firstId]).toBe(true);
    expect(graded.attemptCountByCard[firstId]).toBe(1);
    expect(gradeCurrentCard(graded, true, 2_001)).toEqual(graded);
  });

  it('schedules En osannut at the two-minute cap while unseen cards remain', () => {
    const initial = createSession([card(1), card(2)], options, 1_000, seededRandom(1));
    const firstId = initial.currentCardId!;
    const missed = gradeCurrentCard(revealCurrentCard(initial), false, 2_000);
    expect(missed.pendingRetries).toEqual([{ cardId: firstId, dueAt: 2_000 + RETRY_DELAY_MS }]);
    expect(missed.currentCardId).not.toBe(firstId);
    expect(missed.totalMissedCount).toBe(1);
    expect(missed.firstAttemptCorrectByCard[firstId]).toBe(false);
    expect(isSessionComplete(missed)).toBe(false);
  });

  it('replays a failed final card immediately and completes only after it is mastered', () => {
    const initial = createSession([card(1)], options, 1_000, seededRandom(1));
    const firstId = initial.currentCardId!;
    const missed = gradeCurrentCard(revealCurrentCard(initial), false, 2_000);
    expect(missed.currentCardId).toBe(firstId);
    expect(missed.pendingRetries).toEqual([]);
    expect(missed.totalMissedCount).toBe(1);
    expect(isSessionComplete(missed)).toBe(false);
    const completed = gradeCurrentCard(revealCurrentCard(missed), true, 2_001);
    expect(completed.attemptCountByCard[firstId]).toBe(2);
    expect(completed.firstAttemptCorrectByCard[firstId]).toBe(false);
    expect(isSessionComplete(completed)).toBe(true);
  });

  it('replays a missed card immediately when normal cards are exhausted before the cap', () => {
    const initial = createSession([card(1), card(2)], options, 1_000, seededRandom(1));
    const firstId = initial.currentCardId!;
    let session = gradeCurrentCard(revealCurrentCard(initial), false, 2_000);
    expect(session.pendingRetries).toEqual([{ cardId: firstId, dueAt: 2_000 + RETRY_DELAY_MS }]);
    expect(session.currentCardId).not.toBe(firstId);
    session = gradeCurrentCard(revealCurrentCard(session), true, 3_000);
    expect(session.currentCardId).toBe(firstId);
    expect(session.pendingRetries).toEqual([]);
  });

  it('prioritizes a retry that reaches the cap over remaining unseen cards', () => {
    const initial = createSession([card(1), card(2), card(3)], options, 1_000, seededRandom(1));
    const firstId = initial.currentCardId!;
    let session = gradeCurrentCard(revealCurrentCard(initial), false, 2_000);
    expect(session.currentCardId).not.toBe(firstId);
    session = gradeCurrentCard(revealCurrentCard(session), true, 2_000 + RETRY_DELAY_MS + 1);
    expect(session.currentCardId).toBe(firstId);
    expect(session.pendingRetries).toEqual([]);
    expect(session.unseenCardQueue).toHaveLength(1);
  });

  it('accepts a valid serialized state and rejects unknown card references', () => {
    const session = createSession([card(1)], options, 1_000, seededRandom(1));
    const context = contextFor(session);
    expect(isStoredSession(JSON.parse(JSON.stringify(session)), context)).toBe(true);
    expect(isStoredSession({ ...session, currentCardId: 'missing' }, context)).toBe(false);
  });

  it('rejects an unknown source deck', () => {
    const session = createSession([card(1)], options, 1_000, seededRandom(1));
    expect(isStoredSession({ ...session, sourceDeckId: 'missing' }, contextFor(session))).toBe(false);
  });

  it('rejects a selected card from the wrong deck', () => {
    const session = createSession([card(1), card(2)], options, 1_000, seededRandom(1));
    const cardDecks = new Map(session.selectedCardIds.map((id, index) => [id, index === 0 ? 'other' : 'd']));
    expect(isStoredSession(session, contextFor(session, cardDecks))).toBe(false);
  });

  it('rejects deck mode without a source deck and lucky mode with one', () => {
    const deckSession = createSession([card(1)], options, 1_000, seededRandom(1));
    expect(isStoredSession({ ...deckSession, sourceDeckId: undefined }, contextFor(deckSession))).toBe(false);
    const luckyOptions = { sessionId: options.sessionId, mode: 'lucky' as const, direction: options.direction, requestedAmount: options.requestedAmount };
    const luckySession = createSession([card(1)], luckyOptions, 1_000, seededRandom(1));
    expect(isStoredSession({ ...luckySession, sourceDeckId: 'd' }, contextFor(luckySession, undefined, luckyOptions))).toBe(false);
  });

  it('rejects URL and stored direction or amount mismatches', () => {
    const session = createSession([card(1)], options, 1_000, seededRandom(1));
    expect(isStoredSession(session, contextFor(session, undefined, { ...options, direction: 'sv-fi' }))).toBe(false);
    expect(isStoredSession(session, contextFor(session, undefined, { ...options, requestedAmount: 25 }))).toBe(false);
  });

  it('rejects empty session IDs and revealed state without a current card', () => {
    const session = createSession([card(1)], options, 1_000, seededRandom(1));
    expect(isStoredSession({ ...session, sessionId: '' }, contextFor(session))).toBe(false);
    expect(isStoredSession({ ...session, currentCardId: null, unseenCardQueue: [session.currentCardId!], revealed: true }, contextFor(session))).toBe(false);
  });

  it('rejects completed state containing pending cards', () => {
    const initial = createSession([card(1)], options, 1_000, seededRandom(1));
    const completed = gradeCurrentCard(revealCurrentCard(initial), true, 2_000);
    const malformed = { ...completed, pendingRetries: [{ cardId: completed.masteredCardIds[0]!, dueAt: 3_000 }] };
    expect(isStoredSession(malformed, contextFor(completed))).toBe(false);
  });

  it('rejects overlapping state sets', () => {
    const session = createSession([card(1), card(2)], options, 1_000, seededRandom(1));
    expect(isStoredSession({ ...session, unseenCardQueue: [session.currentCardId, ...session.unseenCardQueue] }, contextFor(session))).toBe(false);
  });

  it('rejects malformed counters, timestamps, schema, and attempt keys', () => {
    const session = createSession([card(1), card(2)], options, 1_000, seededRandom(1));
    const context = contextFor(session);
    expect(isStoredSession({ ...session, schemaVersion: 2 }, context)).toBe(false);
    expect(isStoredSession({ ...session, startedAt: Number.POSITIVE_INFINITY }, context)).toBe(false);
    expect(isStoredSession({ ...session, totalMissedCount: -1 }, context)).toBe(false);
    expect(isStoredSession({ ...session, pendingRetries: [{ cardId: session.unseenCardQueue[0], dueAt: Number.NaN }] }, context)).toBe(false);
    expect(isStoredSession({ ...session, attemptCountByCard: { [session.currentCardId!]: 1.5 }, firstAttemptCorrectByCard: { [session.currentCardId!]: true } }, context)).toBe(false);
    expect(isStoredSession({ ...session, attemptCountByCard: { missing: 1 }, firstAttemptCorrectByCard: { missing: true } }, context)).toBe(false);
  });
});

describe('session summary', () => {
  it('reports zero first-attempt successes', () => {
    const session = createSession([card(1), card(2)], options, 1_000, seededRandom(1));
    session.firstAttemptCorrectByCard = Object.fromEntries(session.selectedCardIds.map((id) => [id, false]));
    expect(summarizeSession(session)).toEqual({ firstAttemptCorrect: 0, selectedCount: 2, totalMissedCount: 0 });
  });

  it('reports all first-attempt successes', () => {
    const session = createSession([card(1), card(2)], options, 1_000, seededRandom(1));
    session.firstAttemptCorrectByCard = Object.fromEntries(session.selectedCardIds.map((id) => [id, true]));
    expect(summarizeSession(session).firstAttemptCorrect).toBe(2);
  });

  it('reports mixed first attempts and every repeated failure without changing after mastery', () => {
    let session = createSession([card(1), card(2)], options, 1_000, seededRandom(1));
    session = gradeCurrentCard(revealCurrentCard(session), true, 2_000);
    const missedId = session.currentCardId!;
    session = gradeCurrentCard(revealCurrentCard(session), false, 3_000);
    session = advanceSession(session, 3_000 + RETRY_DELAY_MS);
    session = gradeCurrentCard(revealCurrentCard(session), false, 3_000 + RETRY_DELAY_MS);
    session = advanceSession(session, 3_000 + (2 * RETRY_DELAY_MS));
    session = gradeCurrentCard(revealCurrentCard(session), true, 3_001 + (2 * RETRY_DELAY_MS));
    expect(session.firstAttemptCorrectByCard[missedId]).toBe(false);
    expect(summarizeSession(session)).toEqual({ firstAttemptCorrect: 1, selectedCount: 2, totalMissedCount: 2 });
  });
});

describe('new round', () => {
  it('uses a new ID and timestamp while retaining configuration and resetting state', () => {
    const previous = createSession(Array.from({ length: 12 }, (_, index) => card(index)), options, 1_000, seededRandom(2));
    const progressed = gradeCurrentCard(revealCurrentCard(previous), false, 2_000);
    const next = createNewRoundSession(Array.from({ length: 12 }, (_, index) => card(index)), progressed, 'session-2', 9_000, seededRandom(3));
    expect(next.sessionId).toBe('session-2');
    expect(next.sessionId).not.toBe(previous.sessionId);
    expect(next.startedAt).toBe(9_000);
    expect(next).toMatchObject({ mode: 'deck', sourceDeckId: 'd', direction: 'fi-sv', requestedAmount: 10 });
    expect(next.masteredCardIds).toEqual([]);
    expect(next.pendingRetries).toEqual([]);
    expect(next.attemptCountByCard).toEqual({});
    expect(next.firstAttemptCorrectByCard).toEqual({});
    expect(next.totalMissedCount).toBe(0);
    expect(next.revealed).toBe(false);
  });

  it('creates deterministic fresh selection and order with injected randomness', () => {
    const pool = Array.from({ length: 20 }, (_, index) => card(index));
    const previous = createSession(pool, options, 1_000, seededRandom(1));
    const first = createNewRoundSession(pool, previous, 'session-2', 2_000, seededRandom(7));
    const second = createNewRoundSession(pool, previous, 'session-2', 2_000, seededRandom(7));
    expect(first.selectedCardIds).toEqual(second.selectedCardIds);
    expect(first.selectedCardIds).not.toEqual(previous.selectedCardIds);
    expect(first.currentCardId).toBe(first.selectedCardIds[0]);
    expect(first.unseenCardQueue).toEqual(first.selectedCardIds.slice(1));
  });

  it('retains lucky mode without a source deck', () => {
    const luckyOptions = { sessionId: 'lucky-1', mode: 'lucky' as const, direction: 'sv-fi' as const, requestedAmount: 25 as const };
    const previous = createSession(Array.from({ length: 30 }, (_, index) => card(index)), luckyOptions, 1_000, seededRandom(1));
    const next = createNewRoundSession(Array.from({ length: 30 }, (_, index) => card(index)), previous, 'lucky-2', 2_000, seededRandom(2));
    expect(next).toMatchObject({ sessionId: 'lucky-2', mode: 'lucky', direction: 'sv-fi', requestedAmount: 25 });
    expect(next).not.toHaveProperty('sourceDeckId');
  });
});
