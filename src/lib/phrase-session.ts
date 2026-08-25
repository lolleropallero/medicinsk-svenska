import { shuffled } from './session';
import type { ClinicalPhraseClient } from '../types/content';

export const PHRASE_SESSION_SCHEMA_VERSION = 1 as const;
export const PHRASE_RETRY_DELAY_MS = 2 * 60 * 1000;
export type PhraseRequestedAmount = 10 | 25 | 'all';
export type PhraseSessionMode = 'all' | 'category';

export interface PhrasePendingRetry { phraseId: string; dueAt: number }
export interface PhraseSessionConfiguration {
  sessionId: string;
  mode: PhraseSessionMode;
  sourceCategoryId?: string;
  requestedAmount: PhraseRequestedAmount;
}
export interface PhraseSession extends PhraseSessionConfiguration {
  schemaVersion: typeof PHRASE_SESSION_SCHEMA_VERSION;
  selectedPhraseIds: string[];
  unseenPhraseQueue: string[];
  currentPhraseId: string | null;
  revealed: boolean;
  masteredPhraseIds: string[];
  pendingRetries: PhrasePendingRetry[];
  attemptCountByPhrase: Record<string, number>;
  firstAttemptCorrectByPhrase: Record<string, boolean>;
  totalMissedCount: number;
  startedAt: number;
}
export interface PhraseValidationContext {
  categoryByPhraseId: ReadonlyMap<string, string>;
  validCategoryIds: ReadonlySet<string>;
  expected: PhraseSessionConfiguration;
}

export function selectPhrases(
  phrases: readonly ClinicalPhraseClient[],
  requestedAmount: PhraseRequestedAmount,
  random: () => number = Math.random,
): ClinicalPhraseClient[] {
  const unique = [...new Map(phrases.map((phrase) => [phrase.id, phrase])).values()];
  const randomized = shuffled(unique, random);
  return requestedAmount === 'all' ? randomized : randomized.slice(0, requestedAmount);
}

export function createPhraseSession(
  phrases: readonly ClinicalPhraseClient[],
  configuration: PhraseSessionConfiguration,
  now = Date.now(),
  random: () => number = Math.random,
): PhraseSession {
  const selectedPhraseIds = selectPhrases(phrases, configuration.requestedAmount, random).map((phrase) => phrase.id);
  const [currentPhraseId = null, ...unseenPhraseQueue] = selectedPhraseIds;
  return {
    schemaVersion: PHRASE_SESSION_SCHEMA_VERSION,
    sessionId: configuration.sessionId,
    mode: configuration.mode,
    ...(configuration.mode === 'category' && configuration.sourceCategoryId
      ? { sourceCategoryId: configuration.sourceCategoryId } : {}),
    requestedAmount: configuration.requestedAmount,
    selectedPhraseIds,
    unseenPhraseQueue,
    currentPhraseId,
    revealed: false,
    masteredPhraseIds: [],
    pendingRetries: [],
    attemptCountByPhrase: {},
    firstAttemptCorrectByPhrase: {},
    totalMissedCount: 0,
    startedAt: now,
  };
}

export function revealPhrase(session: PhraseSession): PhraseSession {
  return !session.currentPhraseId || session.revealed ? session : { ...session, revealed: true };
}

export function advancePhraseSession(session: PhraseSession, now = Date.now()): PhraseSession {
  if (session.currentPhraseId) return session;
  const retryQueueOpen = session.unseenPhraseQueue.length === 0;
  const due = session.pendingRetries
    .filter((retry) => retry.dueAt <= now || retryQueueOpen)
    .sort((a, b) => a.dueAt - b.dueAt)[0];
  if (due) return {
    ...session,
    currentPhraseId: due.phraseId,
    pendingRetries: session.pendingRetries.filter((retry) => retry.phraseId !== due.phraseId),
    revealed: false,
  };
  const [currentPhraseId, ...unseenPhraseQueue] = session.unseenPhraseQueue;
  return currentPhraseId ? { ...session, currentPhraseId, unseenPhraseQueue, revealed: false } : session;
}

export function gradePhrase(session: PhraseSession, correct: boolean, now = Date.now()): PhraseSession {
  const phraseId = session.currentPhraseId;
  if (!phraseId || !session.revealed) return session;
  const priorAttempts = session.attemptCountByPhrase[phraseId] ?? 0;
  const attemptCountByPhrase = { ...session.attemptCountByPhrase, [phraseId]: priorAttempts + 1 };
  const firstAttemptCorrectByPhrase = priorAttempts === 0
    ? { ...session.firstAttemptCorrectByPhrase, [phraseId]: correct }
    : session.firstAttemptCorrectByPhrase;
  const updated: PhraseSession = correct ? {
    ...session,
    currentPhraseId: null,
    revealed: false,
    masteredPhraseIds: session.masteredPhraseIds.includes(phraseId)
      ? session.masteredPhraseIds : [...session.masteredPhraseIds, phraseId],
    attemptCountByPhrase,
    firstAttemptCorrectByPhrase,
  } : {
    ...session,
    currentPhraseId: null,
    revealed: false,
    pendingRetries: [
      ...session.pendingRetries.filter((retry) => retry.phraseId !== phraseId),
      { phraseId, dueAt: now + PHRASE_RETRY_DELAY_MS },
    ],
    attemptCountByPhrase,
    firstAttemptCorrectByPhrase,
    totalMissedCount: session.totalMissedCount + 1,
  };
  return advancePhraseSession(updated, now);
}

export function phraseNextRetryAt(session: PhraseSession): number | null {
  return session.pendingRetries.length ? Math.min(...session.pendingRetries.map((retry) => retry.dueAt)) : null;
}

export function isPhraseSessionComplete(session: PhraseSession): boolean {
  return session.selectedPhraseIds.length > 0 &&
    session.masteredPhraseIds.length === session.selectedPhraseIds.length &&
    session.currentPhraseId === null && session.unseenPhraseQueue.length === 0 && session.pendingRetries.length === 0;
}

export function summarizePhraseSession(session: PhraseSession) {
  return {
    firstAttemptCorrect: session.selectedPhraseIds.filter((id) => session.firstAttemptCorrectByPhrase[id] === true).length,
    selectedCount: new Set(session.selectedPhraseIds).size,
    totalMissedCount: session.totalMissedCount,
  };
}

export function createNewPhraseRound(
  phrases: readonly ClinicalPhraseClient[],
  previous: PhraseSession,
  sessionId: string,
  now = Date.now(),
  random: () => number = Math.random,
): PhraseSession {
  let next = createPhraseSession(phrases, {
    sessionId,
    mode: previous.mode,
    ...(previous.mode === 'category' && previous.sourceCategoryId ? { sourceCategoryId: previous.sourceCategoryId } : {}),
    requestedAmount: previous.requestedAmount,
  }, now, random);
  if (next.selectedPhraseIds.length > 1 && next.selectedPhraseIds.every((id, index) => id === previous.selectedPhraseIds[index])) {
    const selectedPhraseIds = [...next.selectedPhraseIds.slice(1), next.selectedPhraseIds[0]!];
    next = { ...next, selectedPhraseIds, currentPhraseId: selectedPhraseIds[0]!, unseenPhraseQueue: selectedPhraseIds.slice(1) };
  }
  return next;
}

export function isReasonablePhraseSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/u.test(value);
}

export function isStoredPhraseSession(value: unknown, context: PhraseValidationContext): value is PhraseSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const session = value as Partial<PhraseSession>;
  const selected = session.selectedPhraseIds;
  const unseen = session.unseenPhraseQueue;
  const mastered = session.masteredPhraseIds;
  const pending = session.pendingRetries;
  const attempts = session.attemptCountByPhrase;
  const firstAttempts = session.firstAttemptCorrectByPhrase;
  if (!(
    session.schemaVersion === PHRASE_SESSION_SCHEMA_VERSION &&
    isReasonablePhraseSessionId(session.sessionId) &&
    (session.mode === 'all' || session.mode === 'category') &&
    (session.mode === 'category'
      ? typeof session.sourceCategoryId === 'string' && context.validCategoryIds.has(session.sourceCategoryId)
      : session.sourceCategoryId === undefined) &&
    (session.requestedAmount === 10 || session.requestedAmount === 25 || session.requestedAmount === 'all') &&
    Array.isArray(selected) && selected.length > 0 && new Set(selected).size === selected.length &&
    selected.every((id) => typeof id === 'string' && context.categoryByPhraseId.has(id)) &&
    Array.isArray(unseen) && Array.isArray(mastered) && Array.isArray(pending) &&
    (session.currentPhraseId === null || (typeof session.currentPhraseId === 'string' && context.categoryByPhraseId.has(session.currentPhraseId))) &&
    pending.every((retry) => retry && typeof retry.phraseId === 'string' && context.categoryByPhraseId.has(retry.phraseId) &&
      typeof retry.dueAt === 'number' && Number.isFinite(retry.dueAt) && retry.dueAt >= 0) &&
    attempts && typeof attempts === 'object' && !Array.isArray(attempts) &&
    firstAttempts && typeof firstAttempts === 'object' && !Array.isArray(firstAttempts) &&
    Number.isInteger(session.totalMissedCount) && Number(session.totalMissedCount) >= 0 &&
    typeof session.startedAt === 'number' && Number.isFinite(session.startedAt) && session.startedAt >= 0 &&
    typeof session.revealed === 'boolean' && (!session.revealed || session.currentPhraseId !== null) &&
    session.sessionId === context.expected.sessionId && session.mode === context.expected.mode &&
    session.sourceCategoryId === context.expected.sourceCategoryId && session.requestedAmount === context.expected.requestedAmount
  )) return false;
  const pendingIds = pending.map((retry) => retry.phraseId);
  const stateIds = [...unseen, ...mastered, ...pendingIds, ...(session.currentPhraseId ? [session.currentPhraseId] : [])];
  const attemptEntries = Object.entries(attempts);
  const firstEntries = Object.entries(firstAttempts);
  return new Set(unseen).size === unseen.length && new Set(mastered).size === mastered.length &&
    new Set(pendingIds).size === pendingIds.length && stateIds.length === selected.length &&
    new Set(stateIds).size === selected.length && stateIds.every((id) => selected.includes(id)) &&
    attemptEntries.every(([id, count]) => selected.includes(id) && Number.isInteger(count) && Number(count) >= 0) &&
    firstEntries.every(([id, correct]) => selected.includes(id) && typeof correct === 'boolean') &&
    attemptEntries.length === firstEntries.length && attemptEntries.every(([id]) => Object.hasOwn(firstAttempts, id)) &&
    (session.mode !== 'category' || selected.every((id) => context.categoryByPhraseId.get(id) === session.sourceCategoryId)) &&
    (mastered.length !== selected.length || (session.currentPhraseId === null && unseen.length === 0 && pending.length === 0));
}
