import { seededRandom, shuffled } from './session';
import type { ClinicalScenarioClient, ClinicalScenarioCategoryClient, ClinicalScenarioOption, ClinicalScenarioStep } from '../types/content';

export const CLINICAL_SESSION_SCHEMA_VERSION = 1 as const;
export type ClinicalRequestedAmount = 5 | 10 | 'all';
export type ClinicalSessionMode = 'all' | 'category';

export interface ClinicalStepAnswer { optionId: string; correct: boolean }

export interface ClinicalSessionConfiguration {
  sessionId: string;
  mode: ClinicalSessionMode;
  sourceCategoryId?: string;
  requestedAmount: ClinicalRequestedAmount;
}

export interface ClinicalSession extends ClinicalSessionConfiguration {
  schemaVersion: typeof CLINICAL_SESSION_SCHEMA_VERSION;
  selectedScenarioIds: string[];
  currentScenarioIndex: number;
  currentStepIndex: number;
  currentStepAnswer: ClinicalStepAnswer | null;
  answers: Record<string, ClinicalStepAnswer>;
  startedAt: number;
}

export interface ClinicalValidationContext {
  categoryByScenarioId: ReadonlyMap<string, string>;
  stepIdsByScenarioId: ReadonlyMap<string, readonly string[]>;
  /**
   * Per-option identity and correctness, keyed by `${scenarioId}:${stepId}` then `:${optionId}`.
   * Omitted by the compact (home-page) context, which only has scenario/step shape available and
   * skips option-level tamper checks; the full context built from the loaded exercise payload
   * always supplies these and is the only one trusted to resume a session into active play.
   */
  optionIdsByStepKey?: ReadonlyMap<string, ReadonlySet<string>>;
  optionCorrectByKey?: ReadonlyMap<string, boolean>;
  validCategoryIds: ReadonlySet<string>;
  expected: ClinicalSessionConfiguration;
}

export interface ClinicalSessionSummary {
  scenarioCount: number;
  flawlessScenarios: number;
  totalSteps: number;
  correctSteps: number;
}

function fnv1aHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function stepAnswerKey(scenarioId: string, stepId: string): string {
  return `${scenarioId}:${stepId}`;
}

export function selectClinicalScenarios(
  scenarios: readonly ClinicalScenarioClient[],
  requestedAmount: ClinicalRequestedAmount,
  random: () => number = Math.random,
): ClinicalScenarioClient[] {
  const unique = [...new Map(scenarios.map((scenario) => [scenario.id, scenario])).values()];
  const randomized = shuffled(unique, random);
  return requestedAmount === 'all' ? randomized : randomized.slice(0, requestedAmount);
}

export function createClinicalSession(
  scenarios: readonly ClinicalScenarioClient[],
  configuration: ClinicalSessionConfiguration,
  now = Date.now(),
  random: () => number = Math.random,
): ClinicalSession {
  const selectedScenarioIds = selectClinicalScenarios(scenarios, configuration.requestedAmount, random).map((scenario) => scenario.id);
  return {
    schemaVersion: CLINICAL_SESSION_SCHEMA_VERSION,
    sessionId: configuration.sessionId,
    mode: configuration.mode,
    ...(configuration.mode === 'category' && configuration.sourceCategoryId
      ? { sourceCategoryId: configuration.sourceCategoryId } : {}),
    requestedAmount: configuration.requestedAmount,
    selectedScenarioIds,
    currentScenarioIndex: 0,
    currentStepIndex: 0,
    currentStepAnswer: null,
    answers: {},
    startedAt: now,
  };
}

/** The scenario ID the learner is currently on, or null once every selected scenario is finished. */
export function currentClinicalScenarioId(session: ClinicalSession): string | null {
  return session.selectedScenarioIds[session.currentScenarioIndex] ?? null;
}

export function isClinicalSessionComplete(session: ClinicalSession): boolean {
  return session.currentScenarioIndex >= session.selectedScenarioIds.length;
}

/** Records the learner's single attempt at the current step; a second call before advancing is a no-op. */
export function answerClinicalStep(session: ClinicalSession, optionId: string, correct: boolean): ClinicalSession {
  if (isClinicalSessionComplete(session) || session.currentStepAnswer) return session;
  return { ...session, currentStepAnswer: { optionId, correct } };
}

/**
 * Moves past the just-answered step, either to the scenario's next step or, once its last step is
 * answered, into the next scenario (or to completion). `currentStepId` and `currentScenarioStepCount`
 * come from the caller's already-loaded content, keeping this module free of a content dependency.
 */
export function advanceClinicalSession(
  session: ClinicalSession,
  currentStepId: string,
  currentScenarioStepCount: number,
): ClinicalSession {
  const scenarioId = currentClinicalScenarioId(session);
  if (!scenarioId || !session.currentStepAnswer) return session;
  const answers = { ...session.answers, [stepAnswerKey(scenarioId, currentStepId)]: session.currentStepAnswer };
  if (session.currentStepIndex + 1 < currentScenarioStepCount) {
    return { ...session, answers, currentStepIndex: session.currentStepIndex + 1, currentStepAnswer: null };
  }
  return { ...session, answers, currentScenarioIndex: session.currentScenarioIndex + 1, currentStepIndex: 0, currentStepAnswer: null };
}

export function summarizeClinicalSession(session: ClinicalSession): ClinicalSessionSummary {
  const resultsByScenario = new Map<string, boolean[]>();
  for (const [key, entry] of Object.entries(session.answers)) {
    const scenarioId = key.slice(0, key.indexOf(':'));
    const results = resultsByScenario.get(scenarioId) ?? [];
    results.push(entry.correct);
    resultsByScenario.set(scenarioId, results);
  }
  const entries = Object.values(session.answers);
  const flawlessScenarios = session.selectedScenarioIds.filter((id) => {
    const results = resultsByScenario.get(id);
    return results !== undefined && results.length > 0 && results.every(Boolean);
  }).length;
  return {
    scenarioCount: session.selectedScenarioIds.length,
    flawlessScenarios,
    totalSteps: entries.length,
    correctSteps: entries.filter((entry) => entry.correct).length,
  };
}

export function createNewClinicalRound(
  scenarios: readonly ClinicalScenarioClient[],
  previous: ClinicalSession,
  sessionId: string,
  now = Date.now(),
  random: () => number = Math.random,
): ClinicalSession {
  let next = createClinicalSession(scenarios, {
    sessionId,
    mode: previous.mode,
    ...(previous.mode === 'category' && previous.sourceCategoryId ? { sourceCategoryId: previous.sourceCategoryId } : {}),
    requestedAmount: previous.requestedAmount,
  }, now, random);
  if (next.selectedScenarioIds.length > 1 && next.selectedScenarioIds.every((id, index) => id === previous.selectedScenarioIds[index])) {
    const selectedScenarioIds = [...next.selectedScenarioIds.slice(1), next.selectedScenarioIds[0]!];
    next = { ...next, selectedScenarioIds };
  }
  return next;
}

/** A per-session, per-step stable shuffle so the correct option isn't always rendered in the same slot. */
export function stableOptionOrder(sessionId: string, scenarioId: string, stepId: string): () => number {
  return seededRandom(fnv1aHash(`${sessionId}:${scenarioId}:${stepId}:options`));
}

export function orderedStepOptions(
  step: ClinicalScenarioStep,
  sessionId: string,
  scenarioId: string,
): ClinicalScenarioOption[] {
  return shuffled(step.options, stableOptionOrder(sessionId, scenarioId, step.id));
}

export function buildClinicalValidationContext(
  scenarios: readonly ClinicalScenarioClient[],
  categories: readonly ClinicalScenarioCategoryClient[],
  expected: ClinicalSessionConfiguration,
): ClinicalValidationContext {
  const categoryByScenarioId = new Map(scenarios.map((scenario) => [scenario.id, scenario.categoryId]));
  const stepIdsByScenarioId = new Map(scenarios.map((scenario) => [scenario.id, scenario.steps.map((step) => step.id)]));
  const optionIdsByStepKey = new Map<string, ReadonlySet<string>>();
  const optionCorrectByKey = new Map<string, boolean>();
  for (const scenario of scenarios) {
    for (const step of scenario.steps) {
      const key = stepAnswerKey(scenario.id, step.id);
      optionIdsByStepKey.set(key, new Set(step.options.map((option) => option.id)));
      for (const option of step.options) optionCorrectByKey.set(`${key}:${option.id}`, option.correct);
    }
  }
  return {
    categoryByScenarioId,
    stepIdsByScenarioId,
    optionIdsByStepKey,
    optionCorrectByKey,
    validCategoryIds: new Set(categories.map((category) => category.id)),
    expected,
  };
}

/**
 * A lighter validation context for surfaces (the home launcher's daily-quest shortcuts) that only
 * carry a compact `[id, categoryId, stepCount]` catalog rather than the full scenario payload. Step
 * IDs are derived from the `step-1..step-N` convention the content validator enforces, so no option
 * data is needed to check structural and contiguity invariants; see `ClinicalValidationContext` for
 * what this intentionally leaves unchecked.
 */
export function buildCompactClinicalValidationContext(
  scenarioSummaries: readonly (readonly [string, string, number])[],
  categoryIds: readonly string[],
  expected: ClinicalSessionConfiguration,
): ClinicalValidationContext {
  const categoryByScenarioId = new Map(scenarioSummaries.map(([id, categoryId]) => [id, categoryId]));
  const stepIdsByScenarioId = new Map(scenarioSummaries.map(([id, , stepCount]) => [
    id, Array.from({ length: stepCount }, (_, index) => `step-${index + 1}`),
  ]));
  return {
    categoryByScenarioId,
    stepIdsByScenarioId,
    validCategoryIds: new Set(categoryIds),
    expected,
  };
}

export function isReasonableClinicalSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/u.test(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStepAnswer(value: unknown): value is ClinicalStepAnswer {
  return isPlainRecord(value) && typeof value.optionId === 'string' && typeof value.correct === 'boolean';
}

export function isStoredClinicalSession(value: unknown, context: ClinicalValidationContext): value is ClinicalSession {
  if (!isPlainRecord(value)) return false;
  const session = value as Partial<ClinicalSession>;
  const selected = session.selectedScenarioIds;
  const answers = session.answers;

  if (!(
    session.schemaVersion === CLINICAL_SESSION_SCHEMA_VERSION &&
    isReasonableClinicalSessionId(session.sessionId) &&
    (session.mode === 'all' || session.mode === 'category') &&
    (session.mode === 'category'
      ? typeof session.sourceCategoryId === 'string' && context.validCategoryIds.has(session.sourceCategoryId)
      : session.sourceCategoryId === undefined) &&
    (session.requestedAmount === 5 || session.requestedAmount === 10 || session.requestedAmount === 'all') &&
    Array.isArray(selected) && selected.length > 0 && new Set(selected).size === selected.length &&
    selected.every((id) => typeof id === 'string' && context.categoryByScenarioId.has(id)) &&
    Number.isInteger(session.currentScenarioIndex) && Number(session.currentScenarioIndex) >= 0 &&
    Number(session.currentScenarioIndex) <= selected.length &&
    Number.isInteger(session.currentStepIndex) && Number(session.currentStepIndex) >= 0 &&
    (session.currentStepAnswer === null || isStepAnswer(session.currentStepAnswer)) &&
    isPlainRecord(answers) &&
    typeof session.startedAt === 'number' && Number.isFinite(session.startedAt) && session.startedAt >= 0 &&
    session.sessionId === context.expected.sessionId && session.mode === context.expected.mode &&
    session.sourceCategoryId === context.expected.sourceCategoryId && session.requestedAmount === context.expected.requestedAmount
  )) return false;

  if (session.mode === 'category' && !selected.every((id) => context.categoryByScenarioId.get(id) === session.sourceCategoryId)) return false;

  const currentScenarioIndex = Number(session.currentScenarioIndex);
  const currentStepIndex = Number(session.currentStepIndex);
  const complete = currentScenarioIndex >= selected.length;

  if (!complete) {
    const scenarioId = selected[currentScenarioIndex]!;
    const stepIds = context.stepIdsByScenarioId.get(scenarioId);
    if (!stepIds || currentStepIndex >= stepIds.length) return false;
    if (session.currentStepAnswer && context.optionIdsByStepKey) {
      const key = stepAnswerKey(scenarioId, stepIds[currentStepIndex]!);
      const optionIds = context.optionIdsByStepKey.get(key);
      if (!optionIds || !optionIds.has(session.currentStepAnswer.optionId)) return false;
      if (context.optionCorrectByKey?.get(`${key}:${session.currentStepAnswer.optionId}`) !== session.currentStepAnswer.correct) return false;
    }
  } else if (session.currentStepAnswer !== null || currentStepIndex !== 0) return false;

  const answerEntries = Object.entries(answers);
  for (const [key, entry] of answerEntries) {
    if (!isStepAnswer(entry)) return false;
    const separatorIndex = key.indexOf(':');
    if (separatorIndex < 0) return false;
    const scenarioId = key.slice(0, separatorIndex);
    if (!selected.includes(scenarioId)) return false;
    if (context.optionIdsByStepKey) {
      const optionIds = context.optionIdsByStepKey.get(key);
      if (!optionIds || !optionIds.has(entry.optionId)) return false;
      if (context.optionCorrectByKey?.get(`${key}:${entry.optionId}`) !== entry.correct) return false;
    }
  }

  let expectedAnswered = 0;
  for (let index = 0; index < selected.length; index += 1) {
    const scenarioId = selected[index]!;
    const stepIds = context.stepIdsByScenarioId.get(scenarioId) ?? [];
    const answeredCount = index < currentScenarioIndex
      ? stepIds.length
      : index === currentScenarioIndex && !complete ? currentStepIndex : 0;
    for (let stepIndex = 0; stepIndex < stepIds.length; stepIndex += 1) {
      const shouldBeAnswered = stepIndex < answeredCount;
      const hasAnswer = Object.hasOwn(answers, stepAnswerKey(scenarioId, stepIds[stepIndex]!));
      if (shouldBeAnswered !== hasAnswer) return false;
      if (shouldBeAnswered) expectedAnswered += 1;
    }
  }
  return expectedAnswered === answerEntries.length;
}
