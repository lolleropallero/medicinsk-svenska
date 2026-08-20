import { test } from '@playwright/test';

test('capture required visual QA views', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.screenshot({ path: 'tmp/visual/landing-desktop.png', fullPage: true });
  await page.goto('/kortit');
  await page.screenshot({ path: 'tmp/visual/decks-desktop.png', fullPage: true });
  await page.goto('/kortit/harjoitus?deck=anatomi&direction=fi-sv');
  await page.getByRole('button', { name: /Näytä vastaus/ }).click();
  await page.screenshot({ path: 'tmp/visual/flashcard-desktop.png', fullPage: true });
  await page.goto('/kuvailu');
  await page.screenshot({ path: 'tmp/visual/description-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/');
  await page.screenshot({ path: 'tmp/visual/landing-mobile.png', fullPage: true });
  await page.goto('/kortit');
  await page.screenshot({ path: 'tmp/visual/decks-mobile.png', fullPage: true });
  await page.goto('/kortit/harjoitus?deck=avdelningar&direction=sv-fi');
  await page.screenshot({ path: 'tmp/visual/flashcard-mobile.png', fullPage: true });
  await page.goto('/kortit/harjoitus?mode=deck&deck=avdelningar&direction=fi-sv&amount=10&session=visual-waiting');
  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('button', { name: 'Näytä vastaus' }).click();
    await page.getByRole('button', { name: index < 3 ? 'En osannut' : 'Osasin' }).click();
  }
  await page.screenshot({ path: 'tmp/visual/waiting-mobile.png', fullPage: true });
  await page.goto('/kuvailu');
  await page.screenshot({ path: 'tmp/visual/description-mobile.png', fullPage: true });
});
