import type { ClinicalRequestedAmount } from '../lib/clinical-session';

const STORAGE_KEY = 'medicinsk-svenska.clinical-session.v1';
function initializeClinicalSetup() {
const inputs = [...document.querySelectorAll<HTMLInputElement>('input[name="clinical-amount"]')];
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-clinical-start]')];

function amount(): ClinicalRequestedAmount {
  const value = inputs.find((input) => input.checked)?.value;
  return value === '10' ? 10 : value === 'all' ? 'all' : 5;
}
function updateLinks() {
  for (const link of links) {
    const params = new URLSearchParams({ mode: link.dataset.mode!, amount: String(amount()) });
    if (link.dataset.category) params.set('category', link.dataset.category);
    link.href = `/tilanteet/harjoitus?${params}`;
  }
}
inputs.forEach((input) => input.addEventListener('change', updateLinks));
links.forEach((link) => link.addEventListener('click', () => localStorage.removeItem(STORAGE_KEY)));
updateLinks();
}

document.addEventListener('astro:page-load', initializeClinicalSetup);
