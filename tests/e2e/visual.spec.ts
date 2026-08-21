import { test } from '@playwright/test';
import { openSpecificCard } from './helpers';

test('capture required visual QA views', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.screenshot({ path: 'tmp/visual/landing-desktop.png', fullPage: true });
  await page.goto('/kortit');
  await page.screenshot({ path: 'tmp/visual/decks-desktop.png', fullPage: true });
  await openSpecificCard(page, { id: 'anatomi-024', deckId: 'anatomi' }, 'fi-sv');
  await page.getByRole('button', { name: /Näytä vastaus/ }).click();
  await page.screenshot({ path: 'tmp/visual/noun-irregular-desktop.png', fullPage: true });
  await openSpecificCard(page, { id: 'anatomi-004', deckId: 'anatomi' }, 'sv-fi');
  await page.getByRole('button', { name: /Näytä vastaus/ }).click();
  await page.screenshot({ path: 'tmp/visual/swedish-finnish-desktop.png', fullPage: true });
  await openSpecificCard(page, { id: 'mediciner-096', deckId: 'mediciner' }, 'fi-sv');
  await page.getByRole('button', { name: /Näytä vastaus/ }).click();
  await page.screenshot({ path: 'tmp/visual/verb-forms-desktop.png', fullPage: true });
  await page.goto('/kuvailu');
  await page.screenshot({ path: 'tmp/visual/description-desktop.png', fullPage: true });
  await page.goto('/kortit/harjoitus?mode=deck&deck=avdelningar&direction=fi-sv&amount=10&session=visual-summary');
  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('button', { name: 'Näytä vastaus' }).click();
    await page.getByRole('button', { name: 'Osasin' }).click();
  }
  await page.screenshot({ path: 'tmp/visual/summary-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Uusi kierros' }).click();
  await page.screenshot({ path: 'tmp/visual/new-round-desktop.png', fullPage: true });
  await page.goto('/kortit/harjoitus?mode=deck&deck=missing&direction=fi-sv&amount=10&session=visual-invalid');
  await page.screenshot({ path: 'tmp/visual/invalid-desktop.png', fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await openSpecificCard(page, { id: 'mediciner-095', deckId: 'mediciner' }, 'fi-sv');
  await page.getByRole('button', { name: /Näytä vastaus/ }).click();
  await page.screenshot({ path: 'tmp/visual/adjective-mobile.png', fullPage: true });
  await page.goto('/kortit/harjoitus?mode=deck&deck=missing&direction=fi-sv&amount=10&session=visual-invalid-mobile');
  await page.screenshot({ path: 'tmp/visual/invalid-mobile.png', fullPage: true });

  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.screenshot({ path: 'tmp/visual/landing-mobile.png', fullPage: true });
  await page.goto('/kortit');
  await page.screenshot({ path: 'tmp/visual/decks-mobile.png', fullPage: true });
  await openSpecificCard(page, { id: 'sjukdomar-091', deckId: 'sjukdomar' }, 'sv-fi');
  await page.screenshot({ path: 'tmp/visual/long-compound-mobile.png', fullPage: true });
  await page.goto('/kortit/harjoitus?mode=deck&deck=avdelningar&direction=fi-sv&amount=10&session=visual-waiting');
  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('button', { name: 'Näytä vastaus' }).click();
    await page.getByRole('button', { name: index < 3 ? 'En osannut' : 'Osasin' }).click();
  }
  await page.screenshot({ path: 'tmp/visual/waiting-mobile.png', fullPage: true });
  await page.goto('/kuvailu');
  await page.screenshot({ path: 'tmp/visual/description-mobile.png', fullPage: true });
});
