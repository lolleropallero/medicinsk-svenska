import type { Direction, Flashcard } from '../types/content';

export const RETRY_DELAY_MS = 5 * 60 * 1000;
export const SESSION_SCHEMA_VERSION = 1 as const;

export type RequestedAmount = 10 | 25 | 50 | 'all';
export type SessionMode = 'deck' | 'lucky';

export interface PendingRetry {
  cardId: string;
  dueAt: number;
}

export interface FlashcardSession {
  schemaVersion: typeof SESSION_SCHEMA_VERSION;
  sessionId: string;
  mode: SessionMode;
  sourceDeckId?: string;
  direction: Direction;
  requestedAmount: RequestedAmount;
  selectedCardIds: string[];
  unseenCardQueue: string[];
  currentCardId: string | null;
  masteredCardIds: string[];
  pendingRetries: PendingRetry[];
  attemptCountByCard: Record<string, number>;
  firstAttemptCorrectByCard: Record<string, boolean>;
  totalMissedCount: number;
  startedAt: number;
  revealed: boolean;
}

export interface CreateSessionOptions {
  sessionId: string;
  mode: SessionMode;
  sourceDeckId?: string;
  direction: Direction;
  requestedAmount: RequestedAmount;
}

export function cardSides(card: Flashcard, direction: Direction) {
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
  cards: readonly Flashcard[],
  requestedAmount: RequestedAmount,
  random: () => number = Math.random,
): Flashcard[] {
  const uniquePublishedCards = Array.from(
    new Map(cards.filter((card) => card.status === 'published').map((card) => [card.id, card])).values(),
  );
  const randomized = shuffled(uniquePublishedCards, random);
  return requestedAmount === 'all' ? randomized : randomized.slice(0, requestedAmount);
}

export function createSession(
  cards: readonly Flashcard[],
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
    ...(options.mode === 'deck' && options.sourceDeckId ? { sourceDeckId: options.sourceDeckId } : {}),
    direction: options.direction,
    requestedAmount: options.requestedAmount,
    selectedCardIds,
    unseenCardQueue,
    currentCardId,
    masteredCardIds: [],
    pendingRetries: [],
    attemptCountByCard: {},
    firstAttemptCorrectByCard: {},
    totalMissedCount: 0,
    startedAt: now,
    revealed: false,
  };
}

export function revealCurrentCard(session: FlashcardSession): FlashcardSession {
  if (!session.currentCardId || session.revealed) return session;
  return { ...session, revealed: true };
}

export function advanceSession(session: FlashcardSession, now = Date.now()): FlashcardSession {
  if (session.currentCardId) return session;

  const dueRetries = session.pendingRetries
    .filter((retry) => retry.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt);

  if (dueRetries.length > 0) {
    const nextRetry = dueRetries[0]!;
    return {
      ...session,
      currentCardId: nextRetry.cardId,
      pendingRetries: session.pendingRetries.filter((retry) => retry.cardId !== nextRetry.cardId),
      revealed: false,
    };
  }

  if (session.unseenCardQueue.length > 0) {
    const [currentCardId, ...unseenCardQueue] = session.unseenCardQueue;
    if (!currentCardId) return session;
    return { ...session, currentCardId, unseenCardQueue, revealed: false };
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

export function isStoredSession(value: unknown, validCardIds: ReadonlySet<string>): value is FlashcardSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<FlashcardSession>;
  const selected = session.selectedCardIds;
  const unseen = session.unseenCardQueue;
  const mastered = session.masteredCardIds;
  const pending = session.pendingRetries;
  const attempts = session.attemptCountByCard;
  const firstAttempts = session.firstAttemptCorrectByCard;

  if (!(
    session.schemaVersion === SESSION_SCHEMA_VERSION &&
    typeof session.sessionId === 'string' &&
    (session.mode === 'deck' || session.mode === 'lucky') &&
    (session.mode === 'deck' ? typeof session.sourceDeckId === 'string' : session.sourceDeckId === undefined) &&
    (session.direction === 'sv-fi' || session.direction === 'fi-sv') &&
    (session.requestedAmount === 10 ||
      session.requestedAmount === 25 ||
      session.requestedAmount === 50 ||
      session.requestedAmount === 'all') &&
    Array.isArray(selected) &&
    new Set(selected).size === selected.length &&
    selected.every((id) => typeof id === 'string' && validCardIds.has(id)) &&
    Array.isArray(unseen) &&
    Array.isArray(mastered) &&
    Array.isArray(pending) &&
    (session.currentCardId === null || typeof session.currentCardId === 'string') &&
    pending.every(
      (retry) =>
        retry &&
        typeof retry.cardId === 'string' &&
        typeof retry.dueAt === 'number' &&
        Number.isFinite(retry.dueAt),
    ) &&
    attempts !== null && typeof attempts === 'object' &&
    firstAttempts !== null && typeof firstAttempts === 'object' &&
    typeof session.totalMissedCount === 'number' && Number.isInteger(session.totalMissedCount) && session.totalMissedCount >= 0 &&
    typeof session.startedAt === 'number' && Number.isFinite(session.startedAt) &&
    typeof session.revealed === 'boolean'
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
    attemptEntries.every(([id, count]) => selected.includes(id) && Number.isInteger(count) && count > 0) &&
    firstAttemptEntries.every(([id, correct]) => selected.includes(id) && typeof correct === 'boolean') &&
    attemptEntries.length === firstAttemptEntries.length &&
    attemptEntries.every(([id]) => Object.hasOwn(firstAttempts, id))
  );
}
