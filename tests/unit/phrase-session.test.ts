import { describe, expect, it } from 'vitest';
import {
  PHRASE_RETRY_DELAY_MS, advancePhraseSession, createNewPhraseRound, createPhraseSession, gradePhrase, isPhraseSessionComplete,
  isStoredPhraseSession, phraseNextRetryAt, revealPhrase, selectPhrases, summarizePhraseSession,
  type PhraseSession, type PhraseValidationContext,
  type PhraseSessionConfiguration,
} from '../../src/lib/phrase-session';
import { seededRandom } from '../../src/lib/session';
import type { ClinicalPhraseClient } from '../../src/types/content';

const phrase = (index: number, categoryId = 'c'): ClinicalPhraseClient => ({ id: `p${index}`, categoryId, fi: `fi ${index}`, sv: `sv ${index}` });
const configuration = { sessionId: 'phrase-session', mode: 'category' as const, sourceCategoryId: 'c', requestedAmount: 10 as const };
const context = (session: PhraseSession, expected: PhraseSessionConfiguration = configuration): PhraseValidationContext => ({
  categoryByPhraseId: new Map(session.selectedPhraseIds.map((id) => [id, 'c'])), validCategoryIds: new Set(['c', 'other']), expected,
});

describe('phrase selection', () => {
  it.each([10, 25] as const)('selects %s unique phrases deterministically', (amount) => {
    const items = Array.from({ length: 40 }, (_, index) => phrase(index));
    const first = selectPhrases(items, amount, seededRandom(7));
    const second = selectPhrases(items, amount, seededRandom(7));
    expect(first).toHaveLength(amount);
    expect(new Set(first.map((item) => item.id)).size).toBe(amount);
    expect(first).toEqual(second);
  });
  it('uses a short pool and shuffles Kaikki without duplicating IDs', () => {
    const items = Array.from({ length: 8 }, (_, index) => phrase(index));
    expect(selectPhrases([...items, items[0]!], 25, seededRandom(2))).toHaveLength(8);
    expect(selectPhrases(items, 'all', seededRandom(5)).map((item) => item.id)).not.toEqual(items.map((item) => item.id));
  });
});

describe('phrase delayed recall session', () => {
  it('creates typed initial state', () => {
    const session = createPhraseSession(Array.from({ length: 12 }, (_, i) => phrase(i)), configuration, 1_000, seededRandom(1));
    expect(session.selectedPhraseIds).toHaveLength(10);
    expect(session.currentPhraseId).toBe(session.selectedPhraseIds[0]);
    expect(session.unseenPhraseQueue).toEqual(session.selectedPhraseIds.slice(1));
    expect(session.startedAt).toBe(1_000);
  });
  it('reveals once, masters Osasin, and advances', () => {
    const initial = createPhraseSession([phrase(1), phrase(2)], configuration, 1_000, seededRandom(1));
    const revealed = revealPhrase(initial);
    expect(revealed.revealed).toBe(true);
    expect(revealPhrase(revealed)).toBe(revealed);
    const graded = gradePhrase(revealed, true, 2_000);
    expect(graded.masteredPhraseIds).toContain(initial.currentPhraseId);
    expect(graded.currentPhraseId).not.toBe(initial.currentPhraseId);
    expect(gradePhrase(graded, true, 2_001)).toBe(graded);
  });
  it('schedules En osannut at the two-minute cap while unseen phrases remain', () => {
    const initial = createPhraseSession([phrase(1), phrase(2)], configuration, 1_000, seededRandom(1));
    const waiting = gradePhrase(revealPhrase(initial), false, 2_000);
    expect(waiting.pendingRetries).toEqual([{ phraseId: initial.currentPhraseId, dueAt: 2_000 + PHRASE_RETRY_DELAY_MS }]);
    expect(phraseNextRetryAt(waiting)).toBe(2_000 + PHRASE_RETRY_DELAY_MS);
    expect(waiting.currentPhraseId).not.toBe(initial.currentPhraseId);
  });
  it('replays a failed final phrase immediately and completes only after it is mastered', () => {
    const initial = createPhraseSession([phrase(1)], configuration, 1_000, seededRandom(1));
    const missed = gradePhrase(revealPhrase(initial), false, 2_000);
    expect(missed.currentPhraseId).toBe(initial.currentPhraseId);
    expect(missed.pendingRetries).toEqual([]);
    expect(missed.totalMissedCount).toBe(1);
    expect(isPhraseSessionComplete(missed)).toBe(false);
    const completed = gradePhrase(revealPhrase(missed), true, 2_001);
    expect(completed.attemptCountByPhrase[initial.currentPhraseId!]).toBe(2);
    expect(completed.firstAttemptCorrectByPhrase[initial.currentPhraseId!]).toBe(false);
    expect(isPhraseSessionComplete(completed)).toBe(true);
  });
  it('replays a missed phrase immediately when normal phrases are exhausted before the cap', () => {
    const initial = createPhraseSession([phrase(1), phrase(2)], configuration, 1_000, seededRandom(1));
    const firstId = initial.currentPhraseId!;
    let session = gradePhrase(revealPhrase(initial), false, 2_000);
    expect(session.pendingRetries).toEqual([{ phraseId: firstId, dueAt: 2_000 + PHRASE_RETRY_DELAY_MS }]);
    expect(session.currentPhraseId).not.toBe(firstId);
    session = gradePhrase(revealPhrase(session), true, 3_000);
    expect(session.currentPhraseId).toBe(firstId);
    expect(session.pendingRetries).toEqual([]);
  });
  it('prioritizes a due retry over unseen phrases at a boundary', () => {
    const initial = createPhraseSession([phrase(1), phrase(2)], configuration, 0, seededRandom(1));
    const missed = gradePhrase(revealPhrase(initial), false, 1_000);
    const boundary = { ...missed, currentPhraseId: null, unseenPhraseQueue: missed.currentPhraseId ? [missed.currentPhraseId, ...missed.unseenPhraseQueue] : missed.unseenPhraseQueue };
    expect(advancePhraseSession(boundary, 1_000 + PHRASE_RETRY_DELAY_MS).currentPhraseId).toBe(initial.currentPhraseId);
  });
  it('repeated final-phrase failures replay immediately and count every action', () => {
    const initial = createPhraseSession([phrase(1)], configuration, 0, seededRandom(1));
    const first = gradePhrase(revealPhrase(initial), false, 1_000);
    const second = gradePhrase(revealPhrase(first), false, 2_000);
    expect(second.currentPhraseId).toBe(initial.currentPhraseId);
    expect(second.pendingRetries).toEqual([]);
    expect(second.totalMissedCount).toBe(2);
    expect(second.firstAttemptCorrectByPhrase[initial.currentPhraseId!]).toBe(false);
  });
  it('completes only after every phrase is mastered and summarizes first attempts', () => {
    let session = createPhraseSession([phrase(1), phrase(2)], configuration, 0, seededRandom(1));
    session = gradePhrase(revealPhrase(session), true, 1);
    session = gradePhrase(revealPhrase(session), true, 2);
    expect(isPhraseSessionComplete(session)).toBe(true);
    expect(summarizePhraseSession(session)).toEqual({ firstAttemptCorrect: 2, selectedCount: 2, totalMissedCount: 0 });
  });
  it('creates a fresh round retaining configuration and resetting state', () => {
    const old = createPhraseSession(Array.from({ length: 12 }, (_, i) => phrase(i)), configuration, 1_000, seededRandom(1));
    const next = createNewPhraseRound(Array.from({ length: 12 }, (_, i) => phrase(i)), old, 'new-session', 2_000, seededRandom(1));
    expect(next.sessionId).toBe('new-session'); expect(next.startedAt).toBe(2_000);
    expect(next.mode).toBe(old.mode); expect(next.sourceCategoryId).toBe(old.sourceCategoryId); expect(next.requestedAmount).toBe(old.requestedAmount);
    expect(next.selectedPhraseIds).not.toEqual(old.selectedPhraseIds);
    expect(next.attemptCountByPhrase).toEqual({}); expect(next.pendingRetries).toEqual([]);
  });
});

describe('stored phrase session validation', () => {
  it('round trips valid state and restores revealed and retry states', () => {
    const initial = createPhraseSession([phrase(1), phrase(2)], configuration, 1_000, seededRandom(1));
    expect(isStoredPhraseSession(JSON.parse(JSON.stringify(initial)), context(initial))).toBe(true);
    const revealed = revealPhrase(initial);
    expect(isStoredPhraseSession(JSON.parse(JSON.stringify(revealed)), context(revealed))).toBe(true);
    const waiting = gradePhrase(revealed, false, 2_000);
    expect(isStoredPhraseSession(JSON.parse(JSON.stringify(waiting)), context(waiting))).toBe(true);
  });
  it.each([
    ['unknown phrase', (s: PhraseSession) => ({ ...s, currentPhraseId: 'missing' })],
    ['duplicate IDs', (s: PhraseSession) => ({ ...s, unseenPhraseQueue: [s.currentPhraseId!, ...s.unseenPhraseQueue] })],
    ['overlap', (s: PhraseSession) => ({ ...s, masteredPhraseIds: [s.currentPhraseId!] })],
    ['malformed attempts', (s: PhraseSession) => ({ ...s, attemptCountByPhrase: { [s.currentPhraseId!]: -1 }, firstAttemptCorrectByPhrase: { [s.currentPhraseId!]: false } })],
    ['invalid timestamp', (s: PhraseSession) => ({ ...s, startedAt: Number.NaN })],
    ['incompatible schema', (s: PhraseSession) => ({ ...s, schemaVersion: 2 })],
    ['revealed without current', (s: PhraseSession) => ({ ...s, currentPhraseId: null, revealed: true })],
  ])('rejects %s', (_label, mutate) => {
    const session = createPhraseSession([phrase(1), phrase(2)], configuration, 1_000, seededRandom(1));
    expect(isStoredPhraseSession(mutate(session), context(session))).toBe(false);
  });
  it('rejects wrong category and URL mismatch', () => {
    const session = createPhraseSession([phrase(1)], configuration, 1_000, seededRandom(1));
    const wrongMap = new Map([[session.currentPhraseId!, 'other']]);
    expect(isStoredPhraseSession(session, { ...context(session), categoryByPhraseId: wrongMap })).toBe(false);
    expect(isStoredPhraseSession(session, context(session, { ...configuration, requestedAmount: 25 }))).toBe(false);
  });
  it('rejects a completed state that still contains a pending retry', () => {
    let session = createPhraseSession([phrase(1)], configuration, 1_000, seededRandom(1));
    session = gradePhrase(revealPhrase(session), true, 2_000);
    const invalid = { ...session, pendingRetries: [{ phraseId: session.selectedPhraseIds[0]!, dueAt: 3_000 }] };
    expect(isStoredPhraseSession(invalid, context(session))).toBe(false);
  });
});
