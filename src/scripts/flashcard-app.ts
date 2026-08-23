import {
  advanceSession,
  cardSides,
  createNewRoundSession,
  createSession,
  gradeCurrentCard,
  isSessionComplete,
  isStoredSession,
  nextRetryAt,
  revealCurrentCard,
  summarizeSession,
  type CreateSessionOptions,
  type FlashcardSession,
} from '../lib/session';
import { buildSessionUrl, parseSessionRequest } from '../lib/session-url';
import { formatDuration } from '../lib/time';
import { partOfSpeechLabel } from '../lib/grammar';
import type { DeckClient, FlashcardClient } from '../types/content';
import { dispatchProgress } from '../lib/progress/storage';
import { startActiveTime } from '../lib/progress/active-time';
import { showSessionRewards } from '../lib/progress/session-summary';
import { requestFeedback } from '../lib/motion/feedback';

function initializeFlashcardApp() {
if (!document.getElementById('cards-data')) return;
const controller = new AbortController();
const STORAGE_KEY = 'medicinsk-svenska.flashcard-session.v1';
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const allCards = JSON.parse(byId<HTMLScriptElement>('cards-data').textContent ?? '[]') as FlashcardClient[];
const allDecks = JSON.parse(byId<HTMLScriptElement>('decks-data').textContent ?? '[]') as DeckClient[];
const cardById = new Map(allCards.map((card) => [card.id, card]));
const cardDeckById = new Map(allCards.map((card) => [card.id, card.deckId]));
const validDeckIds = new Set(allDecks.map((deck) => deck.id));

const sessionView = byId('session-view');
const waitingView = byId('waiting-view');
const summaryView = byId('summary-view');
const errorView = byId('error-view');
const flashcard = byId<HTMLButtonElement>('flashcard');
const answerArea = byId('answer-area');
const gradeActions = byId('grade-actions');
const correctButton = byId<HTMLButtonElement>('correct');
const missedButton = byId<HTMLButtonElement>('missed');
const elapsedTime = byId<HTMLTimeElement>('elapsed-time');
const retryCountdown = byId('retry-countdown');
const sessionStatus = elapsedTime.parentElement as HTMLElement;

function showInvalidRequest() {
  sessionView.hidden = true;
  waitingView.hidden = true;
  summaryView.hidden = true;
  errorView.hidden = false;
  sessionStatus.hidden = true;
  byId('session-label').textContent = 'Sanakortit';
  byId('error-title').focus();
}

function startApp() {
  const parsedRequest = parseSessionRequest(location.search, validDeckIds);
  if (!parsedRequest.ok) {
    showInvalidRequest();
    return;
  }

  let configuration: CreateSessionOptions;
  if (parsedRequest.value.sessionId) {
    configuration = parsedRequest.value as CreateSessionOptions;
  } else {
    configuration = { ...parsedRequest.value, sessionId: crypto.randomUUID() };
    history.replaceState(null, '', buildSessionUrl(configuration, location.pathname));
  }

  const sourceCards = configuration.mode === 'lucky'
    ? allCards
    : allCards.filter((card) => card.deckId === configuration.sourceDeckId);
  if (sourceCards.length === 0) {
    showInvalidRequest();
    return;
  }

  function readStoredSession(): FlashcardSession | null {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      return isStoredSession(parsed, {
        cardDeckById,
        validDeckIds,
        expected: configuration,
      }) ? parsed : null;
    } catch {
      return null;
    }
  }

  let session = readStoredSession() ?? createSession(sourceCards, configuration);
  const sourceId = session.mode === 'lucky' ? 'lucky' : session.sourceDeckId!;
  dispatchProgress({ type:'session-started', eventId:`flashcards:${session.sessionId}:started`, sessionId:session.sessionId,
    mode:'flashcards', sourceId, selectedCount:session.selectedCardIds.length, occurredAt:session.startedAt });
  let gradingLocked = false;
  let retryTimer: number | undefined;

  byId('session-label').textContent = session.mode === 'lucky'
    ? 'Kokeilen onneani'
    : allDecks.find((deck) => deck.id === session.sourceDeckId)?.nameFi ?? 'Sanakortit';

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); // NOSONAR: validated same-origin session state, never interpreted as markup.
    } catch {
      // The session remains usable when storage is unavailable.
    }
  }

  function updateClocks(now = Date.now()) {
    const elapsedMilliseconds = now - session.startedAt;
    const elapsed = formatDuration(elapsedMilliseconds);
    elapsedTime.textContent = elapsed;
    elapsedTime.dateTime = `PT${Math.max(0, Math.floor(elapsedMilliseconds / 1000))}S`;
    elapsedTime.setAttribute('aria-label', `Kulunut aika ${elapsed}`);

    const dueAt = nextRetryAt(session);
    if (dueAt !== null) {
      const countdown = formatDuration(dueAt - now, 'ceil');
      retryCountdown.textContent = countdown;
      retryCountdown.setAttribute('aria-label', `Seuraava kertaus ${countdown}`);
    }
  }

  function clearRetryTimer() {
    if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    retryTimer = undefined;
  }

  function scheduleWaitingRetry(now: number) {
    clearRetryTimer();
    const dueAt = nextRetryAt(session);
    if (dueAt === null) return;
    retryTimer = window.setTimeout(() => {
      session = advanceSession(session, Date.now());
      persist();
      render({ focus: true });
    }, Math.max(0, dueAt - now));
  }

  function render(options: { focus?: boolean } = {}) {
    const now = Date.now();
    session = advanceSession(session, now);
    persist();

    const total = session.selectedCardIds.length;
    const mastered = session.masteredCardIds.length;
    byId('progress').textContent = `${mastered} / ${total}`;
    byId('progress-bar').style.width = `${(mastered / total) * 100}%`;
    updateClocks(now);
    errorView.hidden = true;

    if (isSessionComplete(session)) {
      clearRetryTimer();
      sessionView.hidden = true;
      waitingView.hidden = true;
      summaryView.hidden = false;
      const summary = summarizeSession(session);
      dispatchProgress({ type:'session-completed', eventId:`flashcards:${session.sessionId}:completed`, sessionId:session.sessionId,
        mode:'flashcards', sourceId, selectedCount:session.selectedCardIds.length, occurredAt:now });
      showSessionRewards('flashcard-rewards',session.sessionId);
      byId('summary-first').textContent = `${summary.firstAttemptCorrect} / ${summary.selectedCount}`;
      byId('summary-missed').textContent = String(summary.totalMissedCount);
      const elapsedMilliseconds = now - session.startedAt;
      const summaryDuration = formatDuration(elapsedMilliseconds);
      const summaryTime = byId<HTMLTimeElement>('summary-time');
      summaryTime.textContent = summaryDuration;
      summaryTime.dateTime = `PT${Math.max(0, Math.floor(elapsedMilliseconds / 1000))}S`;
      if (options.focus) byId('summary-title').focus();
      return;
    }

    if (!session.currentCardId) {
      sessionView.hidden = true;
      summaryView.hidden = true;
      waitingView.hidden = false;
      const retryCount = session.pendingRetries.length;
      byId('waiting-copy').textContent = `${retryCount} ${retryCount === 1 ? 'kortti' : 'korttia'} odottaa kertausta`;
      updateClocks(now);
      scheduleWaitingRetry(now);
      if (options.focus) byId('waiting-copy').focus();
      return;
    }

    const card = cardById.get(session.currentCardId);
    if (!card) {
      showInvalidRequest();
      return;
    }
    const sides = cardSides(card, session.direction);
    clearRetryTimer();
    sessionView.hidden = false;
    waitingView.hidden = true;
    summaryView.hidden = true;
    byId('front-term').textContent = sides.front;
    byId('front-term').lang = session.direction === 'fi-sv' ? 'fi' : 'sv';
    byId('back-term').textContent = sides.back;
    byId('back-term').lang = session.direction === 'fi-sv' ? 'sv' : 'fi';
    flashcard.dataset.direction=session.direction;
    const grammar = [partOfSpeechLabel(card.partOfSpeech), card.inflection].filter(Boolean).join(' · ');
    byId('grammar').textContent = grammar;
    byId('grammar').hidden = !grammar;
    answerArea.hidden = !session.revealed;
    gradeActions.hidden = !session.revealed;
    flashcard.disabled = session.revealed;
    flashcard.setAttribute('aria-label', session.revealed ? 'Vastaus näkyvissä' : 'Näytä vastaus');
    if (options.focus) {
      if (session.revealed) missedButton.focus();
      else flashcard.focus();
    }
  }

  function reveal() {
    if (!session.currentCardId || session.revealed) return;
    session = revealCurrentCard(session);
    persist();
    render({ focus: true });
    requestFeedback('reveal', flashcard);
  }

  function grade(correct: boolean) {
    if (gradingLocked || !session.revealed || !session.currentCardId) return;
    const completedId = session.currentCardId;
    const priorAttempts = session.attemptCountByCard[completedId] ?? 0;
    gradingLocked = true;
    requestFeedback(correct ? 'correct' : 'incorrect', sessionView);
    correctButton.disabled = true;
    missedButton.disabled = true;
    session = gradeCurrentCard(session, correct, Date.now());
    if (correct) dispatchProgress({type:'item-completed',eventId:`flashcards:${session.sessionId}:item:${completedId}`,sessionId:session.sessionId,
      mode:'flashcards',itemId:completedId,sourceId,occurredAt:Date.now(),firstAttemptCorrect:priorAttempts===0,hadMisses:priorAttempts>0,resolution:'mastered'});
    persist();
    render({ focus: true });
    requestFeedback('item-change', flashcard, null);
    correctButton.disabled = false;
    missedButton.disabled = false;
    gradingLocked = false;
  }

  function startNewRound() {
    const sessionId = crypto.randomUUID();
    session = createNewRoundSession(sourceCards, session, sessionId, Date.now(), Math.random);
    configuration = {
      sessionId,
      mode: session.mode,
      ...(session.mode === 'deck' && session.sourceDeckId ? { sourceDeckId: session.sourceDeckId } : {}),
      direction: session.direction,
      requestedAmount: session.requestedAmount,
    };
    history.replaceState(null, '', buildSessionUrl(configuration, location.pathname));
    persist();
    dispatchProgress({ type:'session-started', eventId:`flashcards:${session.sessionId}:started`, sessionId:session.sessionId,
      mode:'flashcards', sourceId:session.mode==='lucky'?'lucky':session.sourceDeckId!, selectedCount:session.selectedCardIds.length, occurredAt:session.startedAt });
    render({ focus: true });
  }

  flashcard.addEventListener('click', reveal);
  correctButton.addEventListener('click', () => grade(true));
  missedButton.addEventListener('click', () => grade(false));
  byId<HTMLButtonElement>('new-round').addEventListener('click', startNewRound);
  document.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === '1' && session.revealed) grade(true);
    if (event.key === '2' && session.revealed) grade(false);
  }, { signal: controller.signal });

  const clockTimer = window.setInterval(() => {
    const wasWaiting = !session.currentCardId && !isSessionComplete(session);
    const advanced = advanceSession(session, Date.now());
    if (advanced !== session) {
      session = advanced;
      persist();
      render({ focus: wasWaiting });
    } else {
      updateClocks();
    }
  }, 1000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  }, { signal: controller.signal });

  const activeTime = startActiveTime({mode:'flashcards',sessionId:()=>session.sessionId,eligible:()=>Boolean(session.currentCardId&&!isSessionComplete(session)&&errorView.hidden)});
  document.addEventListener('astro:before-swap', () => {
    controller.abort();
    window.clearInterval(clockTimer);
    clearRetryTimer();
    activeTime.stop();
  }, { once: true });

  render({ focus: true });
}

startApp();
}

document.addEventListener('astro:page-load', initializeFlashcardApp);
