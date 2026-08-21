import type { DescriptionRequestedAmount } from '../lib/description-session';

const STORAGE_KEY = 'medicinsk-svenska.description-session.v1';
const amountInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="description-amount"]')];
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-description-start]')];

function selectedAmount(): DescriptionRequestedAmount {
  const value = amountInputs.find((input) => input.checked)?.value;
  return value === '25' ? 25 : value === '50' ? 50 : value === 'all' ? 'all' : 10;
}

function updateLinks() {
  const amount = selectedAmount();
  for (const link of links) {
    const params = new URLSearchParams({ mode: link.dataset.mode!, amount: String(amount) });
    if (link.dataset.category) params.set('category', link.dataset.category);
    link.href = `/kuvailu/harjoitus?${params.toString()}`;
  }
}

amountInputs.forEach((input) => input.addEventListener('change', updateLinks));
links.forEach((link) => link.addEventListener('click', () => localStorage.removeItem(STORAGE_KEY)));
updateLinks();
