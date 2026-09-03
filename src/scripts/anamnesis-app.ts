import {
  advanceAnamnesisSession,
  assessAnamnesisItem,
  createAnamnesisSession,
  createNewAnamnesisRound,
  flattenAnamnesisCase,
  isAnamnesisSessionComplete,
  isStoredAnamnesisSession,
  revealAnamnesisItem,
  summarizeAnamnesisSession,
  updateAnamnesisDraft,
  type AnamnesisSelfAssessment,
  type AnamnesisSession,
  type AnamnesisSessionConfiguration,
  type AnamnesisValidationContext,
  type FlattenedAnamnesisItem,
} from '../lib/anamnesis-session';
import { buildAnamnesisSessionUrl, parseAnamnesisRequest } from '../lib/anamnesis-url';
import { formatDuration } from '../lib/time';
import type { AnamnesisCaseClient } from '../types/content';
import { dispatchProgress } from '../lib/progress/storage';
import { startActiveTime } from '../lib/progress/active-time';
import { showSessionRewards } from '../lib/progress/session-summary';
import { requestFeedback } from '../lib/motion/feedback';

const STORAGE_KEY = 'medicinsk-svenska.anamnesis-session.v1';
const RETIRED_STORAGE_KEY = 'medicinsk-svenska.clinical-session.v1';

function initializeAnamnesisApp() {
if (!document.getElementById('anamnesis-cases-data')) return;
const controller = new AbortController();
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const cases = JSON.parse(byId<HTMLScriptElement>('anamnesis-cases-data').textContent ?? '[]') as AnamnesisCaseClient[];
const caseById = new Map(cases.map((item) => [item.id, item]));
const validCaseIds = new Set(cases.map((item) => item.id));

const sessionView = byId('clinical-session-view');
const summaryView = byId('clinical-summary');
const errorView = byId('clinical-error');
const sectionPosition = byId('anamnesis-section-position');
const transcript = byId('clinical-transcript');
const instruction = byId('anamnesis-instruction');
const form = byId<HTMLFormElement>('anamnesis-form');
const input = byId<HTMLInputElement>('anamnesis-input');
const revealButton = byId<HTMLButtonElement>('anamnesis-reveal');
const actionsRow = byId('anamnesis-actions');
const didNotKnowButton = byId<HTMLButtonElement>('anamnesis-did-not-know');
const knewButton = byId<HTMLButtonElement>('anamnesis-knew');
const continueButton = byId<HTMLButtonElement>('anamnesis-continue');
const elapsed = byId<HTMLTimeElement>('clinical-elapsed');

function showError() {
  sessionView.hidden = true;
  summaryView.hidden = true;
  errorView.hidden = false;
  elapsed.parentElement!.hidden = true;
  byId('clinical-session-label').textContent = 'Kliiniset tilanteet';
  byId('clinical-error-title').focus();
}

function bubble(kind: 'patient' | 'learner', text: string, state?: 'model', caption?: string): HTMLElement {
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

function startApp() {
  // The retired multiple-choice experience used a different key and shape; drop it so it never
  // lingers as dead state once this engine owns the route.
  try { localStorage.removeItem(RETIRED_STORAGE_KEY); } catch { /* best-effort cleanup */ }

  const parsed = parseAnamnesisRequest(location.search, validCaseIds);
  if (!parsed.ok) return showError();
  const anamnesisCase = caseById.get(parsed.value.caseId);
  if (!anamnesisCase) return showError();

  const configuration: AnamnesisSessionConfiguration = parsed.value.sessionId
    ? parsed.value as AnamnesisSessionConfiguration
    : { ...parsed.value, sessionId: crypto.randomUUID() };
  if (!parsed.value.sessionId) {
    localStorage.removeItem(STORAGE_KEY);
    history.replaceState(null, '', buildAnamnesisSessionUrl(configuration, location.pathname));
  }

  const flattened: FlattenedAnamnesisItem[] = flattenAnamnesisCase(anamnesisCase);
  const total = flattened.length;
  const context: AnamnesisValidationContext = {
    itemIdsByCaseId: new Map([[anamnesisCase.id, flattened.map((entry) => entry.item.id)]]),
    expected: configuration,
  };

  function readStored(): { kind: 'missing' } | { kind: 'valid'; session: AnamnesisSession } | { kind: 'invalid' } {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return { kind: 'missing' };
      const value: unknown = JSON.parse(raw);
      return isStoredAnamnesisSession(value, context) ? { kind: 'valid', session: value } : { kind: 'invalid' };
    } catch { return { kind: 'invalid' }; }
  }
  const stored = readStored();
  // Unlike an unknown case or a malformed URL, a stale/corrupted stored session is not the
  // learner's fault and does not deserve a dead end: drop it and start a fresh session instead.
  if (stored.kind === 'invalid') { try { localStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ } }
  let session: AnamnesisSession = stored.kind === 'valid' ? stored.session : createAnamnesisSession(configuration, Date.now());
  const sourceId = session.caseId;
  dispatchProgress({ type: 'session-started', eventId: `clinical:${session.sessionId}:started`, sessionId: session.sessionId, mode: 'clinical', sourceId, selectedCount: total, occurredAt: session.startedAt });
  byId('clinical-session-label').textContent = anamnesisCase.nameFi;

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

  function renderTranscript(current: FlattenedAnamnesisItem) {
    const nodes: HTMLElement[] = [bubble('patient', current.item.patientSv)];
    if (session.currentRevealed) {
      nodes.push(bubble('learner', session.currentDraftAnswer, undefined, 'Sinä kysyit:'));
      const caption = current.item.modelQuestionsSv.length > 1 ? 'Mallikysymykset:' : 'Mallikysymys:';
      current.item.modelQuestionsSv.forEach((question, index) => {
        nodes.push(bubble('learner', question, 'model', index === 0 ? caption : undefined));
      });
    }
    transcript.replaceChildren(...nodes);
  }

  function render(focus = false) {
    persist();
    errorView.hidden = true;
    if (isAnamnesisSessionComplete(session, total)) {
      sessionView.hidden = true; summaryView.hidden = false;
      const summary = summarizeAnamnesisSession(session, total);
      dispatchProgress({ type: 'session-completed', eventId: `clinical:${session.sessionId}:completed`, sessionId: session.sessionId, mode: 'clinical', sourceId, selectedCount: total, occurredAt: Date.now() });
      showSessionRewards('clinical-rewards', session.sessionId);
      byId('clinical-summary-knew').textContent = String(summary.knew);
      byId('clinical-summary-missed').textContent = String(summary.didNotKnow);
      byId<HTMLTimeElement>('clinical-summary-time').textContent = formatDuration(Date.now() - session.startedAt);
      if (focus) byId('clinical-summary-title').focus();
      return;
    }
    const current = flattened[session.currentItemIndex]!;
    sessionView.hidden = false; summaryView.hidden = true;

    byId('clinical-progress').textContent = `Kysymys ${session.currentItemIndex + 1} / ${total}`;
    byId('clinical-progress-bar').style.width = `${(session.currentItemIndex / total) * 100}%`;
    updateClocks();
    sectionPosition.textContent = `Osio ${current.sectionIndex + 1} / ${current.sectionCount} · ${current.sectionNameFi}`;
    renderTranscript(current);

    const revealed = session.currentRevealed;
    form.hidden = revealed;
    instruction.hidden = revealed;
    input.value = session.currentDraftAnswer;
    revealButton.disabled = session.currentDraftAnswer.trim().length === 0;

    actionsRow.hidden = !revealed;
    if (revealed) {
      const assessed = session.currentSelfAssessment;
      didNotKnowButton.hidden = Boolean(assessed);
      knewButton.hidden = Boolean(assessed);
      continueButton.hidden = !assessed;
      if (assessed) continueButton.textContent = session.currentItemIndex === total - 1 ? 'Näytä yhteenveto' : 'Jatka';
    }

    if (focus) {
      if (!revealed) input.focus();
      else if (!session.currentSelfAssessment) didNotKnowButton.focus();
      else continueButton.focus();
    }
  }

  function reveal(event: SubmitEvent) {
    event.preventDefault();
    if (session.currentRevealed || !input.value.trim()) return;
    session = revealAnamnesisItem(updateAnamnesisDraft(session, input.value));
    persist();
    render(true);
    requestFeedback('reveal', transcript);
  }

  function assess(assessment: AnamnesisSelfAssessment) {
    if (!session.currentRevealed || session.currentSelfAssessment) return;
    session = assessAnamnesisItem(session, assessment);
    persist();
    render(true);
    requestFeedback(assessment === 'knew' ? 'correct' : 'incorrect', actionsRow);
  }

  function advanceItem() {
    const current = flattened[session.currentItemIndex];
    const assessment = session.currentSelfAssessment;
    if (!current || !assessment) return;
    const next = flattened[session.currentItemIndex + 1];
    const crossesSection = next !== undefined && next.sectionIndex !== current.sectionIndex;
    session = advanceAnamnesisSession(session, current.item.id);
    dispatchProgress({
      type: 'item-completed', eventId: `clinical:${session.sessionId}:item:${current.item.id}`, sessionId: session.sessionId,
      mode: 'clinical', itemId: current.item.id, sourceId, occurredAt: Date.now(),
      firstAttemptCorrect: assessment === 'knew', hadMisses: assessment !== 'knew', resolution: assessment === 'knew' ? 'correct' : 'incorrect',
    });
    persist();
    render(false);
    requestFeedback('item-change', sessionView, null);
    if (isAnamnesisSessionComplete(session, total)) byId('clinical-summary-title').focus();
    else if (crossesSection) sectionPosition.focus();
    else input.focus();
  }

  function newRound() {
    const sessionId = crypto.randomUUID();
    session = createNewAnamnesisRound(session, sessionId, Date.now());
    history.replaceState(null, '', buildAnamnesisSessionUrl({ sessionId, caseId: session.caseId }, location.pathname));
    persist(); render(true);
    dispatchProgress({ type: 'session-started', eventId: `clinical:${session.sessionId}:started`, sessionId: session.sessionId, mode: 'clinical', sourceId, selectedCount: total, occurredAt: session.startedAt });
  }

  input.addEventListener('input', () => {
    session = updateAnamnesisDraft(session, input.value);
    persist();
    revealButton.disabled = input.value.trim().length === 0;
  });
  form.addEventListener('submit', reveal);
  didNotKnowButton.addEventListener('click', () => assess('did-not-know'));
  knewButton.addEventListener('click', () => assess('knew'));
  continueButton.addEventListener('click', advanceItem);
  byId<HTMLButtonElement>('clinical-new-round').addEventListener('click', newRound);

  const clockTimer = window.setInterval(() => updateClocks(), 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); }, { signal: controller.signal });
  const activeTime = startActiveTime({ mode: 'clinical', sessionId: () => session.sessionId, eligible: () => Boolean(!isAnamnesisSessionComplete(session, total) && errorView.hidden) });
  document.addEventListener('astro:before-swap', () => {
    controller.abort();
    window.clearInterval(clockTimer);
    activeTime.stop();
  }, { once: true });
  render(true);
}

startApp();
}

document.addEventListener('astro:page-load', initializeAnamnesisApp);
