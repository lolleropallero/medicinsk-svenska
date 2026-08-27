import {
  advanceClinicalSession,
  answerClinicalStep,
  buildClinicalValidationContext,
  createClinicalSession,
  createNewClinicalRound,
  currentClinicalScenarioId,
  isClinicalSessionComplete,
  isStoredClinicalSession,
  orderedStepOptions,
  summarizeClinicalSession,
  type ClinicalSession,
  type ClinicalSessionConfiguration,
} from '../lib/clinical-session';
import { buildClinicalSessionUrl, parseClinicalRequest } from '../lib/clinical-url';
import { formatDuration } from '../lib/time';
import type { ClinicalScenarioCategoryClient, ClinicalScenarioClient } from '../types/content';
import { dispatchProgress } from '../lib/progress/storage';
import { startActiveTime } from '../lib/progress/active-time';
import { showSessionRewards } from '../lib/progress/session-summary';
import { requestFeedback } from '../lib/motion/feedback';

function initializeClinicalApp() {
if (!document.getElementById('clinical-scenarios-data')) return;
const controller = new AbortController();
const STORAGE_KEY = 'medicinsk-svenska.clinical-session.v1';
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const scenarios = JSON.parse(byId<HTMLScriptElement>('clinical-scenarios-data').textContent ?? '[]') as ClinicalScenarioClient[];
const categories = JSON.parse(byId<HTMLScriptElement>('clinical-categories-data').textContent ?? '[]') as ClinicalScenarioCategoryClient[];
const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
const categoryById = new Map(categories.map((category) => [category.id, category]));
const validCategoryIds = new Set(categories.map((category) => category.id));

const sessionView = byId('clinical-session-view');
const summaryView = byId('clinical-summary');
const errorView = byId('clinical-error');
const transcript = byId('clinical-transcript');
const promptEl = byId('clinical-prompt');
const optionsEl = byId('clinical-options');
const feedbackView = byId('clinical-feedback');
const feedbackLabel = byId('clinical-feedback-label');
const feedbackExplanation = byId('clinical-feedback-explanation');
const resolutionView = byId('clinical-resolution');
const resolutionSvEl = byId('clinical-resolution-sv');
const resolutionFiEl = byId('clinical-resolution-fi');
const continueButton = byId<HTMLButtonElement>('clinical-continue');
const elapsed = byId<HTMLTimeElement>('clinical-elapsed');
let grading = false;

function showError() {
  sessionView.hidden = true;
  summaryView.hidden = true;
  errorView.hidden = false;
  elapsed.parentElement!.hidden = true;
  byId('clinical-session-label').textContent = 'Kliiniset tilanteet';
  byId('clinical-error-title').focus();
}

function startApp() {
  const parsed = parseClinicalRequest(location.search, validCategoryIds);
  if (!parsed.ok) return showError();
  let configuration: ClinicalSessionConfiguration = parsed.value.sessionId
    ? parsed.value as ClinicalSessionConfiguration
    : { ...parsed.value, sessionId: crypto.randomUUID() };
  if (!parsed.value.sessionId) {
    localStorage.removeItem(STORAGE_KEY);
    history.replaceState(null, '', buildClinicalSessionUrl(configuration, location.pathname));
  }
  const pool = configuration.mode === 'category'
    ? scenarios.filter((scenario) => scenario.categoryId === configuration.sourceCategoryId)
    : scenarios;
  if (!pool.length) return showError();

  function readStored(): { kind: 'missing' } | { kind: 'valid'; session: ClinicalSession } | { kind: 'invalid' } {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return { kind: 'missing' };
      const value: unknown = JSON.parse(raw);
      return isStoredClinicalSession(value, buildClinicalValidationContext(scenarios, categories, configuration))
        ? { kind: 'valid', session: value } : { kind: 'invalid' };
    } catch { return { kind: 'invalid' }; }
  }
  const stored = readStored();
  if (stored.kind === 'invalid') return showError();
  let session = stored.kind === 'valid' ? stored.session : createClinicalSession(pool, configuration);
  const sourceId = session.mode === 'all' ? 'all' : session.sourceCategoryId!;
  dispatchProgress({ type: 'session-started', eventId: `clinical:${session.sessionId}:started`, sessionId: session.sessionId, mode: 'clinical', sourceId, selectedCount: session.selectedScenarioIds.length, occurredAt: session.startedAt });
  byId('clinical-session-label').textContent = session.mode === 'all'
    ? 'Kaikki tilanteet' : categoryById.get(session.sourceCategoryId ?? '')?.nameFi ?? 'Kliiniset tilanteet';

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch { /* NOSONAR: validated same-origin session state, never interpreted as markup. */ }
  }
  function updateClocks(now = Date.now()) {
    const milliseconds = Math.max(0, now - session.startedAt);
    const value = formatDuration(milliseconds);
    elapsed.textContent = value;
    elapsed.dateTime = `PT${Math.floor(milliseconds / 1000)}S`;
    elapsed.setAttribute('aria-label', `Kulunut aika ${value}`);
  }

  function bubble(kind: 'patient' | 'learner', text: string, state?: 'incorrect' | 'model', caption?: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = `clinical-turn clinical-turn-${kind}`;
    if (caption) {
      const small = document.createElement('small');
      small.className = 'bubble-caption';
      small.lang = 'fi';
      small.textContent = caption;
      wrap.appendChild(small);
    }
    const bubbleEl = document.createElement('span');
    bubbleEl.className = kind === 'learner' ? 'speech-bubble target' : 'speech-bubble';
    if (state) bubbleEl.dataset.state = state;
    const span = document.createElement('span');
    span.lang = 'sv';
    span.textContent = text;
    bubbleEl.appendChild(span);
    wrap.appendChild(bubbleEl);
    return wrap;
  }

  function renderTranscript(scenario: ClinicalScenarioClient) {
    const nodes: HTMLElement[] = [];
    for (let index = 0; index < session.currentStepIndex; index += 1) {
      const step = scenario.steps[index]!;
      const correctOption = step.options.find((option) => option.correct)!;
      nodes.push(bubble('patient', step.patientSv));
      nodes.push(bubble('learner', correctOption.sv));
    }
    const currentStep = scenario.steps[session.currentStepIndex];
    if (currentStep) {
      nodes.push(bubble('patient', currentStep.patientSv));
      const answer = session.currentStepAnswer;
      if (answer) {
        const chosen = currentStep.options.find((option) => option.id === answer.optionId)!;
        if (answer.correct) {
          nodes.push(bubble('learner', chosen.sv));
        } else {
          const correctOption = currentStep.options.find((option) => option.correct)!;
          nodes.push(bubble('learner', chosen.sv, 'incorrect', 'Sinä vastasit:'));
          nodes.push(bubble('learner', correctOption.sv, 'model', 'Luontevampi vastaus olisi ollut:'));
        }
      }
    }
    transcript.replaceChildren(...nodes);
  }

  function buildOptionButton(optionId: string, index: number, sv: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.optionId = optionId;
    const marker = document.createElement('span');
    marker.className = 'choice-index';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = String(index + 1);
    const label = document.createElement('span');
    label.className = 'choice-label';
    label.lang = 'sv';
    label.textContent = sv;
    button.append(marker, label);
    return button;
  }

  function render(focus = false) {
    persist();
    errorView.hidden = true;
    if (isClinicalSessionComplete(session)) {
      sessionView.hidden = true; summaryView.hidden = false;
      const summary = summarizeClinicalSession(session);
      dispatchProgress({ type: 'session-completed', eventId: `clinical:${session.sessionId}:completed`, sessionId: session.sessionId, mode: 'clinical', sourceId, selectedCount: session.selectedScenarioIds.length, occurredAt: Date.now() });
      showSessionRewards('clinical-rewards', session.sessionId);
      byId('clinical-summary-flawless').textContent = `${summary.flawlessScenarios} / ${summary.scenarioCount}`;
      byId('clinical-summary-steps').textContent = `${summary.correctSteps} / ${summary.totalSteps}`;
      byId<HTMLTimeElement>('clinical-summary-time').textContent = formatDuration(Date.now() - session.startedAt);
      if (focus) byId('clinical-summary-title').focus();
      return;
    }
    const scenarioId = currentClinicalScenarioId(session)!;
    const scenario = scenarioById.get(scenarioId);
    const step = scenario?.steps[session.currentStepIndex];
    if (!scenario || !step) { showError(); return; }
    sessionView.hidden = false; summaryView.hidden = true;

    byId('clinical-progress').textContent = `Tilanne ${session.currentScenarioIndex + 1} / ${session.selectedScenarioIds.length}`;
    byId('clinical-progress-bar').style.width = `${(session.currentScenarioIndex / session.selectedScenarioIds.length) * 100}%`;
    updateClocks();
    byId('clinical-step-position').textContent = `Vaihe ${session.currentStepIndex + 1} / ${scenario.steps.length}`;
    byId('clinical-scenario-title').textContent = scenario.titleFi;
    byId('clinical-scenario-context').textContent = scenario.contextFi;

    renderTranscript(scenario);

    const answer = session.currentStepAnswer;
    promptEl.hidden = Boolean(answer);
    promptEl.textContent = step.promptFi;
    optionsEl.hidden = Boolean(answer);
    if (!answer) {
      const options = orderedStepOptions(step, session.sessionId, scenario.id);
      optionsEl.replaceChildren(...options.map((option, index) => buildOptionButton(option.id, index, option.sv)));
    }

    feedbackView.hidden = !answer;
    if (answer) {
      feedbackView.dataset.result = answer.correct ? 'correct' : 'incorrect';
      feedbackLabel.textContent = answer.correct ? 'Hyvä, luonteva vastaus.' : 'Ei aivan paras sanamuoto tähän kohtaan.';
      const explanationText = !answer.correct ? step.explanationFi : undefined;
      feedbackExplanation.hidden = !explanationText;
      feedbackExplanation.textContent = explanationText ?? '';
      const isLastStep = session.currentStepIndex === scenario.steps.length - 1;
      resolutionView.hidden = !isLastStep;
      if (isLastStep) {
        resolutionSvEl.textContent = scenario.resolutionSv;
        resolutionFiEl.textContent = scenario.resolutionFi;
      }
      const isLastScenario = session.currentScenarioIndex === session.selectedScenarioIds.length - 1;
      continueButton.textContent = !isLastStep ? 'Jatka' : isLastScenario ? 'Näytä yhteenveto' : 'Seuraava tilanne';
    }
    if (focus) {
      if (answer) continueButton.focus();
      else optionsEl.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }

  function selectOption(optionId: string) {
    if (grading || session.currentStepAnswer) return;
    const scenarioId = currentClinicalScenarioId(session);
    const scenario = scenarioId ? scenarioById.get(scenarioId) : undefined;
    const step = scenario?.steps[session.currentStepIndex];
    const option = step?.options.find((candidate) => candidate.id === optionId);
    if (!scenario || !step || !option) return;
    grading = true;
    session = answerClinicalStep(session, optionId, option.correct);
    persist();
    render(true);
    requestFeedback(option.correct ? 'correct' : 'incorrect', feedbackView);
    grading = false;
  }

  function continueConversation() {
    const scenarioId = currentClinicalScenarioId(session);
    const scenario = scenarioId ? scenarioById.get(scenarioId) : undefined;
    const step = scenario?.steps[session.currentStepIndex];
    if (!scenario || !step || !session.currentStepAnswer) return;
    const wasLastStep = session.currentStepIndex === scenario.steps.length - 1;
    const completedScenarioId = scenario.id;
    session = advanceClinicalSession(session, step.id, scenario.steps.length);
    if (wasLastStep) {
      const entries = Object.entries(session.answers).filter(([key]) => key.startsWith(`${completedScenarioId}:`));
      const firstAttemptCorrect = entries.length > 0 && entries.every(([, entry]) => entry.correct);
      dispatchProgress({ type: 'item-completed', eventId: `clinical:${session.sessionId}:item:${completedScenarioId}`, sessionId: session.sessionId, mode: 'clinical', itemId: completedScenarioId, sourceId, occurredAt: Date.now(), firstAttemptCorrect, hadMisses: !firstAttemptCorrect, resolution: firstAttemptCorrect ? 'correct' : 'incorrect' });
    }
    persist();
    render(false);
    requestFeedback('item-change', sessionView, null);
    if (isClinicalSessionComplete(session)) byId('clinical-summary-title').focus();
    else if (wasLastStep) byId('clinical-scenario-title').focus();
    else optionsEl.querySelector<HTMLButtonElement>('button')?.focus();
  }

  function newRound() {
    const sessionId = crypto.randomUUID();
    session = createNewClinicalRound(pool, session, sessionId, Date.now(), Math.random);
    configuration = {
      sessionId, mode: session.mode,
      ...(session.mode === 'category' && session.sourceCategoryId ? { sourceCategoryId: session.sourceCategoryId } : {}),
      requestedAmount: session.requestedAmount,
    };
    history.replaceState(null, '', buildClinicalSessionUrl(configuration, location.pathname));
    persist(); render(true);
    dispatchProgress({ type: 'session-started', eventId: `clinical:${session.sessionId}:started`, sessionId: session.sessionId, mode: 'clinical', sourceId: session.mode === 'all' ? 'all' : session.sourceCategoryId!, selectedCount: session.selectedScenarioIds.length, occurredAt: session.startedAt });
  }

  optionsEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-option-id]');
    if (!button) return;
    selectOption(button.dataset.optionId!);
  });
  document.addEventListener('keydown', (event) => {
    if (optionsEl.hidden || session.currentStepAnswer) return;
    if (!/^[1-4]$/u.test(event.key)) return;
    const buttons = optionsEl.querySelectorAll<HTMLButtonElement>('button[data-option-id]');
    buttons[Number(event.key) - 1]?.click();
  }, { signal: controller.signal });
  continueButton.addEventListener('click', continueConversation);
  byId<HTMLButtonElement>('clinical-new-round').addEventListener('click', newRound);

  const clockTimer = window.setInterval(() => updateClocks(), 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); }, { signal: controller.signal });
  const activeTime = startActiveTime({ mode: 'clinical', sessionId: () => session.sessionId, eligible: () => Boolean(!isClinicalSessionComplete(session) && errorView.hidden) });
  document.addEventListener('astro:before-swap', () => {
    controller.abort();
    window.clearInterval(clockTimer);
    activeTime.stop();
  }, { once: true });
  render(true);
}

startApp();
}

document.addEventListener('astro:page-load', initializeClinicalApp);
