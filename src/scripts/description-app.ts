import { isAcceptedAnswer } from '../lib/descriptions';
import {
  advanceDescription,
  createDescriptionRetrySession,
  createDescriptionSession,
  createNewDescriptionRound,
  isStoredDescriptionSession,
  resolveDescription,
  summarizeDescriptionSession,
  updateDescriptionDraft,
  type DescriptionSession,
  type DescriptionSessionConfiguration,
} from '../lib/description-session';
import { buildDescriptionSessionUrl, parseDescriptionRequest } from '../lib/description-url';
import { formatDuration } from '../lib/time';
import type { DescriptionCategoryClient, DescriptionExerciseClient } from '../types/content';
import { dispatchProgress } from '../lib/progress/storage';
import { startActiveTime } from '../lib/progress/active-time';
import { showSessionRewards } from '../lib/progress/session-summary';

const STORAGE_KEY = 'medicinsk-svenska.description-session.v1';
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const exercises = JSON.parse(byId<HTMLScriptElement>('descriptions-data').textContent ?? '[]') as DescriptionExerciseClient[];
const categories = JSON.parse(byId<HTMLScriptElement>('description-categories-data').textContent ?? '[]') as DescriptionCategoryClient[];
const exerciseById = new Map(exercises.map((item) => [item.id, item]));
const categoryById = new Map(categories.map((item) => [item.id, item]));
const categoryByExerciseId = new Map(exercises.map((item) => [item.id, item.categoryId]));
const validCategoryIds = new Set(categories.map((item) => item.id));

const sessionView = byId('description-session-view');
const summaryView = byId('description-summary');
const errorView = byId('description-error');
const form = byId<HTMLFormElement>('answer-form');
const answerInput = byId<HTMLInputElement>('answer');
const feedback = byId('description-feedback');
const nextButton = byId<HTMLButtonElement>('description-next');
const elapsed = byId<HTMLTimeElement>('description-elapsed');
let session: DescriptionSession | null = null;
let timerId: number | null = null;

const newSessionId = () => crypto.randomUUID();

function configurationOf(value: DescriptionSession): DescriptionSessionConfiguration {
  return {
    sessionId: value.sessionId,
    sourceMode: value.sourceMode,
    ...(value.sourceMode === 'category' && value.sourceCategoryId ? { sourceCategoryId: value.sourceCategoryId } : {}),
    requestedAmount: value.requestedAmount,
    roundType: value.roundType,
  };
}

function persist() {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function showError() {
  session = null;
  if (timerId !== null) window.clearInterval(timerId);
  sessionView.hidden = true;
  summaryView.hidden = true;
  errorView.hidden = false;
  byId('description-error-title').focus();
}

function poolFor(value: Pick<DescriptionSessionConfiguration, 'sourceMode' | 'sourceCategoryId'>) {
  return value.sourceMode === 'category'
    ? exercises.filter((item) => item.categoryId === value.sourceCategoryId)
    : exercises;
}

function updateTimer() {
  if (!session) return;
  const milliseconds = Math.max(0, Date.now() - session.startedAt);
  const value = formatDuration(milliseconds);
  elapsed.textContent = value;
  elapsed.setAttribute('aria-label', `Kulunut aika ${value}`);
  elapsed.dateTime = `PT${Math.floor(milliseconds / 1000)}S`;
  if (!summaryView.hidden) byId('description-summary-time').textContent = value;
}

function startTimer() {
  updateTimer();
  if (timerId !== null) window.clearInterval(timerId);
  timerId = window.setInterval(updateTimer, 1000);
}

function render() {
  if (!session) return;
  errorView.hidden = true;
  const categoryName = session.sourceMode === 'all'
    ? 'Kaikki aiheet'
    : categoryById.get(session.sourceCategoryId ?? '')?.nameFi;
  if (!categoryName) { showError(); return; }
  byId('description-session-label').textContent = categoryName;

  if (session.currentIndex >= session.selectedExerciseIds.length) {
    sessionView.hidden = true;
    summaryView.hidden = false;
    const summary = summarizeDescriptionSession(session);
    dispatchProgress({type:'session-completed',eventId:`descriptions:${session.sessionId}:completed`,sessionId:session.sessionId,mode:'descriptions',sourceId:session.sourceMode==='all'?'all':session.sourceCategoryId!,selectedCount:session.selectedExerciseIds.length,occurredAt:Date.now()});
    showSessionRewards('description-rewards',session.sessionId);
    byId('description-summary-correct').textContent = `${summary.correct} / ${summary.total}`;
    byId('description-summary-errors').textContent = String(summary.errors);
    byId<HTMLButtonElement>('description-retry').hidden = summary.errors === 0;
    updateTimer();
    byId('description-summary-title').focus();
    return;
  }

  const item = exerciseById.get(session.selectedExerciseIds[session.currentIndex]!);
  if (!item) { showError(); return; }
  summaryView.hidden = true;
  sessionView.hidden = false;
  const position = session.currentIndex + 1;
  byId('description-progress').textContent = `${position} / ${session.selectedExerciseIds.length}`;
  byId('description-progress-bar').style.width = `${position / session.selectedExerciseIds.length * 100}%`;
  byId('description-text').textContent = item.descriptionSv;
  answerInput.value = session.currentDraftAnswer;

  if (session.currentResolvedResult) {
    form.hidden = true;
    feedback.hidden = false;
    const result = session.currentResolvedResult;
    byId('result-label').textContent = result === 'correct' ? 'Oikein' : result === 'revealed' ? 'Vastaus näytetty' : 'Ei aivan';
    byId('result-label').className = result === 'correct' ? 'correct-text' : 'incorrect-text';
    byId('canonical-answer').textContent = `${item.article ? `${item.article} ` : ''}${item.answerSv}`;
    nextButton.focus();
  } else {
    feedback.hidden = true;
    form.hidden = false;
    answerInput.focus();
  }
}

function applyResolution(result: 'correct' | 'incorrect' | 'revealed') {
  if (!session || session.currentResolvedResult) return;
  const itemId=session.selectedExerciseIds[session.currentIndex]!;
  session = resolveDescription(session, result);
  dispatchProgress({type:'item-completed',eventId:`descriptions:${session.sessionId}:item:${itemId}`,sessionId:session.sessionId,mode:'descriptions',itemId,sourceId:session.sourceMode==='all'?'all':session.sourceCategoryId!,occurredAt:Date.now(),firstAttemptCorrect:result==='correct',hadMisses:result!=='correct',resolution:result});
  persist();
  render();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!session || session.currentResolvedResult) return;
  const item = exerciseById.get(session.selectedExerciseIds[session.currentIndex]!);
  if (!item) return;
  session = updateDescriptionDraft(session, answerInput.value);
  applyResolution(isAcceptedAnswer(item, answerInput.value) ? 'correct' : 'incorrect');
});
answerInput.addEventListener('input', () => {
  if (!session) return;
  session = updateDescriptionDraft(session, answerInput.value);
  persist();
});
byId('show-answer').addEventListener('click', () => applyResolution('revealed'));
nextButton.addEventListener('click', () => {
  if (!session) return;
  session = advanceDescription(session);
  persist();
  render();
});

byId('description-retry').addEventListener('click', () => {
  if (!session) return;
  const next = createDescriptionRetrySession(session, newSessionId(), Date.now(), Math.random);
  if (!next) return;
  session = next;
  persist();
  history.replaceState(null, '', buildDescriptionSessionUrl(configurationOf(session)));
  startTimer();
  dispatchProgress({type:'session-started',eventId:`descriptions:${session.sessionId}:started`,sessionId:session.sessionId,mode:'descriptions',sourceId:session.sourceMode==='all'?'all':session.sourceCategoryId!,selectedCount:session.selectedExerciseIds.length,occurredAt:session.startedAt});
  render();
});

byId('description-new-round').addEventListener('click', () => {
  if (!session) return;
  session = createNewDescriptionRound(poolFor(session), session, newSessionId(), Date.now(), Math.random);
  persist();
  history.replaceState(null, '', buildDescriptionSessionUrl(configurationOf(session)));
  startTimer();
  dispatchProgress({type:'session-started',eventId:`descriptions:${session.sessionId}:started`,sessionId:session.sessionId,mode:'descriptions',sourceId:session.sourceMode==='all'?'all':session.sourceCategoryId!,selectedCount:session.selectedExerciseIds.length,occurredAt:session.startedAt});
  render();
});

function restoreOrCreate() {
  const parsed = parseDescriptionRequest(location.search, validCategoryIds);
  if (!parsed.ok) { showError(); return; }
  const request = parsed.value;
  if (!request.sessionId) {
    if (request.roundType === 'retry') { showError(); return; }
    request.sessionId = newSessionId();
    history.replaceState(null, '', buildDescriptionSessionUrl(request as DescriptionSessionConfiguration));
  }
  const expected = request as DescriptionSessionConfiguration;
  let stored: unknown = null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { stored = JSON.parse(raw); } catch { localStorage.removeItem(STORAGE_KEY); }
  }
  if (isStoredDescriptionSession(stored, { categoryByExerciseId, validCategoryIds, expected })) {
    session = stored;
  } else if (expected.roundType === 'retry') {
    showError();
    return;
  } else {
    const pool = poolFor(expected);
    if (pool.length === 0) { showError(); return; }
    session = createDescriptionSession(pool, expected, Date.now(), Math.random);
    persist();
  }
  startTimer();
  dispatchProgress({type:'session-started',eventId:`descriptions:${session.sessionId}:started`,sessionId:session.sessionId,mode:'descriptions',sourceId:session.sourceMode==='all'?'all':session.sourceCategoryId!,selectedCount:session.selectedExerciseIds.length,occurredAt:session.startedAt});
  startActiveTime({mode:'descriptions',sessionId:()=>session!.sessionId,eligible:()=>Boolean(session&&session.currentIndex<session.selectedExerciseIds.length&&!session.currentResolvedResult&&!errorView.hidden)});
  render();
}

restoreOrCreate();
