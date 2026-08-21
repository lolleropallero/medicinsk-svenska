import type { DescriptionExerciseClient } from '../types/content';

export const DESCRIPTION_SESSION_SCHEMA_VERSION = 1 as const;
export type DescriptionRequestedAmount = 10 | 25 | 50 | 'all';
export type DescriptionSourceMode = 'all' | 'category';
export type DescriptionRoundType = 'initial' | 'retry';
export type DescriptionResult = 'correct' | 'incorrect' | 'revealed';

export interface DescriptionSessionConfiguration {
  sessionId: string;
  sourceMode: DescriptionSourceMode;
  sourceCategoryId?: string;
  requestedAmount: DescriptionRequestedAmount;
  roundType: DescriptionRoundType;
}

export interface DescriptionSession extends DescriptionSessionConfiguration {
  schemaVersion: typeof DESCRIPTION_SESSION_SCHEMA_VERSION;
  selectedExerciseIds: string[];
  currentIndex: number;
  currentResolvedResult: DescriptionResult | null;
  currentDraftAnswer: string;
  resultsByExercise: Record<string, DescriptionResult>;
  startedAt: number;
}

export interface DescriptionValidationContext {
  categoryByExerciseId: ReadonlyMap<string, string>;
  validCategoryIds: ReadonlySet<string>;
  expected: DescriptionSessionConfiguration;
}

export function shuffleDescriptions<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

export function selectDescriptionExercises(
  exercises: readonly DescriptionExerciseClient[],
  requestedAmount: DescriptionRequestedAmount,
  random: () => number = Math.random,
): DescriptionExerciseClient[] {
  const unique = [...new Map(exercises.map((exercise) => [exercise.id, exercise])).values()];
  const shuffled = shuffleDescriptions(unique, random);
  return requestedAmount === 'all' ? shuffled : shuffled.slice(0, requestedAmount);
}

export function createDescriptionSession(
  exercises: readonly DescriptionExerciseClient[],
  configuration: DescriptionSessionConfiguration,
  now = Date.now(),
  random: () => number = Math.random,
): DescriptionSession {
  return {
    schemaVersion: DESCRIPTION_SESSION_SCHEMA_VERSION,
    ...configuration,
    selectedExerciseIds: selectDescriptionExercises(exercises, configuration.requestedAmount, random).map((item) => item.id),
    currentIndex: 0,
    currentResolvedResult: null,
    currentDraftAnswer: '',
    resultsByExercise: {},
    startedAt: now,
  };
}

export function updateDescriptionDraft(session: DescriptionSession, draft: string): DescriptionSession {
  if (session.currentResolvedResult || session.currentIndex >= session.selectedExerciseIds.length) return session;
  return { ...session, currentDraftAnswer: draft };
}

export function resolveDescription(
  session: DescriptionSession,
  result: DescriptionResult,
): DescriptionSession {
  const exerciseId = session.selectedExerciseIds[session.currentIndex];
  if (!exerciseId || session.currentResolvedResult) return session;
  return {
    ...session,
    currentResolvedResult: result,
    resultsByExercise: { ...session.resultsByExercise, [exerciseId]: result },
  };
}

export function advanceDescription(session: DescriptionSession): DescriptionSession {
  if (!session.currentResolvedResult) return session;
  return {
    ...session,
    currentIndex: session.currentIndex + 1,
    currentResolvedResult: null,
    currentDraftAnswer: '',
  };
}

export function summarizeDescriptionSession(session: DescriptionSession) {
  const results = session.selectedExerciseIds.map((id) => session.resultsByExercise[id]);
  return {
    correct: results.filter((result) => result === 'correct').length,
    errors: results.filter((result) => result === 'incorrect' || result === 'revealed').length,
    total: session.selectedExerciseIds.length,
  };
}

export function createDescriptionRetrySession(
  previous: DescriptionSession,
  sessionId: string,
  now = Date.now(),
  random: () => number = Math.random,
): DescriptionSession | null {
  const missed = previous.selectedExerciseIds.filter((id) => {
    const result = previous.resultsByExercise[id];
    return result === 'incorrect' || result === 'revealed';
  });
  if (missed.length === 0) return null;
  return {
    schemaVersion: DESCRIPTION_SESSION_SCHEMA_VERSION,
    sessionId,
    sourceMode: previous.sourceMode,
    ...(previous.sourceMode === 'category' && previous.sourceCategoryId
      ? { sourceCategoryId: previous.sourceCategoryId }
      : {}),
    requestedAmount: previous.requestedAmount,
    roundType: 'retry',
    selectedExerciseIds: shuffleDescriptions([...new Set(missed)], random),
    currentIndex: 0,
    currentResolvedResult: null,
    currentDraftAnswer: '',
    resultsByExercise: {},
    startedAt: now,
  };
}

export function createNewDescriptionRound(
  exercises: readonly DescriptionExerciseClient[],
  previous: DescriptionSession,
  sessionId: string,
  now = Date.now(),
  random: () => number = Math.random,
): DescriptionSession {
  let next = createDescriptionSession(exercises, {
    sessionId,
    sourceMode: previous.sourceMode,
    ...(previous.sourceMode === 'category' && previous.sourceCategoryId
      ? { sourceCategoryId: previous.sourceCategoryId }
      : {}),
    requestedAmount: previous.requestedAmount,
    roundType: 'initial',
  }, now, random);
  if (next.selectedExerciseIds.length > 1 && next.selectedExerciseIds.every((id, index) => id === previous.selectedExerciseIds[index])) {
    next = { ...next, selectedExerciseIds: [...next.selectedExerciseIds.slice(1), next.selectedExerciseIds[0]!] };
  }
  return next;
}

export function isReasonableDescriptionSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/u.test(value);
}

const isResult = (value: unknown): value is DescriptionResult =>
  value === 'correct' || value === 'incorrect' || value === 'revealed';

export function isStoredDescriptionSession(
  value: unknown,
  context: DescriptionValidationContext,
): value is DescriptionSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const session = value as Partial<DescriptionSession>;
  const selected = session.selectedExerciseIds;
  const results = session.resultsByExercise;
  if (!(
    session.schemaVersion === DESCRIPTION_SESSION_SCHEMA_VERSION &&
    isReasonableDescriptionSessionId(session.sessionId) &&
    (session.sourceMode === 'all' || session.sourceMode === 'category') &&
    (session.sourceMode === 'category'
      ? typeof session.sourceCategoryId === 'string' && context.validCategoryIds.has(session.sourceCategoryId)
      : session.sourceCategoryId === undefined) &&
    (session.requestedAmount === 10 || session.requestedAmount === 25 || session.requestedAmount === 50 || session.requestedAmount === 'all') &&
    (session.roundType === 'initial' || session.roundType === 'retry') &&
    Array.isArray(selected) && selected.length > 0 && new Set(selected).size === selected.length &&
    selected.every((id) => typeof id === 'string' && context.categoryByExerciseId.has(id)) &&
    Number.isInteger(session.currentIndex) && Number(session.currentIndex) >= 0 && Number(session.currentIndex) <= selected.length &&
    (session.currentResolvedResult === null || isResult(session.currentResolvedResult)) &&
    typeof session.currentDraftAnswer === 'string' &&
    results && typeof results === 'object' && !Array.isArray(results) &&
    typeof session.startedAt === 'number' && Number.isFinite(session.startedAt) && session.startedAt >= 0 &&
    session.sessionId === context.expected.sessionId &&
    session.sourceMode === context.expected.sourceMode &&
    session.sourceCategoryId === context.expected.sourceCategoryId &&
    session.requestedAmount === context.expected.requestedAmount &&
    session.roundType === context.expected.roundType
  )) return false;

  if (session.sourceMode === 'category' && !selected.every((id) => context.categoryByExerciseId.get(id) === session.sourceCategoryId)) return false;
  const entries = Object.entries(results);
  if (!entries.every(([id, result]) => selected.includes(id) && isResult(result))) return false;
  const currentIndex = Number(session.currentIndex);
  const expectedResolvedCount = currentIndex + (session.currentResolvedResult ? 1 : 0);
  if (entries.length !== expectedResolvedCount) return false;
  if (!selected.slice(0, currentIndex).every((id) => isResult(results[id]))) return false;
  if (currentIndex === selected.length && session.currentResolvedResult !== null) return false;
  const currentId = selected[currentIndex];
  if (session.currentResolvedResult && (!currentId || results[currentId] !== session.currentResolvedResult)) return false;
  if (!session.currentResolvedResult && currentId && Object.hasOwn(results, currentId)) return false;
  return true;
}
