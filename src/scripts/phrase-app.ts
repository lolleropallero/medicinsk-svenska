import {
  advancePhraseSession,
  createNewPhraseRound,
  createPhraseSession,
  gradePhrase,
  isPhraseSessionComplete,
  isStoredPhraseSession,
  phraseNextRetryAt,
  revealPhrase,
  summarizePhraseSession,
  type PhraseSession,
  type PhraseSessionConfiguration,
} from '../lib/phrase-session';
import { buildPhraseSessionUrl, parsePhraseRequest } from '../lib/phrase-url';
import { formatDuration } from '../lib/time';
import type { ClinicalPhraseClient, PhraseCategoryClient } from '../types/content';
import { dispatchProgress } from '../lib/progress/storage';
import { startActiveTime } from '../lib/progress/active-time';
import { showSessionRewards } from '../lib/progress/session-summary';
import { requestFeedback } from '../lib/motion/feedback';

function initializePhraseApp() {
if (!document.getElementById('phrases-data')) return;
const controller = new AbortController();
const STORAGE_KEY = 'medicinsk-svenska.phrase-session.v1';
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const phrases = JSON.parse(byId<HTMLScriptElement>('phrases-data').textContent ?? '[]') as ClinicalPhraseClient[];
const categories = JSON.parse(byId<HTMLScriptElement>('phrase-categories-data').textContent ?? '[]') as PhraseCategoryClient[];
const phraseById = new Map(phrases.map((phrase) => [phrase.id, phrase]));
const categoryByPhraseId = new Map(phrases.map((phrase) => [phrase.id, phrase.categoryId]));
const categoryById = new Map(categories.map((category) => [category.id, category]));
const validCategoryIds = new Set(categories.map((category) => category.id));
const sessionView = byId('phrase-session-view');
const waitingView = byId('phrase-waiting');
const summaryView = byId('phrase-summary');
const errorView = byId('phrase-error');
const card = byId<HTMLButtonElement>('phrase-card');
const answer = byId('phrase-answer');
const actions = byId('phrase-grade-actions');
const missed = byId<HTMLButtonElement>('phrase-missed');
const correct = byId<HTMLButtonElement>('phrase-correct');
const elapsed = byId<HTMLTimeElement>('phrase-elapsed');
const countdown = byId('phrase-retry-countdown');
let retryTimer: number | undefined;

function showError() {
  sessionView.hidden = true;
  waitingView.hidden = true;
  summaryView.hidden = true;
  errorView.hidden = false;
  elapsed.parentElement!.hidden = true;
  byId('phrase-session-label').textContent = 'Vastaanottofraasit';
  byId('phrase-error-title').focus();
}

function startApp() {
  const parsed = parsePhraseRequest(location.search, validCategoryIds);
  if (!parsed.ok) return showError();
  let configuration: PhraseSessionConfiguration = parsed.value.sessionId
    ? parsed.value as PhraseSessionConfiguration
    : { ...parsed.value, sessionId: crypto.randomUUID() };
  if (!parsed.value.sessionId) {
    localStorage.removeItem(STORAGE_KEY);
    history.replaceState(null, '', buildPhraseSessionUrl(configuration, location.pathname));
  }
  const pool = configuration.mode === 'category'
    ? phrases.filter((phrase) => phrase.categoryId === configuration.sourceCategoryId)
    : phrases;
  if (!pool.length) return showError();

  function readStored(): { kind: 'missing' } | { kind: 'valid'; session: PhraseSession } | { kind: 'invalid' } {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return { kind: 'missing' };
      const value: unknown = JSON.parse(raw);
      return isStoredPhraseSession(value, { categoryByPhraseId, validCategoryIds, expected: configuration })
        ? { kind: 'valid', session: value } : { kind: 'invalid' };
    } catch { return { kind: 'invalid' }; }
  }
  const stored = readStored();
  if (stored.kind === 'invalid') return showError();
  let session = stored.kind === 'valid' ? stored.session : createPhraseSession(pool, configuration);
  const sourceId=session.mode==='all'?'all':session.sourceCategoryId!;
  dispatchProgress({type:'session-started',eventId:`phrases:${session.sessionId}:started`,sessionId:session.sessionId,mode:'phrases',sourceId,selectedCount:session.selectedPhraseIds.length,occurredAt:session.startedAt});
  let grading = false;
  byId('phrase-session-label').textContent = session.mode === 'all'
    ? 'Kaikki fraasit' : categoryById.get(session.sourceCategoryId ?? '')?.nameFi ?? 'Vastaanottofraasit';

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch { /* NOSONAR: validated same-origin session state, never interpreted as markup. */ }
  }
  function updateClocks(now = Date.now()) {
    const milliseconds = Math.max(0, now - session.startedAt);
    const value = formatDuration(milliseconds);
    elapsed.textContent = value;
    elapsed.dateTime = `PT${Math.floor(milliseconds / 1000)}S`;
    elapsed.setAttribute('aria-label', `Kulunut aika ${value}`);
    const dueAt = phraseNextRetryAt(session);
    if (dueAt !== null) {
      const value = formatDuration(dueAt - now, 'ceil');
      countdown.textContent = value;
      countdown.setAttribute('aria-label', `Seuraava kertaus ${value}`);
    }
  }
  function clearRetryTimer() {
    if (retryTimer !== undefined) clearTimeout(retryTimer);
    retryTimer = undefined;
  }
  function scheduleRetry(now: number) {
    clearRetryTimer();
    const dueAt = phraseNextRetryAt(session);
    if (dueAt === null) return;
    retryTimer = window.setTimeout(() => {
      session = advancePhraseSession(session, Date.now());
      persist();
      render(true);
    }, Math.max(0, dueAt - now));
  }
  function render(focus = false) {
    const now = Date.now();
    session = advancePhraseSession(session, now);
    persist();
    const total = session.selectedPhraseIds.length;
    const mastered = session.masteredPhraseIds.length;
    byId('phrase-progress').textContent = `${mastered} / ${total}`;
    byId('phrase-progress-bar').style.width = `${total ? (mastered / total) * 100 : 0}%`;
    updateClocks(now);
    errorView.hidden = true;
    if (isPhraseSessionComplete(session)) {
      clearRetryTimer();
      sessionView.hidden = true; waitingView.hidden = true; summaryView.hidden = false;
      const summary = summarizePhraseSession(session);
      dispatchProgress({type:'session-completed',eventId:`phrases:${session.sessionId}:completed`,sessionId:session.sessionId,mode:'phrases',sourceId,selectedCount:session.selectedPhraseIds.length,occurredAt:now});
      showSessionRewards('phrase-rewards',session.sessionId);
      byId('phrase-summary-first').textContent = `${summary.firstAttemptCorrect} / ${summary.selectedCount}`;
      byId('phrase-summary-missed').textContent = String(summary.totalMissedCount);
      byId<HTMLTimeElement>('phrase-summary-time').textContent = formatDuration(now - session.startedAt);
      if (focus) byId('phrase-summary-title').focus();
      return;
    }
    if (!session.currentPhraseId) {
      sessionView.hidden = true; summaryView.hidden = true; waitingView.hidden = false;
      const count = session.pendingRetries.length;
      byId('phrase-waiting-copy').textContent = `${count} ${count === 1 ? 'fraasi' : 'fraasia'} odottaa kertausta`;
      scheduleRetry(now);
      if (focus) byId('phrase-waiting-copy').focus();
      return;
    }
    const phrase = phraseById.get(session.currentPhraseId);
    if (!phrase) return showError();
    clearRetryTimer();
    sessionView.hidden = false; waitingView.hidden = true; summaryView.hidden = true;
    byId('phrase-fi').textContent = phrase.fi;
    byId('phrase-sv').textContent = phrase.sv;
    answer.hidden = !session.revealed;
    actions.hidden = !session.revealed;
    card.disabled = session.revealed;
    card.setAttribute('aria-label', session.revealed ? 'Vastaus näkyvissä' : 'Näytä vastaus');
    if (focus) (session.revealed ? missed : card).focus();
  }
  function reveal() {
    const next = revealPhrase(session);
    if (next === session) return;
    session = next; persist(); render(true); requestFeedback('reveal', card);
  }
  function grade(value: boolean) {
    if (grading || !session.revealed) return;
    requestFeedback(value ? 'correct' : 'incorrect', sessionView);
    const completedId=session.currentPhraseId!;const priorAttempts=session.attemptCountByPhrase[completedId]??0;
    grading = true; missed.disabled = true; correct.disabled = true;
    session = gradePhrase(session, value, Date.now());
    if(value)dispatchProgress({type:'item-completed',eventId:`phrases:${session.sessionId}:item:${completedId}`,sessionId:session.sessionId,mode:'phrases',itemId:completedId,sourceId,occurredAt:Date.now(),firstAttemptCorrect:priorAttempts===0,hadMisses:priorAttempts>0,resolution:'mastered'});
    persist(); render(true); requestFeedback('item-change', card, null);
    missed.disabled = false; correct.disabled = false; grading = false;
  }
  function newRound() {
    const sessionId = crypto.randomUUID();
    session = createNewPhraseRound(pool, session, sessionId, Date.now(), Math.random);
    configuration = {
      sessionId, mode: session.mode,
      ...(session.mode === 'category' && session.sourceCategoryId ? { sourceCategoryId: session.sourceCategoryId } : {}),
      requestedAmount: session.requestedAmount,
    };
    history.replaceState(null, '', buildPhraseSessionUrl(configuration, location.pathname));
    persist(); render(true);
    dispatchProgress({type:'session-started',eventId:`phrases:${session.sessionId}:started`,sessionId:session.sessionId,mode:'phrases',sourceId:session.mode==='all'?'all':session.sourceCategoryId!,selectedCount:session.selectedPhraseIds.length,occurredAt:session.startedAt});
  }
  card.addEventListener('click', reveal);
  missed.addEventListener('click', () => grade(false));
  correct.addEventListener('click', () => grade(true));
  byId<HTMLButtonElement>('phrase-new-round').addEventListener('click', newRound);
  const clockTimer = window.setInterval(() => {
    const waiting = !session.currentPhraseId && !isPhraseSessionComplete(session);
    const advanced = advancePhraseSession(session, Date.now());
    if (advanced !== session) { session = advanced; persist(); render(waiting); }
    else updateClocks();
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); }, { signal: controller.signal });
  const activeTime = startActiveTime({mode:'phrases',sessionId:()=>session.sessionId,eligible:()=>Boolean(session.currentPhraseId&&!isPhraseSessionComplete(session)&&errorView.hidden)});
  document.addEventListener('astro:before-swap', () => {
    controller.abort();
    window.clearInterval(clockTimer);
    clearRetryTimer();
    activeTime.stop();
  }, { once: true });
  render(true);
}

startApp();
}

document.addEventListener('astro:page-load', initializePhraseApp);
