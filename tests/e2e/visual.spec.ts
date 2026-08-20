import { test } from '@playwright/test';

test('capture required visual QA views', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.screenshot({ path: 'tmp/visual/landing-desktop.png', fullPage: true });
  await page.goto('/kortit/harjoitus?deck=anatomi&direction=fi-sv');
  await page.getByRole('button', { name: /Näytä vastaus/ }).click();
  await page.screenshot({ path: 'tmp/visual/flashcard-desktop.png', fullPage: true });
  await page.goto('/kuvailu');
  await page.screenshot({ path: 'tmp/visual/description-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto('/kortit/harjoitus?deck=avdelningar&direction=sv-fi');
  await page.screenshot({ path: 'tmp/visual/flashcard-mobile.png', fullPage: true });
});
