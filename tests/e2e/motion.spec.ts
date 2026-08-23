import { expect, test } from '@playwright/test';
import { openSpecificCard } from './helpers';

test('flashcard feedback shares semantic motion and sound events', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { feedback: string[] }).feedback = [];
    window.addEventListener('app-feedback', (event) => (window as unknown as { feedback: string[] }).feedback.push((event as CustomEvent).detail.effect));
  });
  await openSpecificCard(page, { id: 'anatomi-004', deckId: 'anatomi' }, 'fi-sv');
  const prompt = await page.locator('#front-term').textContent();
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await expect(page.locator('#answer-area')).toBeVisible();
  await expect(page.locator('#front-term')).toHaveText(prompt!);
  await expect(page.locator('#flashcard')).toHaveAttribute('data-motion-state', 'reveal');
  await page.getByRole('button', { name: 'En osannut' }).click();
  await expect(page.locator('#session-view')).toHaveAttribute('data-motion-state', 'incorrect');
  await expect(page.locator('#flashcard')).toHaveAttribute('data-motion-state', 'item-change');
  expect(await page.evaluate(() => (window as unknown as { feedback: string[] }).feedback.slice(0, 3))).toEqual(['reveal', 'incorrect', 'item-change']);
});

test('phrase and description use the same reveal and resolution language', async ({ page }) => {
  await page.goto('/fraasit/harjoitus?mode=all&amount=10&session=motion-phrase');
  const cue = await page.locator('#phrase-fi').textContent();
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await expect(page.locator('#phrase-answer')).toBeVisible();
  await expect(page.locator('#phrase-fi')).toHaveText(cue!);
  await expect(page.locator('#phrase-card')).toHaveAttribute('data-motion-state', 'reveal');

  await page.goto('/kuvailu/harjoitus?mode=all&amount=10&session=motion-description&round=initial');
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await expect(page.locator('#description-feedback')).toHaveAttribute('data-result', 'revealed');
  await expect(page.locator('#description-feedback')).toHaveAttribute('data-motion-state', 'reveal');
  await expect(page.locator('#description-feedback')).not.toHaveAttribute('data-motion-state', 'incorrect');
});

test('daily automatic entrance is staged while manual calm and reduced openings are restrained', async ({ page }) => {
  await page.goto('/');
  const dialog = page.locator('#daily-overlay');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('data-daily-entrance', 'automatic');
  await expect(dialog).toHaveAttribute('data-motion-state', 'overlay-open');
  await page.getByRole('button', { name: 'Stäng dagens uppdrag' }).click();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: /Dagens uppdrag/ }).click();
  await expect(dialog).toHaveAttribute('data-daily-entrance', 'manual');
  await expect(dialog).toHaveAttribute('data-motion-mode', 'reduced');
  expect(await dialog.locator('.daily-sheet').evaluate((node) => getComputedStyle(node).transform)).toBe('none');
});
