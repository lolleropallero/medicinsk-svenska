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
  updateAnswerDraft,
  type CreateSessionOptions,
  type FlashcardSession,
  type RequestedAmount,
  type SessionMode,
  type SingleVocabularyAnswerMode,
} from '../lib/session';
import { buildSessionUrl, parseSessionRequest } from '../lib/session-url';
import { formatDuration } from '../lib/time';
import { partOfSpeechLabel } from '../lib/grammar';
import type { DeckClient, FlashcardClient } from '../types/content';
import { dispatchProgress } from '../lib/progress/storage';
import { startActiveTime } from '../lib/progress/active-time';
import { showSessionRewards } from '../lib/progress/session-summary';
import { requestFeedback } from '../lib/motion/feedback';
import {
  createMultipleChoiceOptions,
  isWrittenAnswerCorrect,
  normalizeWrittenAnswer,
  resolveMixedExerciseType,
  stableChoiceRandom,
  vocabularyAnswerText,
  vocabularyPromptText,
} from '../lib/vocabulary-exercise';
import { loadWordStats, recordWordAttempt, saveWordStats, selectWeakCards } from '../lib/vocabulary-stats';

const WEAK_REVIEW_POOL_CAP = 60;

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
const flashcardModeTag = byId('flashcard-mode-tag');
const answerArea = byId('answer-area');
const gradeActions = byId('grade-actions');
const correctButton = byId<HTMLButtonElement>('correct');
const missedButton = byId<HTMLButtonElement>('missed');
const choiceExercise = byId('choice-exercise');
const choiceOptions = byId('choice-options');
const choiceFeedback = byId('choice-feedback');
const choiceCorrectAnswer = byId('choice-correct-answer');
const choiceSubmittedAnswer = byId('choice-submitted-answer');
const choiceContinue = byId<HTMLButtonElement>('choice-continue');
const writtenExercise = byId('written-exercise');
const writtenForm = byId<HTMLFormElement>('written-form');
const writtenInput = byId<HTMLInputElement>('written-answer');
const writtenFeedback = byId('written-feedback');
const writtenCorrectAnswer = byId('written-correct-answer');
const writtenSubmittedAnswer = byId('written-submitted-answer');
const writtenContinue = byId<HTMLButtonElement>('written-continue');
const elapsedTime = byId<HTMLTimeElement>('elapsed-time');
const retryCountdown = byId('retry-countdown');
const sessionStatus = elapsedTime.parentElement as HTMLElement;

function showInvalidRequest(reason: 'invalid' | 'empty-review' = 'invalid') {
  sessionView.hidden = true;
  waitingView.hidden = true;
  summaryView.hidden = true;
  errorView.hidden = false;
  sessionStatus.hidden = true;
  byId('session-label').textContent = 'Sanakortit';
  const detail = byId('error-detail');
  if (reason === 'empty-review') {
    byId('error-title').textContent = 'Ei vielä vaikeita sanoja';
    detail.textContent = 'Harjoittele muutama kierros normaalisti tai Sekoitus-tavalla, niin Kertaa vaikeita löytää sinulle sopivat sanat.';
    detail.hidden = false;
  } else {
    byId('error-title').textContent = 'Pakkaa ei löytynyt';
    detail.hidden = true;
  }
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

  let wordStats = loadWordStats();

  function computeSourceCards(mode: SessionMode, sourceDeckId: string | undefined, requestedAmount: RequestedAmount): FlashcardClient[] {
    if (mode === 'lucky') return allCards;
    if (mode === 'review') {
      const limit = requestedAmount === 'all' ? WEAK_REVIEW_POOL_CAP : requestedAmount;
      return selectWeakCards(wordStats, allCards, limit);
    }
    return allCards.filter((card) => card.deckId === sourceDeckId);
  }

  let sourceCards = computeSourceCards(configuration.mode, configuration.sourceDeckId, configuration.requestedAmount);
  if (sourceCards.length === 0) {
    showInvalidRequest(configuration.mode === 'review' ? 'empty-review' : 'invalid');
    return;
  }

  function readStoredSession(): FlashcardSession | null {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (!isStoredSession(parsed, {
        cardDeckById,
        validDeckIds,
        expected: configuration,
      })) return null;
      const restored = parsed as FlashcardSession;
      return {
        ...restored,
        answerMode: restored.answerMode ?? configuration.answerMode,
        answerDraft: restored.answerDraft ?? '',
      };
    } catch {
      return null;
    }
  }

  let session = readStoredSession() ?? createSession(sourceCards, configuration);
  const sourceId = session.mode === 'deck' ? session.sourceDeckId! : session.mode;
  dispatchProgress({ type:'session-started', eventId:`flashcards:${session.sessionId}:started`, sessionId:session.sessionId,
    mode:'flashcards', sourceId, selectedCount:session.selectedCardIds.length, occurredAt:session.startedAt });
  let gradingLocked = false;
  let retryTimer: number | undefined;

  byId('session-label').textContent = session.mode === 'lucky'
    ? 'Kokeilen onneani'
    : session.mode === 'review'
      ? 'Kertaa vaikeita'
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

  function hideExerciseModes() {
    flashcard.hidden = true;
    gradeActions.hidden = true;
    choiceExercise.hidden = true;
    writtenExercise.hidden = true;
  }

  function renderSubmittedAnswer(target: HTMLElement) {
    target.textContent = session.answerDraft ? `Vastauksesi: ${session.answerDraft}` : '';
    target.hidden = !session.answerDraft;
  }

  function renderChoiceExercise(card: FlashcardClient, focus = false) {
    const prompt = vocabularyPromptText(card, session.direction);
    const answer = vocabularyAnswerText(card, session.direction);
    const promptNode = byId('choice-prompt');
    const options = createMultipleChoiceOptions(
      card,
      allCards,
      session.direction,
      stableChoiceRandom(session.sessionId, card.id, session.attemptCountByCard[card.id] ?? 0),
    );
    if (options.length !== 4) {
      showInvalidRequest();
      return;
    }

    hideExerciseModes();
    choiceExercise.hidden = false;
    promptNode.textContent = prompt;
    promptNode.lang = session.direction === 'fi-sv' ? 'fi' : 'sv';
    choiceOptions.replaceChildren(...options.map((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.choiceAnswer = option.label;
      button.dataset.choiceCorrect = String(option.correct);
      button.disabled = session.revealed;
      if (session.revealed && option.correct) button.dataset.result = 'correct';
      if (
        session.revealed &&
        !option.correct &&
        normalizeWrittenAnswer(option.label) === normalizeWrittenAnswer(session.answerDraft)
      ) button.dataset.result = 'incorrect';

      const marker = document.createElement('span');
      marker.className = 'choice-index';
      marker.textContent = String(index + 1);
      const label = document.createElement('span');
      label.className = 'choice-label';
      label.lang = session.direction === 'fi-sv' ? 'sv' : 'fi';
      label.textContent = option.label;
      button.append(marker, label);
      return button;
    }));
    choiceCorrectAnswer.textContent = answer;
    choiceCorrectAnswer.lang = session.direction === 'fi-sv' ? 'sv' : 'fi';
    renderSubmittedAnswer(choiceSubmittedAnswer);
    choiceFeedback.hidden = !session.revealed;
    choiceContinue.hidden = !session.revealed;
    if (focus) {
      if (session.revealed) choiceContinue.focus();
      else choiceOptions.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }

  function renderWrittenExercise(card: FlashcardClient, focus = false) {
    const promptNode = byId('written-prompt');
    promptNode.textContent = vocabularyPromptText(card, session.direction);
    promptNode.lang = session.direction === 'fi-sv' ? 'fi' : 'sv';
    hideExerciseModes();
    writtenExercise.hidden = false;
    writtenInput.value = session.answerDraft;
    writtenForm.hidden = session.revealed;
    writtenFeedback.hidden = !session.revealed;
    writtenCorrectAnswer.textContent = vocabularyAnswerText(card, session.direction);
    writtenCorrectAnswer.lang = session.direction === 'fi-sv' ? 'sv' : 'fi';
    renderSubmittedAnswer(writtenSubmittedAnswer);
    writtenContinue.hidden = !session.revealed;
    if (focus) (session.revealed ? writtenContinue : writtenInput).focus();
  }

  function effectiveExerciseType(card: FlashcardClient): SingleVocabularyAnswerMode {
    return session.answerMode === 'mixed' ? resolveMixedExerciseType(session.sessionId, card.id) : session.answerMode;
  }

  function revealIncorrect(answer: string) {
    if (gradingLocked || !session.currentCardId || session.revealed) return;
    session = revealCurrentCard(updateAnswerDraft(session, answer));
    persist();
    render({ focus: true });
    requestFeedback('incorrect', sessionView);
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
    const exerciseType = effectiveExerciseType(card);
    clearRetryTimer();
    sessionView.hidden = false;
    waitingView.hidden = true;
    summaryView.hidden = true;
    if (exerciseType === 'choice') {
      renderChoiceExercise(card, options.focus);
      return;
    }
    if (exerciseType === 'written') {
      renderWrittenExercise(card, options.focus);
      return;
    }
    hideExerciseModes();
    flashcard.hidden = false;
    flashcardModeTag.hidden = session.answerMode !== 'mixed';
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

  function grade(correct: boolean, options: { playOutcome?: boolean } = {}) {
    if (gradingLocked || !session.revealed || !session.currentCardId) return;
    const completedId = session.currentCardId;
    const completedCard = cardById.get(completedId);
    const completedExerciseType = completedCard ? effectiveExerciseType(completedCard) : session.answerMode;
    const priorAttempts = session.attemptCountByCard[completedId] ?? 0;
    const now = Date.now();
    gradingLocked = true;
    if (options.playOutcome ?? true) requestFeedback(correct ? 'correct' : 'incorrect', sessionView);
    correctButton.disabled = true;
    missedButton.disabled = true;
    choiceContinue.disabled = true;
    writtenContinue.disabled = true;
    session = gradeCurrentCard(session, correct, now);
    wordStats = recordWordAttempt(wordStats, completedId, correct, now);
    saveWordStats(wordStats);
    if (correct) dispatchProgress({type:'item-completed',eventId:`flashcards:${session.sessionId}:item:${completedId}`,sessionId:session.sessionId,
      mode:'flashcards',itemId:completedId,sourceId,occurredAt:now,firstAttemptCorrect:priorAttempts===0,hadMisses:priorAttempts>0,resolution:'mastered'});
    persist();
    render({ focus: true });
    requestFeedback('item-change', completedExerciseType === 'cards' ? flashcard : sessionView, null);
    correctButton.disabled = false;
    missedButton.disabled = false;
    choiceContinue.disabled = false;
    writtenContinue.disabled = false;
    gradingLocked = false;
  }

  function startNewRound() {
    const sessionId = crypto.randomUUID();
    if (session.mode === 'review') {
      const freshWeakCards = computeSourceCards('review', undefined, session.requestedAmount);
      if (freshWeakCards.length > 0) sourceCards = freshWeakCards;
    }
    session = createNewRoundSession(sourceCards, session, sessionId, Date.now(), Math.random);
    configuration = {
      sessionId,
      mode: session.mode,
      answerMode: session.answerMode,
      ...(session.mode === 'deck' && session.sourceDeckId ? { sourceDeckId: session.sourceDeckId } : {}),
      direction: session.direction,
      requestedAmount: session.requestedAmount,
    };
    history.replaceState(null, '', buildSessionUrl(configuration, location.pathname));
    persist();
    dispatchProgress({ type:'session-started', eventId:`flashcards:${session.sessionId}:started`, sessionId:session.sessionId,
      mode:'flashcards', sourceId:session.mode==='deck'?session.sourceDeckId!:session.mode, selectedCount:session.selectedCardIds.length, occurredAt:session.startedAt });
    render({ focus: true });
  }

  flashcard.addEventListener('click', reveal);
  correctButton.addEventListener('click', () => grade(true));
  missedButton.addEventListener('click', () => grade(false));
  choiceOptions.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-choice-answer]');
    if (!button || session.revealed) return;
    const answer = button.dataset.choiceAnswer ?? '';
    if (button.dataset.choiceCorrect === 'true') {
      session = revealCurrentCard(updateAnswerDraft(session, answer));
      grade(true);
    } else {
      revealIncorrect(answer);
    }
  });
  choiceContinue.addEventListener('click', () => grade(false, { playOutcome: false }));
  writtenForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!session.currentCardId || session.revealed) return;
    const card = cardById.get(session.currentCardId);
    if (!card) return;
    const answer = writtenInput.value;
    session = updateAnswerDraft(session, answer);
    if (isWrittenAnswerCorrect(card, session.direction, answer)) {
      session = revealCurrentCard(session);
      grade(true);
    } else {
      revealIncorrect(answer);
    }
  });
  writtenInput.addEventListener('input', () => {
    const currentCard = session.currentCardId ? cardById.get(session.currentCardId) : undefined;
    if (!currentCard || effectiveExerciseType(currentCard) !== 'written' || session.revealed) return;
    session = updateAnswerDraft(session, writtenInput.value);
    persist();
  });
  writtenContinue.addEventListener('click', () => grade(false, { playOutcome: false }));
  byId<HTMLButtonElement>('new-round').addEventListener('click', startNewRound);
  document.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const currentCard = session.currentCardId ? cardById.get(session.currentCardId) : undefined;
    const exerciseType = currentCard ? effectiveExerciseType(currentCard) : session.answerMode;
    if (exerciseType === 'choice' && !session.revealed && /^[1-4]$/u.test(event.key)) {
      choiceOptions.querySelectorAll<HTMLButtonElement>('button')[Number(event.key) - 1]?.click();
    }
    if (exerciseType === 'cards' && event.key === '1' && session.revealed) grade(true);
    if (exerciseType === 'cards' && event.key === '2' && session.revealed) grade(false);
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
