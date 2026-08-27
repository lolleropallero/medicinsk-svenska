import { describe, expect, it } from 'vitest';
import {
  advanceClinicalSession, answerClinicalStep, buildClinicalValidationContext, buildCompactClinicalValidationContext,
  createClinicalSession, createNewClinicalRound, currentClinicalScenarioId, isClinicalSessionComplete,
  isStoredClinicalSession, orderedStepOptions, selectClinicalScenarios, stepAnswerKey, summarizeClinicalSession,
  type ClinicalSession, type ClinicalSessionConfiguration, type ClinicalValidationContext,
} from '../../src/lib/clinical-session';
import { seededRandom } from '../../src/lib/session';
import type { ClinicalScenarioCategoryClient, ClinicalScenarioClient, ClinicalScenarioOption, ClinicalScenarioStep } from '../../src/types/content';

const option = (id: string, correct = false): ClinicalScenarioOption => ({ id, sv: `sv-${id}`, correct });
const step = (id: string, options: ClinicalScenarioOption[]): ClinicalScenarioStep => ({ id, patientSv: `patient-${id}`, promptFi: `prompt-${id}`, options });
const scenario = (id: string, categoryId: string, steps: ClinicalScenarioStep[]): ClinicalScenarioClient => ({
  id, categoryId, titleFi: `title-${id}`, contextFi: `context-${id}`, steps, resolutionSv: `resolution-sv-${id}`, resolutionFi: `resolution-fi-${id}`,
});
// A two-step and a three-step scenario, deliberately different lengths so cross-scenario transitions
// are exercised against a real length change rather than a coincidentally uniform step count.
const twoStepScenario = scenario('sc-a', 'cat', [
  step('step-1', [option('a', true), option('b'), option('c')]),
  step('step-2', [option('a'), option('b', true), option('c'), option('d')]),
]);
const threeStepScenario = scenario('sc-b', 'cat', [
  step('step-1', [option('a', true), option('b'), option('c')]),
  step('step-2', [option('a'), option('b', true), option('c')]),
  step('step-3', [option('a'), option('b'), option('c', true)]),
]);
const otherCategoryScenario = scenario('sc-c', 'other', [step('step-1', [option('a', true), option('b'), option('c')])]);
const scenarios = [twoStepScenario, threeStepScenario, otherCategoryScenario];
const categories: ClinicalScenarioCategoryClient[] = [{ id: 'cat', nameFi: 'Kategoria' }, { id: 'other', nameFi: 'Toinen' }];
const configuration: ClinicalSessionConfiguration = { sessionId: 'clinical-session', mode: 'category', sourceCategoryId: 'cat', requestedAmount: 10 };
const pool = [twoStepScenario, threeStepScenario];

function fullContext(expected: ClinicalSessionConfiguration = configuration): ClinicalValidationContext {
  return buildClinicalValidationContext(scenarios, categories, expected);
}
function compactContext(expected: ClinicalSessionConfiguration = configuration): ClinicalValidationContext {
  return buildCompactClinicalValidationContext(
    scenarios.map((item) => [item.id, item.categoryId, item.steps.length] as const),
    categories.map((item) => item.id),
    expected,
  );
}

describe('clinical scenario selection', () => {
  const largePool = Array.from({ length: 12 }, (_, index) => scenario(`sc-${index}`, 'cat', [step('step-1', [option('a', true), option('b'), option('c')])]));
  it.each([5, 10] as const)('selects %s unique scenarios deterministically', (amount) => {
    const first = selectClinicalScenarios(largePool, amount, seededRandom(7));
    const second = selectClinicalScenarios(largePool, amount, seededRandom(7));
    expect(first).toHaveLength(amount);
    expect(new Set(first.map((item) => item.id)).size).toBe(amount);
    expect(first).toEqual(second);
  });
  it('uses a short pool and shuffles Kaikki without duplicating IDs', () => {
    expect(selectClinicalScenarios([...pool, pool[0]!], 10, seededRandom(2))).toHaveLength(2);
    const shuffledIds = selectClinicalScenarios(scenarios, 'all', seededRandom(5)).map((item) => item.id);
    expect(new Set(shuffledIds).size).toBe(scenarios.length);
  });
});

describe('clinical scenario session', () => {
  it('creates typed initial state', () => {
    const session = createClinicalSession(pool, configuration, 1_000, seededRandom(1));
    expect(session.schemaVersion).toBe(1);
    expect(session.selectedScenarioIds).toHaveLength(2);
    expect(new Set(session.selectedScenarioIds)).toEqual(new Set(pool.map((item) => item.id)));
    expect(session.currentScenarioIndex).toBe(0);
    expect(session.currentStepIndex).toBe(0);
    expect(session.currentStepAnswer).toBeNull();
    expect(session.answers).toEqual({});
    expect(session.startedAt).toBe(1_000);
    expect(isClinicalSessionComplete(session)).toBe(false);
  });

  it('omits sourceCategoryId for all-mode sessions', () => {
    const session = createClinicalSession(scenarios, { sessionId: 's', mode: 'all', requestedAmount: 'all' }, 0, seededRandom(1));
    expect(session.sourceCategoryId).toBeUndefined();
    expect(Object.hasOwn(session, 'sourceCategoryId')).toBe(false);
  });

  it('records a single answer and ignores a second attempt before advancing', () => {
    let session = createClinicalSession([twoStepScenario], { ...configuration, requestedAmount: 10 }, 0, seededRandom(1));
    session = answerClinicalStep(session, 'a', true);
    expect(session.currentStepAnswer).toEqual({ optionId: 'a', correct: true });
    const reAnswered = answerClinicalStep(session, 'b', false);
    expect(reAnswered).toBe(session);
  });

  it('advances to the next step within the same scenario and clears the pending answer', () => {
    let session = createClinicalSession([twoStepScenario], configuration, 0, seededRandom(1));
    session = answerClinicalStep(session, 'a', true);
    session = advanceClinicalSession(session, 'step-1', twoStepScenario.steps.length);
    expect(session.currentScenarioIndex).toBe(0);
    expect(session.currentStepIndex).toBe(1);
    expect(session.currentStepAnswer).toBeNull();
    expect(session.answers[stepAnswerKey('sc-a', 'step-1')]).toEqual({ optionId: 'a', correct: true });
  });

  it('does not advance an unanswered step', () => {
    const session = createClinicalSession([twoStepScenario], configuration, 0, seededRandom(1));
    expect(advanceClinicalSession(session, 'step-1', 2)).toBe(session);
  });

  it('moves into the next scenario once the current one is fully answered', () => {
    let session = createClinicalSession(pool, configuration, 0, seededRandom(3));
    const firstId = currentClinicalScenarioId(session)!;
    const first = scenarios.find((item) => item.id === firstId)!;
    for (const item of first.steps) {
      session = answerClinicalStep(session, item.options[0]!.id, item.options[0]!.correct);
      session = advanceClinicalSession(session, item.id, first.steps.length);
    }
    expect(session.currentScenarioIndex).toBe(1);
    expect(session.currentStepIndex).toBe(0);
    expect(currentClinicalScenarioId(session)).not.toBe(firstId);
  });

  it('completes only after every scenario is finished', () => {
    let session = createClinicalSession(pool, configuration, 0, seededRandom(3));
    expect(isClinicalSessionComplete(session)).toBe(false);
    for (const scenarioId of session.selectedScenarioIds) {
      const current = scenarios.find((item) => item.id === scenarioId)!;
      for (const item of current.steps) {
        session = answerClinicalStep(session, item.options[0]!.id, item.options[0]!.correct);
        session = advanceClinicalSession(session, item.id, current.steps.length);
      }
    }
    expect(isClinicalSessionComplete(session)).toBe(true);
    expect(currentClinicalScenarioId(session)).toBeNull();
    expect(answerClinicalStep(session, 'a', true)).toBe(session);
  });

  it('summarizes flawless scenarios and per-step accuracy', () => {
    let session = createClinicalSession([twoStepScenario, threeStepScenario], configuration, 0, seededRandom(1));
    // sc-a flawless (both steps correct on the first and only attempt)
    session = advanceClinicalSession(answerClinicalStep(session, 'a', true), 'step-1', 2);
    session = advanceClinicalSession(answerClinicalStep(session, 'b', true), 'step-2', 2);
    // sc-b has one wrong step
    session = advanceClinicalSession(answerClinicalStep(session, 'a', true), 'step-1', 3);
    session = advanceClinicalSession(answerClinicalStep(session, 'a', false), 'step-2', 3);
    session = advanceClinicalSession(answerClinicalStep(session, 'c', true), 'step-3', 3);
    expect(isClinicalSessionComplete(session)).toBe(true);
    expect(summarizeClinicalSession(session)).toEqual({ scenarioCount: 2, flawlessScenarios: 1, totalSteps: 5, correctSteps: 4 });
  });

  it('creates a fresh round retaining configuration and resetting progression', () => {
    const old = createClinicalSession(pool, configuration, 1_000, seededRandom(1));
    const next = createNewClinicalRound(pool, old, 'new-session', 2_000, seededRandom(1));
    expect(next.sessionId).toBe('new-session');
    expect(next.startedAt).toBe(2_000);
    expect(next.mode).toBe(old.mode);
    expect(next.sourceCategoryId).toBe(old.sourceCategoryId);
    expect(next.requestedAmount).toBe(old.requestedAmount);
    expect(next.currentScenarioIndex).toBe(0);
    expect(next.currentStepIndex).toBe(0);
    expect(next.answers).toEqual({});
  });
});

describe('stable option order', () => {
  it('is deterministic for the same session, scenario, and step', () => {
    const first = orderedStepOptions(twoStepScenario.steps[1]!, 'session-x', 'sc-a');
    const second = orderedStepOptions(twoStepScenario.steps[1]!, 'session-x', 'sc-a');
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
  });
  it('always returns exactly the step options, just possibly reordered', () => {
    const options = orderedStepOptions(twoStepScenario.steps[1]!, 'session-y', 'sc-a');
    expect(new Set(options.map((item) => item.id))).toEqual(new Set(twoStepScenario.steps[1]!.options.map((item) => item.id)));
  });
});

describe('stored clinical session validation', () => {
  it('round trips every progression state with the full context', () => {
    let session = createClinicalSession(pool, configuration, 1_000, seededRandom(1));
    expect(isStoredClinicalSession(JSON.parse(JSON.stringify(session)), fullContext())).toBe(true);
    session = answerClinicalStep(session, 'a', true);
    expect(isStoredClinicalSession(JSON.parse(JSON.stringify(session)), fullContext())).toBe(true);
    session = advanceClinicalSession(session, 'step-1', 2);
    expect(isStoredClinicalSession(JSON.parse(JSON.stringify(session)), fullContext())).toBe(true);
  });

  it('round trips a completed session', () => {
    let session = createClinicalSession([twoStepScenario], { ...configuration, requestedAmount: 5 }, 0, seededRandom(1));
    for (const item of twoStepScenario.steps) {
      session = answerClinicalStep(session, item.options[0]!.id, item.options[0]!.correct);
      session = advanceClinicalSession(session, item.id, twoStepScenario.steps.length);
    }
    expect(isClinicalSessionComplete(session)).toBe(true);
    expect(isStoredClinicalSession(JSON.parse(JSON.stringify(session)), fullContext({ ...configuration, requestedAmount: 5 }))).toBe(true);
  });

  it.each([
    ['unknown scenario', (s: ClinicalSession) => ({ ...s, selectedScenarioIds: ['missing'] })],
    ['duplicate selected scenarios', (s: ClinicalSession) => ({ ...s, selectedScenarioIds: [s.selectedScenarioIds[0], s.selectedScenarioIds[0]] })],
    ['negative scenario index', (s: ClinicalSession) => ({ ...s, currentScenarioIndex: -1 })],
    ['scenario index past the end', (s: ClinicalSession) => ({ ...s, currentScenarioIndex: s.selectedScenarioIds.length + 1 })],
    ['step index past the current scenario length', (s: ClinicalSession) => ({ ...s, currentStepIndex: 99 })],
    ['incompatible schema version', (s: ClinicalSession) => ({ ...s, schemaVersion: 2 })],
    ['unreasonable session ID', (s: ClinicalSession) => ({ ...s, sessionId: '../../etc' })],
    ['non-object answers', (s: ClinicalSession) => ({ ...s, answers: [] })],
  ] as const)('rejects %s', (_label, mutate) => {
    const session = createClinicalSession(pool, configuration, 1_000, seededRandom(1));
    expect(isStoredClinicalSession(mutate(session), fullContext())).toBe(false);
  });

  it('rejects a tampered current-step option under the full context', () => {
    let session = createClinicalSession([twoStepScenario], configuration, 0, seededRandom(1));
    session = answerClinicalStep(session, 'a', true);
    const tampered = { ...session, currentStepAnswer: { optionId: 'b', correct: true } };
    expect(isStoredClinicalSession(tampered, fullContext())).toBe(false);
    const unknownOption = { ...session, currentStepAnswer: { optionId: 'zzz', correct: true } };
    expect(isStoredClinicalSession(unknownOption, fullContext())).toBe(false);
  });

  it('rejects an answer recorded for a step beyond the current pointer', () => {
    const session = createClinicalSession([twoStepScenario], configuration, 0, seededRandom(1));
    const invalid: ClinicalSession = { ...session, answers: { [stepAnswerKey('sc-a', 'step-2')]: { optionId: 'b', correct: true } } };
    expect(isStoredClinicalSession(invalid, fullContext())).toBe(false);
  });

  it('rejects a missing answer for a step before the current pointer', () => {
    let session = createClinicalSession([twoStepScenario], configuration, 0, seededRandom(1));
    session = advanceClinicalSession(answerClinicalStep(session, 'a', true), 'step-1', 2);
    const invalid: ClinicalSession = { ...session, answers: {} };
    expect(isStoredClinicalSession(invalid, fullContext())).toBe(false);
  });

  it('rejects a completed session that still carries a pending answer or a nonzero step index', () => {
    let session = createClinicalSession([twoStepScenario], { ...configuration, requestedAmount: 5 }, 0, seededRandom(1));
    for (const item of twoStepScenario.steps) {
      session = answerClinicalStep(session, item.options[0]!.id, item.options[0]!.correct);
      session = advanceClinicalSession(session, item.id, twoStepScenario.steps.length);
    }
    const context = fullContext({ ...configuration, requestedAmount: 5 });
    expect(isStoredClinicalSession({ ...session, currentStepIndex: 1 }, context)).toBe(false);
    expect(isStoredClinicalSession({ ...session, currentStepAnswer: { optionId: 'a', correct: true } }, context)).toBe(false);
  });

  it('rejects scenarios from outside the requested category, and a URL/session mismatch', () => {
    const session = createClinicalSession(pool, configuration, 0, seededRandom(1));
    const crossCategory = { ...session, selectedScenarioIds: [otherCategoryScenario.id, ...session.selectedScenarioIds.slice(1)] };
    expect(isStoredClinicalSession(crossCategory, fullContext())).toBe(false);
    expect(isStoredClinicalSession(session, fullContext({ ...configuration, requestedAmount: 5 }))).toBe(false);
    expect(isStoredClinicalSession(session, fullContext({ ...configuration, sourceCategoryId: 'other' }))).toBe(false);
  });

  it('accepts a structurally valid session under the compact context, without option-level tamper checks', () => {
    let session = createClinicalSession([twoStepScenario], configuration, 0, seededRandom(1));
    session = answerClinicalStep(session, 'a', true);
    expect(isStoredClinicalSession(session, compactContext())).toBe(true);
    // Documents the intentional trade-off: the compact context has no option data, so it cannot
    // catch a tampered correctness flag the way the full context does (see the test above).
    const tampered = { ...session, currentStepAnswer: { optionId: 'a', correct: false } };
    expect(isStoredClinicalSession(tampered, compactContext())).toBe(true);
    expect(isStoredClinicalSession(tampered, fullContext())).toBe(false);
  });

  it('still rejects a structurally invalid session under the compact context', () => {
    const session = createClinicalSession([twoStepScenario], configuration, 0, seededRandom(1));
    expect(isStoredClinicalSession({ ...session, selectedScenarioIds: ['missing'] }, compactContext())).toBe(false);
  });
});
