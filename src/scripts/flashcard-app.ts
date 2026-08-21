import {
  advanceSession,
  cardSides,
  createSession,
  gradeCurrentCard,
  isSessionComplete,
  isStoredSession,
  nextRetryAt,
  parseRequestedAmount,
  revealCurrentCard,
  type FlashcardSession,
  type SessionMode,
} from '../lib/session';
import { partOfSpeechLabel } from '../lib/grammar';
import type { DeckClient, Direction, FlashcardClient } from '../types/content';

const STORAGE_KEY = 'medicinsk-svenska.flashcard-session.v1';
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const allCards = JSON.parse(byId<HTMLScriptElement>('cards-data').textContent ?? '[]') as FlashcardClient[];
const allDecks = JSON.parse(byId<HTMLScriptElement>('decks-data').textContent ?? '[]') as DeckClient[];
const cardById = new Map(allCards.map((card) => [card.id, card]));
const validCardIds = new Set(cardById.keys());
const params = new URLSearchParams(location.search);
const direction: Direction = params.get('direction') === 'sv-fi' ? 'sv-fi' : 'fi-sv';
const mode: SessionMode = params.get('mode') === 'lucky' ? 'lucky' : 'deck';
const deckId = params.get('deck') ?? undefined;
const requestedAmount = parseRequestedAmount(params.get('amount'));

let sessionId = params.get('session');
if (!sessionId) {
  sessionId = crypto.randomUUID();
  params.set('session', sessionId);
  history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
}

const sourceCards = mode === 'lucky' ? allCards : allCards.filter((card) => card.deckId === deckId);

function readStoredSession(): FlashcardSession | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return isStoredSession(parsed, validCardIds) && parsed.sessionId === sessionId ? parsed : null;
  } catch {
    return null;
  }
}

let session =
  readStoredSession() ??
  createSession(sourceCards, {
    sessionId,
    mode,
    ...(deckId ? { sourceDeckId: deckId } : {}),
    direction,
    requestedAmount,
  });
let gradingLocked = false;

const sessionView = byId('session-view');
const waitingView = byId('waiting-view');
const summaryView = byId('summary-view');
const flashcard = byId<HTMLButtonElement>('flashcard');
const answerArea = byId('answer-area');
const gradeActions = byId('grade-actions');
const correctButton = byId<HTMLButtonElement>('correct');
const missedButton = byId<HTMLButtonElement>('missed');

byId('session-label').textContent =
  session.mode === 'lucky'
    ? 'Kokeilen onneani'
    : allDecks.find((deck) => deck.id === session.sourceDeckId)?.nameFi ?? 'Sanakortit';

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // The session remains usable when storage is unavailable.
  }
}

function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function formatCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function updateClocks(now = Date.now()) {
  byId<HTMLTimeElement>('elapsed-time').textContent = formatDuration(now - session.startedAt);
  const dueAt = nextRetryAt(session);
  if (dueAt !== null) byId('retry-countdown').textContent = formatCountdown(dueAt - now);
}

function render(options: { focusCard?: boolean } = {}) {
  session = advanceSession(session, Date.now());
  persist();

  const total = session.selectedCardIds.length;
  const mastered = session.masteredCardIds.length;
  byId('progress').textContent = `${mastered} / ${total}`;
  byId('progress-bar').style.width = total === 0 ? '0%' : `${(mastered / total) * 100}%`;
  updateClocks();

  if (isSessionComplete(session) || total === 0) {
    sessionView.hidden = true;
    waitingView.hidden = true;
    summaryView.hidden = false;
    byId('summary-copy').textContent = `${mastered} / ${total} osattu`;
    byId('summary-details').textContent = `Aika ${formatDuration(Date.now() - session.startedAt)} · En osannut ${session.totalMissedCount} kertaa`;
    summaryView.querySelector<HTMLAnchorElement>('a')?.focus();
    return;
  }

  if (!session.currentCardId) {
    sessionView.hidden = true;
    summaryView.hidden = true;
    waitingView.hidden = false;
    const retryCount = session.pendingRetries.length;
    byId('waiting-copy').textContent = `${retryCount} ${retryCount === 1 ? 'kortti' : 'korttia'} odottaa kertausta`;
    updateClocks();
    return;
  }

  const card = cardById.get(session.currentCardId);
  if (!card) return;
  const sides = cardSides(card, session.direction);
  sessionView.hidden = false;
  waitingView.hidden = true;
  summaryView.hidden = true;
  byId('front-term').textContent = sides.front;
  byId('front-term').lang = session.direction === 'fi-sv' ? 'fi' : 'sv';
  byId('back-term').textContent = sides.back;
  byId('back-term').lang = session.direction === 'fi-sv' ? 'sv' : 'fi';
  const grammar = [partOfSpeechLabel(card.partOfSpeech), card.inflection].filter(Boolean).join(' · ');
  byId('grammar').textContent = grammar;
  byId('grammar').hidden = !grammar;
  answerArea.hidden = !session.revealed;
  gradeActions.hidden = !session.revealed;
  flashcard.disabled = session.revealed;
  flashcard.setAttribute('aria-label', session.revealed ? 'Vastaus näkyvissä' : 'Näytä vastaus');
  if (options.focusCard) flashcard.focus();
}

function reveal() {
  if (!session.currentCardId || session.revealed) return;
  session = revealCurrentCard(session);
  persist();
  render();
  correctButton.focus();
}

function grade(correct: boolean) {
  if (gradingLocked || !session.revealed || !session.currentCardId) return;
  gradingLocked = true;
  correctButton.disabled = true;
  missedButton.disabled = true;
  session = gradeCurrentCard(session, correct, Date.now());
  persist();
  render({ focusCard: true });
  correctButton.disabled = false;
  missedButton.disabled = false;
  gradingLocked = false;
}

flashcard.addEventListener('click', reveal);
correctButton.addEventListener('click', () => grade(true));
missedButton.addEventListener('click', () => grade(false));
document.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.key === '1' && session.revealed) grade(true);
  if (event.key === '2' && session.revealed) grade(false);
});

setInterval(() => {
  const wasWaiting = !session.currentCardId && !isSessionComplete(session);
  const advanced = advanceSession(session, Date.now());
  if (advanced !== session) {
    session = advanced;
    persist();
    render({ focusCard: wasWaiting });
  } else {
    updateClocks();
  }
}, 1000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render({ focusCard: false });
});

render({ focusCard: true });
