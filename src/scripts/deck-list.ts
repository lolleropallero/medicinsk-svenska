import { buildSessionUrl } from '../lib/session-url';
import type { Direction } from '../types/content';
import type { RequestedAmount, SessionMode, VocabularyAnswerMode } from '../lib/session';
import { loadWordStats, selectWeakCardIds } from '../lib/vocabulary-stats';
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

function weakWordCount(): number {
  const node = document.getElementById('cards-data-ids');
  if (!node) return 0;
  try {
    const knownCardIds = new Set(JSON.parse(node.textContent ?? '[]') as string[]);
    return selectWeakCardIds(loadWordStats(), knownCardIds, knownCardIds.size).length;
  } catch {
    return 0;
  }
}

function updateReviewCta() {
  const cta = document.querySelector<HTMLAnchorElement>('[data-review-cta]');
  const empty = document.querySelector<HTMLElement>('[data-review-empty]');
  if (!cta || !empty) return;
  const count = weakWordCount();
  cta.hidden = count === 0;
  empty.hidden = count > 0;
  const countLabel = cta.querySelector<HTMLElement>('[data-review-count]');
  if (countLabel) countLabel.textContent = `${count} ${count === 1 ? 'sana' : 'sanaa'}`;
}

function updateLinks() {
  starts.forEach((link) => {
    link.href = buildSessionUrl(configurationFor(link), exercisePath);
  });
  const amount = selectedValue('amount') ?? '25';
  const luckyCount = document.querySelector<HTMLElement>('[data-selected-count]');
  if (luckyCount) luckyCount.textContent = amount === 'all' ? 'Kaikki kortit' : `${amount} korttia`;
  updateReviewCta();
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
