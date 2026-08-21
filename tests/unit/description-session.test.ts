import { describe, expect, it } from 'vitest';
import {
  advanceDescription,
  createDescriptionRetrySession,
  createDescriptionSession,
  createNewDescriptionRound,
  isStoredDescriptionSession,
  resolveDescription,
  selectDescriptionExercises,
  summarizeDescriptionSession,
  updateDescriptionDraft,
  type DescriptionSession,
  type DescriptionSessionConfiguration,
} from '../../src/lib/description-session';
import type { DescriptionExerciseClient } from '../../src/types/content';

const items: DescriptionExerciseClient[] = Array.from({ length: 51 }, (_, index) => ({
  id: `q${index + 1}`,
  categoryId: index < 8 ? 'a' : 'b',
  descriptionSv: 'Vad?',
  answerSv: `svar${index + 1}`,
}));
const baseOptions = { sessionId: 'session-one', sourceMode: 'all' as const, requestedAmount: 10 as const, roundType: 'initial' as const };
const context = (expected: DescriptionSessionConfiguration = baseOptions) => ({
  categoryByExerciseId: new Map(items.map((item) => [item.id, item.categoryId])),
  validCategoryIds: new Set(['a', 'b']),
  expected,
});
const random = () => 0;

describe('description selection', () => {
  it.each([10, 25, 50] as const)('selects %s unique exercises', (amount) => {
    const selected = selectDescriptionExercises(items, amount, random);
    expect(selected).toHaveLength(amount);
    expect(new Set(selected.map((item) => item.id)).size).toBe(amount);
  });
  it('selects and shuffles all topics for Kaikki', () => {
    const selected = selectDescriptionExercises(items, 'all', random);
    expect(selected).toHaveLength(51);
    expect(selected.map((item) => item.id)).not.toEqual(items.map((item) => item.id));
  });
  it('uses every unique item in a short category pool', () => {
    const short = [...items.slice(0, 7), items[0]!];
    expect(selectDescriptionExercises(short, 25, random)).toHaveLength(7);
  });
  it('is deterministic with injected randomness', () => {
    expect(selectDescriptionExercises(items, 10, random)).toEqual(selectDescriptionExercises(items, 10, random));
  });
});

describe('description transitions and summary', () => {
  it('creates an empty initial state and updates/restores a draft', () => {
    const state = createDescriptionSession(items, baseOptions, 123, random);
    expect(state).toMatchObject({ currentIndex: 0, currentResolvedResult: null, currentDraftAnswer: '', resultsByExercise: {}, startedAt: 123 });
    expect(updateDescriptionDraft(state, 'hjärta').currentDraftAnswer).toBe('hjärta');
  });
  it.each(['correct', 'incorrect', 'revealed'] as const)('resolves once as %s and advances', (result) => {
    const state = createDescriptionSession(items, baseOptions, 123, random);
    const resolved = resolveDescription(state, result);
    expect(resolved.currentResolvedResult).toBe(result);
    expect(resolveDescription(resolved, 'correct')).toBe(resolved);
    expect(advanceDescription(resolved)).toMatchObject({ currentIndex: 1, currentResolvedResult: null, currentDraftAnswer: '' });
  });
  it('completes and reports each item once', () => {
    let state = createDescriptionSession(items, { ...baseOptions, requestedAmount: 10 }, 123, random);
    state = updateDescriptionDraft(state, 'x');
    for (let index = 0; index < 10; index += 1) state = advanceDescription(resolveDescription(state, index < 7 ? 'correct' : index === 7 ? 'revealed' : 'incorrect'));
    expect(state.currentIndex).toBe(10);
    expect(summarizeDescriptionSession(state)).toEqual({ correct: 7, errors: 3, total: 10 });
  });
  it('creates a unique shuffled retry pool containing only missed items', () => {
    let state = createDescriptionSession(items, baseOptions, 123, random);
    for (let index = 0; index < 3; index += 1) state = advanceDescription(resolveDescription(state, index === 0 ? 'correct' : index === 1 ? 'incorrect' : 'revealed'));
    const retry = createDescriptionRetrySession(state, 'retry-id', 456, random)!;
    expect(new Set(retry.selectedExerciseIds)).toEqual(new Set(state.selectedExerciseIds.slice(1, 3)));
    expect(retry).toMatchObject({ sessionId: 'retry-id', startedAt: 456, roundType: 'retry', currentIndex: 0, resultsByExercise: {} });
  });
  it('starts a new round with retained selection configuration and reset state', () => {
    const old = createDescriptionSession(items.slice(0, 8), { ...baseOptions, sourceMode: 'category', sourceCategoryId: 'a' }, 123, random);
    const next = createNewDescriptionRound(items.slice(0, 8), old, 'new-id', 456, random);
    expect(next).toMatchObject({ sessionId: 'new-id', sourceMode: 'category', sourceCategoryId: 'a', requestedAmount: 10, roundType: 'initial', startedAt: 456, resultsByExercise: {}, currentDraftAnswer: '' });
    expect(next.selectedExerciseIds).not.toEqual(old.selectedExerciseIds);
  });
});

describe('description persistence validation', () => {
  const valid = () => createDescriptionSession(items, baseOptions, 123, random);
  it('round-trips unresolved, draft, and resolved states', () => {
    const draft = updateDescriptionDraft(valid(), 'njure');
    expect(isStoredDescriptionSession(JSON.parse(JSON.stringify(draft)), context())).toBe(true);
    const resolved = resolveDescription(draft, 'correct');
    expect(isStoredDescriptionSession(JSON.parse(JSON.stringify(resolved)), context())).toBe(true);
  });
  it.each([
    ['unknown exercise', (state: DescriptionSession) => { state.selectedExerciseIds[0] = 'missing'; }],
    ['duplicate selected IDs', (state: DescriptionSession) => { state.selectedExerciseIds[1] = state.selectedExerciseIds[0]!; }],
    ['invalid index', (state: DescriptionSession) => { state.currentIndex = 99; }],
    ['malformed result map', (state: DescriptionSession) => { (state.resultsByExercise as Record<string, unknown>)[state.selectedExerciseIds[0]!] = 'maybe'; }],
    ['invalid timestamp', (state: DescriptionSession) => { state.startedAt = Number.NaN; }],
    ['incompatible schema', (state: DescriptionSession) => { (state as {schemaVersion:number}).schemaVersion = 2; }],
  ])('rejects %s', (_name, mutate) => {
    const state = valid(); mutate(state);
    expect(isStoredDescriptionSession(state, context())).toBe(false);
  });
  it('rejects a selected exercise from the wrong category', () => {
    const options = { ...baseOptions, sourceMode: 'category' as const, sourceCategoryId: 'a' };
    const state = createDescriptionSession(items.slice(0, 8), options, 123, random);
    state.selectedExerciseIds[0] = 'q9';
    expect(isStoredDescriptionSession(state, context(options))).toBe(false);
  });
  it('rejects URL configuration and retry-round mismatches', () => {
    const state = valid();
    expect(isStoredDescriptionSession(state, context({ ...baseOptions, requestedAmount: 25 }))).toBe(false);
    expect(isStoredDescriptionSession(state, context({ ...baseOptions, sessionId: 'different' }))).toBe(false);
    expect(isStoredDescriptionSession(state, context({ ...baseOptions, roundType: 'retry' }))).toBe(false);
  });
});
