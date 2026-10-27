import { buildSessionUrl } from '../lib/session-url';
import type { Direction } from '../types/content';
import type { RequestedAmount, SessionMode, VocabularyAnswerMode } from '../lib/session';
import { loadWordStats, selectWeakCardIds, selectDifficultCardIds } from '../lib/vocabulary-stats';
import { loadUiPreferences, saveUiPreferences } from '../lib/progress/ui-preferences';

function initializeDeckList() {
const starts = document.querySelectorAll<HTMLAnchorElement>('[data-start]');
if (!starts.length) return;
const radios = document.querySelectorAll<HTMLInputElement>('input[name="direction"], input[name="answer"], input[name="amount"]');
const exercisePath = document.querySelector<HTMLElement>('[data-exercise-path]')?.dataset.exercisePath ?? '/kortit/harjoitus';
const savedAmount = loadUiPreferences().cardAmount;
if (savedAmount !== undefined) {
  const savedRadio = document.querySelector<HTMLInputElement>(`input[name="amount"][value="${savedAmount}"]`);
  if (savedRadio) savedRadio.checked = true;
}

function selectedValue(name: string): string | undefined {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
}

function selectedAmount(): RequestedAmount {
  const value = selectedValue('amount');
  return value === 'all' ? 'all' : value === '10' ? 10 : value === '50' ? 50 : 25;
}

function configurationFor(link: HTMLAnchorElement) {
  const mode = (link.dataset.mode ?? 'deck') as SessionMode;
  return {
    sessionId: crypto.randomUUID(),
    mode,
    answerMode: (link.dataset.cardsOnly === 'true' ? 'cards' : selectedValue('answer') ?? 'cards') as VocabularyAnswerMode,
    ...(mode === 'deck' && link.dataset.deck ? { sourceDeckId: link.dataset.deck } : {}),
    direction: (selectedValue('direction') ?? 'fi-sv') as Direction,
    requestedAmount: selectedAmount(),
  };
}

function reviewWordCount(mode: 'review' | 'difficult'): number {
  const node = document.getElementById('cards-data-ids');
  if (!node) return 0;
  try {
    const knownCardIds = new Set(JSON.parse(node.textContent ?? '[]') as string[]);
    const stats = loadWordStats();
    return mode === 'difficult'
      ? selectDifficultCardIds(stats, knownCardIds).length
      : selectWeakCardIds(stats, knownCardIds, knownCardIds.size).length;
  } catch {
    return 0;
  }
}

function updateReviewCta(mode: 'review' | 'difficult') {
  const cta = document.querySelector<HTMLAnchorElement>(`[data-${mode}-cta]`);
  const empty = document.querySelector<HTMLElement>(`[data-${mode}-empty]`);
  if (!cta || !empty) return;
  const count = reviewWordCount(mode);
  cta.hidden = count === 0;
  empty.hidden = count > 0;
  const countLabel = cta.querySelector<HTMLElement>(`[data-${mode}-count]`);
  if (countLabel) countLabel.textContent = `${count} ${count === 1 ? 'sana' : 'sanaa'}`;
}

function updateLinks() {
  starts.forEach((link) => {
    link.href = buildSessionUrl(configurationFor(link), exercisePath);
  });
  const amount = selectedValue('amount') ?? '25';
  const luckyCount = document.querySelector<HTMLElement>('[data-selected-count]');
  if (luckyCount) luckyCount.textContent = amount === 'all' ? 'Kaikki kortit' : `${amount} korttia`;
  updateReviewCta('review');
  updateReviewCta('difficult');
}

radios.forEach((radio) => radio.addEventListener('change', () => {
  if (radio.name === 'amount' && radio.checked) {
    saveUiPreferences({ ...loadUiPreferences(), cardAmount: selectedAmount() });
  }
  updateLinks();
}));
starts.forEach((link) => link.addEventListener('click', () => {
  link.href = buildSessionUrl(configurationFor(link), exercisePath);
}));
updateLinks();
}

document.addEventListener('astro:page-load', initializeDeckList);
