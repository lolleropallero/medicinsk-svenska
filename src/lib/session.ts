import type { Direction, FlashcardClient } from '../types/content';

export const RETRY_DELAY_MS = 2 * 60 * 1000;
export const SESSION_SCHEMA_VERSION = 1 as const;

export type RequestedAmount = 10 | 25 | 50 | 'all';
export type SessionMode = 'deck' | 'lucky';
export type VocabularyAnswerMode = 'cards' | 'choice' | 'written';

export interface PendingRetry {
  cardId: string;
  dueAt: number;
}

export interface FlashcardSession {
  schemaVersion: typeof SESSION_SCHEMA_VERSION;
  sessionId: string;
  mode: SessionMode;
  answerMode: VocabularyAnswerMode;
  sourceDeckId?: string;
  direction: Direction;
  requestedAmount: RequestedAmount;
  selectedCardIds: string[];
  unseenCardQueue: string[];
  currentCardId: string | null;
  masteredCardIds: string[];
  pendingRetries: PendingRetry[];
  answerDraft: string;
  attemptCountByCard: Record<string, number>;
  firstAttemptCorrectByCard: Record<string, boolean>;
  totalMissedCount: number;
  startedAt: number;
  revealed: boolean;
}

export interface CreateSessionOptions {
  sessionId: string;
  mode: SessionMode;
  answerMode: VocabularyAnswerMode;
  sourceDeckId?: string;
  direction: Direction;
  requestedAmount: RequestedAmount;
}

export interface SessionValidationContext {
  cardDeckById: ReadonlyMap<string, string>;
  validDeckIds: ReadonlySet<string>;
  expected: CreateSessionOptions;
}

export interface SessionSummary {
  firstAttemptCorrect: number;
  selectedCount: number;
  totalMissedCount: number;
}

export function cardSides(card: FlashcardClient, direction: Direction) {
  if (direction === 'sv-fi') {
    return {
      front: `${card.article ? `${card.article} ` : ''}${card.sv}`,
      back: card.fi,
    };
  }

  return {
    front: card.fi,
    back: `${card.article ? `${card.article} ` : ''}${card.sv}`,
  };
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const value = result[index]!;
    result[index] = result[swapIndex]!;
    result[swapIndex] = value;
  }
  return result;
}

export function selectSessionCards(
  cards: readonly FlashcardClient[],
  requestedAmount: RequestedAmount,
  random: () => number = Math.random,
): FlashcardClient[] {
  const uniqueCards = Array.from(
    new Map(cards.map((card) => [card.id, card])).values(),
  );
  const randomized = shuffled(uniqueCards, random);
  return requestedAmount === 'all' ? randomized : randomized.slice(0, requestedAmount);
}

export function createSession(
  cards: readonly FlashcardClient[],
  options: CreateSessionOptions,
  now = Date.now(),
  random: () => number = Math.random,
): FlashcardSession {
  const selectedCardIds = selectSessionCards(cards, options.requestedAmount, random).map((card) => card.id);
  const [currentCardId = null, ...unseenCardQueue] = selectedCardIds;

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    sessionId: options.sessionId,
    mode: options.mode,
    answerMode: options.answerMode,
    ...(options.mode === 'deck' && options.sourceDeckId ? { sourceDeckId: options.sourceDeckId } : {}),
    direction: options.direction,
    requestedAmount: options.requestedAmount,
    selectedCardIds,
    unseenCardQueue,
    currentCardId,
    masteredCardIds: [],
    pendingRetries: [],
    answerDraft: '',
    attemptCountByCard: {},
    firstAttemptCorrectByCard: {},
    totalMissedCount: 0,
    startedAt: now,
    revealed: false,
  };
}

export function createNewRoundSession(
  cards: readonly FlashcardClient[],
  previous: FlashcardSession,
  sessionId: string,
  now = Date.now(),
  random: () => number = Math.random,
): FlashcardSession {
  let next = createSession(cards, {
    sessionId,
    mode: previous.mode,
    answerMode: previous.answerMode,
    ...(previous.mode === 'deck' && previous.sourceDeckId ? { sourceDeckId: previous.sourceDeckId } : {}),
    direction: previous.direction,
    requestedAmount: previous.requestedAmount,
  }, now, random);

  if (
    next.selectedCardIds.length > 1 &&
    next.selectedCardIds.every((id, index) => id === previous.selectedCardIds[index])
  ) {
    const [first, ...rest] = next.selectedCardIds;
    const selectedCardIds = [...rest, first!];
    next = {
      ...next,
      selectedCardIds,
      currentCardId: selectedCardIds[0]!,
      unseenCardQueue: selectedCardIds.slice(1),
    };
  }

  return next;
}

export function summarizeSession(session: FlashcardSession): SessionSummary {
  const selected = new Set(session.selectedCardIds);
  return {
    firstAttemptCorrect: [...selected].filter((id) => session.firstAttemptCorrectByCard[id] === true).length,
    selectedCount: selected.size,
    totalMissedCount: session.totalMissedCount,
  };
}

export function revealCurrentCard(session: FlashcardSession): FlashcardSession {
  if (!session.currentCardId || session.revealed) return session;
  return { ...session, revealed: true };
}

export function updateAnswerDraft(session: FlashcardSession, answerDraft: string): FlashcardSession {
  return session.answerDraft === answerDraft ? session : { ...session, answerDraft };
}

export function advanceSession(session: FlashcardSession, now = Date.now()): FlashcardSession {
  if (session.currentCardId) return session;

  const retryQueueOpen = session.unseenCardQueue.length === 0;
  const dueRetries = session.pendingRetries
    .filter((retry) => retry.dueAt <= now || retryQueueOpen)
    .sort((a, b) => a.dueAt - b.dueAt);

  if (dueRetries.length > 0) {
    const nextRetry = dueRetries[0]!;
    return {
      ...session,
      currentCardId: nextRetry.cardId,
      pendingRetries: session.pendingRetries.filter((retry) => retry.cardId !== nextRetry.cardId),
      revealed: false,
      answerDraft: '',
    };
  }

  if (session.unseenCardQueue.length > 0) {
    const [currentCardId, ...unseenCardQueue] = session.unseenCardQueue;
    if (!currentCardId) return session;
    return { ...session, currentCardId, unseenCardQueue, revealed: false, answerDraft: '' };
  }

  return session;
}

export function gradeCurrentCard(
  session: FlashcardSession,
  correct: boolean,
  now = Date.now(),
): FlashcardSession {
  const cardId = session.currentCardId;
  if (!cardId || !session.revealed) return session;

  const priorAttempts = session.attemptCountByCard[cardId] ?? 0;
  const attemptCountByCard = {
    ...session.attemptCountByCard,
    [cardId]: priorAttempts + 1,
  };
  const firstAttemptCorrectByCard =
    priorAttempts === 0
      ? { ...session.firstAttemptCorrectByCard, [cardId]: correct }
      : session.firstAttemptCorrectByCard;

  const updated: FlashcardSession = correct
    ? {
        ...session,
        currentCardId: null,
        revealed: false,
        answerDraft: '',
        masteredCardIds: session.masteredCardIds.includes(cardId)
          ? session.masteredCardIds
          : [...session.masteredCardIds, cardId],
        attemptCountByCard,
        firstAttemptCorrectByCard,
      }
    : {
        ...session,
        currentCardId: null,
        revealed: false,
        answerDraft: '',
        pendingRetries: [
          ...session.pendingRetries.filter((retry) => retry.cardId !== cardId),
          { cardId, dueAt: now + RETRY_DELAY_MS },
        ],
        attemptCountByCard,
        firstAttemptCorrectByCard,
        totalMissedCount: session.totalMissedCount + 1,
      };

  return advanceSession(updated, now);
}

export function nextRetryAt(session: FlashcardSession): number | null {
  if (session.pendingRetries.length === 0) return null;
  return Math.min(...session.pendingRetries.map((retry) => retry.dueAt));
}

export function isSessionComplete(session: FlashcardSession): boolean {
  return (
    session.selectedCardIds.length > 0 &&
    session.masteredCardIds.length === session.selectedCardIds.length &&
    session.currentCardId === null &&
    session.unseenCardQueue.length === 0 &&
    session.pendingRetries.length === 0
  );
}

export function parseRequestedAmount(value: string | null): RequestedAmount {
  if (value === '10' || value === '25' || value === '50') return Number(value) as 10 | 25 | 50;
  if (value === 'all') return 'all';
  return 25;
}

export function isReasonableSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/u.test(value);
}

export function isStoredSession(value: unknown, context: SessionValidationContext): value is FlashcardSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<FlashcardSession>;
  const selected = session.selectedCardIds;
  const unseen = session.unseenCardQueue;
  const mastered = session.masteredCardIds;
  const pending = session.pendingRetries;
  const answerMode = session.answerMode ?? 'cards';
  const answerDraft = session.answerDraft ?? '';
  const attempts = session.attemptCountByCard;
  const firstAttempts = session.firstAttemptCorrectByCard;

  if (!(
    session.schemaVersion === SESSION_SCHEMA_VERSION &&
    isReasonableSessionId(session.sessionId) &&
    (session.mode === 'deck' || session.mode === 'lucky') &&
    (answerMode === 'cards' || answerMode === 'choice' || answerMode === 'written') &&
    (session.mode === 'deck'
      ? typeof session.sourceDeckId === 'string' && session.sourceDeckId.length > 0 && context.validDeckIds.has(session.sourceDeckId)
      : session.sourceDeckId === undefined) &&
    (session.direction === 'sv-fi' || session.direction === 'fi-sv') &&
    (session.requestedAmount === 10 ||
      session.requestedAmount === 25 ||
      session.requestedAmount === 50 ||
      session.requestedAmount === 'all') &&
    Array.isArray(selected) &&
    selected.length > 0 &&
    new Set(selected).size === selected.length &&
    selected.every((id) => typeof id === 'string' && context.cardDeckById.has(id)) &&
    Array.isArray(unseen) &&
    Array.isArray(mastered) &&
    Array.isArray(pending) &&
    typeof answerDraft === 'string' &&
    answerDraft.length <= 1_000 &&
    (session.currentCardId === null || (typeof session.currentCardId === 'string' && context.cardDeckById.has(session.currentCardId))) &&
    pending.every(
      (retry) =>
        retry &&
        typeof retry.cardId === 'string' &&
        context.cardDeckById.has(retry.cardId) &&
        typeof retry.dueAt === 'number' &&
        Number.isFinite(retry.dueAt) && retry.dueAt >= 0,
    ) &&
    attempts !== null && typeof attempts === 'object' && !Array.isArray(attempts) &&
    firstAttempts !== null && typeof firstAttempts === 'object' && !Array.isArray(firstAttempts) &&
    typeof session.totalMissedCount === 'number' && Number.isInteger(session.totalMissedCount) && session.totalMissedCount >= 0 &&
    typeof session.startedAt === 'number' && Number.isFinite(session.startedAt) && session.startedAt >= 0 &&
    typeof session.revealed === 'boolean' &&
    (!session.revealed || session.currentCardId !== null) &&
    session.sessionId === context.expected.sessionId &&
    session.mode === context.expected.mode &&
    answerMode === context.expected.answerMode &&
    session.direction === context.expected.direction &&
    session.requestedAmount === context.expected.requestedAmount &&
    session.sourceDeckId === context.expected.sourceDeckId
  )) return false;

  const pendingIds = pending.map((retry) => retry.cardId);
  const stateIds = [...unseen, ...mastered, ...pendingIds, ...(session.currentCardId ? [session.currentCardId] : [])];
  const attemptEntries = Object.entries(attempts);
  const firstAttemptEntries = Object.entries(firstAttempts);

  return (
    new Set(unseen).size === unseen.length &&
    new Set(mastered).size === mastered.length &&
    new Set(pendingIds).size === pendingIds.length &&
    stateIds.length === selected.length &&
    new Set(stateIds).size === selected.length &&
    stateIds.every((id) => selected.includes(id)) &&
    attemptEntries.every(([id, count]) => selected.includes(id) && Number.isInteger(count) && Number(count) >= 0) &&
    firstAttemptEntries.every(([id, correct]) => selected.includes(id) && typeof correct === 'boolean') &&
    attemptEntries.length === firstAttemptEntries.length &&
    attemptEntries.every(([id]) => Object.hasOwn(firstAttempts, id)) &&
    (session.mode !== 'deck' || selected.every((id) => context.cardDeckById.get(id) === session.sourceDeckId)) &&
    (mastered.length !== selected.length || (
      session.currentCardId === null && unseen.length === 0 && pending.length === 0
    ))
  );
}
