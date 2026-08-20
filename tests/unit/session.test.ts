import { describe, expect, it } from 'vitest';
import {
  RETRY_DELAY_MS,
  advanceSession,
  cardSides,
  createSession,
  gradeCurrentCard,
  isSessionComplete,
  isStoredSession,
  revealCurrentCard,
  seededRandom,
  selectSessionCards,
} from '../../src/lib/session';
import type { Flashcard } from '../../src/types/content';

const card = (n: number): Flashcard => ({
  id: `c${n}`,
  deckId: 'd',
  fi: `fi${n}`,
  sv: `sv${n}`,
  article: 'en',
  status: 'published',
  source: { document: 'x.pdf', page: 1 },
});
const options = { sessionId: 'session-1', mode: 'deck' as const, sourceDeckId: 'd', direction: 'fi-sv' as const, requestedAmount: 10 as const };

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

  it('deduplicates identities and excludes unpublished cards', () => {
    const duplicate = card(1);
    const review = { ...card(2), status: 'review' as const };
    expect(selectSessionCards([duplicate, duplicate, review], 10, seededRandom(1)).map((item) => item.id)).toEqual(['c1']);
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

  it('schedules En osannut exactly five minutes in the future', () => {
    const initial = createSession([card(1)], options, 1_000, seededRandom(1));
    const firstId = initial.currentCardId!;
    const missed = gradeCurrentCard(revealCurrentCard(initial), false, 2_000);
    expect(missed.pendingRetries).toEqual([{ cardId: firstId, dueAt: 2_000 + RETRY_DELAY_MS }]);
    expect(missed.currentCardId).toBeNull();
    expect(missed.totalMissedCount).toBe(1);
    expect(missed.firstAttemptCorrectByCard[firstId]).toBe(false);
    expect(isSessionComplete(missed)).toBe(false);
  });

  it('returns a due retry and completes only after it is mastered', () => {
    const initial = createSession([card(1)], options, 1_000, seededRandom(1));
    const firstId = initial.currentCardId!;
    const missedAt = 2_000;
    const waiting = gradeCurrentCard(revealCurrentCard(initial), false, missedAt);
    expect(advanceSession(waiting, missedAt + RETRY_DELAY_MS - 1).currentCardId).toBeNull();
    const due = advanceSession(waiting, missedAt + RETRY_DELAY_MS);
    expect(due.currentCardId).toBe(firstId);
    const completed = gradeCurrentCard(revealCurrentCard(due), true, missedAt + RETRY_DELAY_MS + 1);
    expect(completed.attemptCountByCard[firstId]).toBe(2);
    expect(completed.firstAttemptCorrectByCard[firstId]).toBe(false);
    expect(isSessionComplete(completed)).toBe(true);
  });

  it('accepts a valid serialized state and rejects unknown card references', () => {
    const session = createSession([card(1)], options, 1_000, seededRandom(1));
    expect(isStoredSession(JSON.parse(JSON.stringify(session)), new Set(['c1']))).toBe(true);
    expect(isStoredSession({ ...session, currentCardId: 'missing' }, new Set(['c1']))).toBe(false);
  });

  it('rejects incompatible or internally inconsistent persisted state', () => {
    const session = createSession([card(1), card(2)], options, 1_000, seededRandom(1));
    const validIds = new Set(['c1', 'c2']);
    expect(isStoredSession({ ...session, schemaVersion: 2 }, validIds)).toBe(false);
    expect(isStoredSession({ ...session, unseenCardQueue: [session.currentCardId, ...session.unseenCardQueue] }, validIds)).toBe(false);
    expect(isStoredSession({ ...session, pendingRetries: [{ cardId: session.unseenCardQueue[0], dueAt: Number.NaN }] }, validIds)).toBe(false);
    expect(isStoredSession({ ...session, attemptCountByCard: { missing: 1 }, firstAttemptCorrectByCard: { missing: true } }, validIds)).toBe(false);
  });
});
