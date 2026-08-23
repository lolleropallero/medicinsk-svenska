import type { PhraseRequestedAmount } from '../lib/phrase-session';

const STORAGE_KEY = 'medicinsk-svenska.phrase-session.v1';
function initializePhraseSetup() {
const inputs = [...document.querySelectorAll<HTMLInputElement>('input[name="phrase-amount"]')];
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-phrase-start]')];

function amount(): PhraseRequestedAmount {
  const value = inputs.find((input) => input.checked)?.value;
  return value === '25' ? 25 : value === 'all' ? 'all' : 10;
}
function updateLinks() {
  for (const link of links) {
    const params = new URLSearchParams({ mode: link.dataset.mode!, amount: String(amount()) });
    if (link.dataset.category) params.set('category', link.dataset.category);
    link.href = `/fraasit/harjoitus?${params}`;
  }
}
inputs.forEach((input) => input.addEventListener('change', updateLinks));
links.forEach((link) => link.addEventListener('click', () => localStorage.removeItem(STORAGE_KEY)));
updateLinks();
}

document.addEventListener('astro:page-load', initializePhraseSetup);
