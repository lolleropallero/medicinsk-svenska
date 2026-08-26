import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  answerCurrentVocabularyCard,
  continuePastMilestone,
  currentExerciseSection,
  deckCardIds,
  readWordStats,
  seedWordStats,
} from './helpers';

const FLASHCARD_STORAGE = 'medicinsk-svenska.flashcard-session.v1';

test('Kertaa vaikeita stays hidden with a graceful message for a brand-new learner', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/kortit/');
  await expect(page.locator('[data-review-cta]')).toBeHidden();
  await expect(page.locator('[data-review-empty]')).toBeVisible();
  await expect(page.locator('[data-review-empty]')).toContainText('Harjoittele');
});

test('direct navigation to an empty review session fails gracefully instead of fabricating cards', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/kortit/harjoitus?mode=review&answer=mixed&direction=fi-sv&amount=25&session=empty-review-1');
  await expect(page.getByRole('heading', { name: 'Ei vielä vaikeita sanoja' })).toBeFocused();
  await expect(page.getByText('löytää sinulle sopivat sanat')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), FLASHCARD_STORAGE)).toBeNull();
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});

test('Kertaa vaikeita appears with an accurate count once words have demonstrably been missed', async ({ page }) => {
  await page.goto('/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=seed-ids');
  const ids = await deckCardIds(page, 'anatomi', 3);
  await seedWordStats(page, {
    [ids[0]!]: { attempts: 3, incorrect: 2, correctStreak: 0, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now() },
    [ids[1]!]: { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now() },
  });
  await page.goto('/kortit/');
  const cta = page.locator('[data-review-cta]');
  await expect(cta).toBeVisible();
  await expect(page.locator('[data-review-empty]')).toBeHidden();
  await expect(cta).toContainText('2 sanaa');
  await expect(cta).toHaveAttribute('href', /mode=review/);
});

test('starting Kertaa vaikeita creates a session containing exactly the weak words', async ({ page }) => {
  await page.goto('/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=seed-ids-2');
  const ids = await deckCardIds(page, 'anatomi', 4);
  const weakIds = [ids[0]!, ids[1]!, ids[2]!];
  await seedWordStats(page, Object.fromEntries(weakIds.map((id, index) => [
    id, { attempts: 3, incorrect: 1 + index, correctStreak: 0, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now() },
  ])));
  await page.goto('/kortit/');
  await page.getByRole('group', { name: 'Korttien määrä' }).locator('label').filter({ hasText: 'Kaikki' }).click();
  await page.locator('[data-review-cta]').click();
  await expect(page).toHaveURL(/mode=review/);
  await expect(page.locator('#progress')).toHaveText('0 / 3');
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FLASHCARD_STORAGE);
  expect(state.mode).toBe('review');
  expect(new Set(state.selectedCardIds)).toEqual(new Set(weakIds));
  expect(state.selectedCardIds).not.toContain(ids[3]);
});

test('a word that has graduated (five correct answers in a row) no longer counts as weak', async ({ page }) => {
  await page.goto('/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=seed-ids-3');
  const ids = await deckCardIds(page, 'anatomi', 2);
  await seedWordStats(page, {
    [ids[0]!]: { attempts: 6, incorrect: 1, correctStreak: 5, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now() - 1_000 },
    [ids[1]!]: { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now() },
  });
  await page.goto('/kortit/');
  const cta = page.locator('[data-review-cta]');
  await expect(cta).toBeVisible();
  await expect(cta).toContainText('1 sana');
});

test('grading inside a Kertaa vaikeita session records real learner performance for future ranking', async ({ page }) => {
  await page.goto('/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=seed-ids-4');
  const ids = await deckCardIds(page, 'anatomi', 2);
  await seedWordStats(page, {
    [ids[0]!]: { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now() },
    [ids[1]!]: { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now() },
  });
  await page.goto('/kortit/harjoitus?mode=review&answer=cards&direction=fi-sv&amount=25&session=review-record-1');
  await currentExerciseSection(page);
  const before = await readWordStats(page);
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FLASHCARD_STORAGE);
  const gradedId = state.currentCardId as string;
  await answerCurrentVocabularyCard(page, true);
  await continuePastMilestone(page);
  const after = await readWordStats(page);
  expect(after!.cards[gradedId]!.attempts).toBe((before!.cards[gradedId]?.attempts ?? 0) + 1);
  expect(after!.cards[gradedId]!.correctStreak).toBe((before!.cards[gradedId]?.correctStreak ?? 0) + 1);
});

test('retry and mastery mechanics inside a review session are identical to the existing session engine', async ({ page }) => {
  await page.goto('/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=seed-ids-5');
  const ids = await deckCardIds(page, 'anatomi', 3);
  await seedWordStats(page, Object.fromEntries(ids.map((id) => [
    id, { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now() },
  ])));
  await page.goto('/kortit/harjoitus?mode=review&answer=cards&direction=fi-sv&amount=25&session=review-retry-1');
  await answerCurrentVocabularyCard(page, false);
  await continuePastMilestone(page);
  const missed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FLASHCARD_STORAGE);
  expect(missed.pendingRetries).toHaveLength(1);
  expect(missed.totalMissedCount).toBe(1);

  // Two more cards remain unseen, then the missed card is replayed immediately once that queue is exhausted.
  for (let i = 0; i < 3; i += 1) {
    await answerCurrentVocabularyCard(page, true);
    await continuePastMilestone(page);
  }
  await expect(page.getByRole('heading', { name: 'Valmis', exact: true })).toBeVisible();
  const completed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FLASHCARD_STORAGE);
  expect(completed.masteredCardIds).toHaveLength(3);
  expect(completed.totalMissedCount).toBe(1);
});

test('Kertaa vaikeita may combine with Sekoitus and respects the chosen answer mode', async ({ page }) => {
  await page.goto('/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=seed-ids-6');
  const ids = await deckCardIds(page, 'anatomi', 5);
  await seedWordStats(page, Object.fromEntries(ids.map((id) => [
    id, { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now() },
  ])));
  await page.goto('/kortit/');
  await page.getByRole('group', { name: 'Harjoitustapa' }).locator('label').filter({ hasText: 'Sekoitus' }).click();
  await page.locator('[data-review-cta]').click();
  await expect(page).toHaveURL(/mode=review&answer=mixed/);
  await expect(page.locator('#progress')).toHaveText('0 / 5');
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FLASHCARD_STORAGE);
  expect(state.mode).toBe('review');
  expect(state.answerMode).toBe('mixed');
});

test('Kertaa vaikeita fits narrow mobile viewports without accessibility violations', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=seed-ids-7');
  const ids = await deckCardIds(page, 'anatomi', 2);
  await seedWordStats(page, Object.fromEntries(ids.map((id) => [
    id, { attempts: 2, incorrect: 1, correctStreak: 0, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now() },
  ])));
  await page.goto('/kortit/');
  await expect(page.locator('[data-review-cta]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);

  await page.locator('[data-review-cta]').click();
  await expect(page).toHaveURL(/mode=review/);
  await expect(page.locator('#progress')).toHaveText('0 / 2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});
