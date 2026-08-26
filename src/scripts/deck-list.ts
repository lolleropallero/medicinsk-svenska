import { buildSessionUrl } from '../lib/session-url';
import type { Direction } from '../types/content';
import type { RequestedAmount, SessionMode, VocabularyAnswerMode } from '../lib/session';
import { loadWordStats, selectWeakCardIds } from '../lib/vocabulary-stats';

const WEAK_WORD_DISPLAY_CAP = 500;

function initializeDeckList() {
const starts = document.querySelectorAll<HTMLAnchorElement>('[data-start]');
const radios = document.querySelectorAll<HTMLInputElement>('input[name="direction"], input[name="answer"], input[name="amount"]');

function selectedValue(name: string): string | undefined {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
}

function configurationFor(link: HTMLAnchorElement) {
  const mode = (link.dataset.mode ?? 'deck') as SessionMode;
  return {
    sessionId: crypto.randomUUID(),
    mode,
    answerMode: (selectedValue('answer') ?? 'cards') as VocabularyAnswerMode,
    ...(mode === 'deck' && link.dataset.deck ? { sourceDeckId: link.dataset.deck } : {}),
    direction: (selectedValue('direction') ?? 'fi-sv') as Direction,
    requestedAmount: (selectedValue('amount') === 'all'
      ? 'all'
      : Number(selectedValue('amount') ?? 25)) as RequestedAmount,
  };
}

function weakWordCount(): number {
  const node = document.getElementById('cards-data-ids');
  if (!node) return 0;
  try {
    const knownCardIds = new Set(JSON.parse(node.textContent ?? '[]') as string[]);
    return selectWeakCardIds(loadWordStats(), knownCardIds, WEAK_WORD_DISPLAY_CAP).length;
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
    link.href = buildSessionUrl(configurationFor(link));
  });
  const amount = selectedValue('amount') ?? '25';
  const luckyCount = document.querySelector<HTMLElement>('[data-selected-count]');
  if (luckyCount) luckyCount.textContent = amount === 'all' ? 'Kaikki kortit' : `${amount} korttia`;
  updateReviewCta();
}

radios.forEach((radio) => radio.addEventListener('change', updateLinks));
starts.forEach((link) => link.addEventListener('click', () => {
  link.href = buildSessionUrl(configurationFor(link));
}));
updateLinks();
}

document.addEventListener('astro:page-load', initializeDeckList);
