import { buildSessionUrl } from '../lib/session-url';
import type { Direction } from '../types/content';
import type { RequestedAmount, SessionMode, VocabularyAnswerMode } from '../lib/session';
import { WORD_STATS_KEY, clearWordReview, loadWordStats, saveWordStats, selectWeakCardIds, selectDifficultCardIds } from '../lib/vocabulary-stats';
import { loadUiPreferences, saveUiPreferences } from '../lib/progress/ui-preferences';

function initializeDeckList() {
const starts = document.querySelectorAll<HTMLAnchorElement>('[data-start]');
if (!starts.length) return;
const controller = new AbortController();
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

function knownCardIds(): Set<string> {
  const node = document.getElementById('cards-data-ids');
  try {
    return new Set(JSON.parse(node?.textContent ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function reviewWordCount(mode: 'review' | 'difficult'): number {
  const ids = knownCardIds();
  const stats = loadWordStats();
  return mode === 'difficult'
    ? selectDifficultCardIds(stats, ids).length
    : selectWeakCardIds(stats, ids, ids.size).length;
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
  const reset = document.querySelector<HTMLButtonElement>(`[data-clear-review="${mode}"]`);
  if (reset) reset.disabled = count === 0;
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
document.querySelectorAll<HTMLButtonElement>('[data-clear-review]').forEach(button => {
  button.addEventListener('click', () => {
    const mode = button.dataset.clearReview;
    if (mode !== 'review' && mode !== 'difficult') return;
    const label = mode === 'review' ? 'En osannut' : 'Vaikeimmat sanat';
    const explanation = mode === 'review'
      ? 'Kortti palaa pakkaan, jos vastaat siihen uudelleen väärin.'
      : 'Virheiden laskenta alkaa alusta. Kortti palaa pakkaan kolmen uuden virheen jälkeen.';
    if (!confirm(`Tyhjennetäänkö ${label} -pakka? ${explanation} Harjoitteluhistoria säilyy.`)) return;
    const status = document.querySelector<HTMLElement>('[data-review-reset-status]')!;
    const state = clearWordReview(loadWordStats(), knownCardIds(), mode);
    if (!saveWordStats(state)) {
      status.textContent = 'Tyhjennystä ei voitu tallentaa. Tarkista selaimen tallennusasetukset ja yritä uudelleen.';
      return;
    }
    const sessionKey = document.querySelector<HTMLElement>('[data-review-session-key]')?.dataset.reviewSessionKey;
    if (sessionKey) {
      try {
        const saved = JSON.parse(localStorage.getItem(sessionKey) ?? 'null');
        if (saved?.mode === mode) localStorage.removeItem(sessionKey);
      } catch {
        // Review membership has already been saved even if session cleanup is unavailable.
      }
    }
    updateLinks();
    status.textContent = `${label} -pakka tyhjennetty. ${explanation}`;
    status.focus();
  });
});
window.addEventListener('storage', event => {
  if (event.key === WORD_STATS_KEY || event.key === null) updateLinks();
}, { signal: controller.signal });
document.addEventListener('astro:before-swap', () => controller.abort(), { once: true });
updateLinks();
}

document.addEventListener('astro:page-load', initializeDeckList);
