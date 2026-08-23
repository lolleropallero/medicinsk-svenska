import { buildSessionUrl } from '../lib/session-url';
import type { Direction } from '../types/content';
import type { RequestedAmount, SessionMode } from '../lib/session';

function initializeDeckList() {
const starts = document.querySelectorAll<HTMLAnchorElement>('[data-start]');
const radios = document.querySelectorAll<HTMLInputElement>('input[name="direction"], input[name="amount"]');

function selectedValue(name: string): string | undefined {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
}

function configurationFor(link: HTMLAnchorElement) {
  const mode = (link.dataset.mode ?? 'deck') as SessionMode;
  return {
    sessionId: crypto.randomUUID(),
    mode,
    ...(mode === 'deck' && link.dataset.deck ? { sourceDeckId: link.dataset.deck } : {}),
    direction: (selectedValue('direction') ?? 'fi-sv') as Direction,
    requestedAmount: (selectedValue('amount') === 'all'
      ? 'all'
      : Number(selectedValue('amount') ?? 25)) as RequestedAmount,
  };
}

function updateLinks() {
  starts.forEach((link) => {
    link.href = buildSessionUrl(configurationFor(link));
  });
  const amount = selectedValue('amount') ?? '25';
  const luckyCount = document.querySelector<HTMLElement>('[data-selected-count]');
  if (luckyCount) luckyCount.textContent = amount === 'all' ? 'Kaikki kortit' : `${amount} korttia`;
}

radios.forEach((radio) => radio.addEventListener('change', updateLinks));
starts.forEach((link) => link.addEventListener('click', () => {
  link.href = buildSessionUrl(configurationFor(link));
}));
updateLinks();
}

document.addEventListener('astro:page-load', initializeDeckList);
