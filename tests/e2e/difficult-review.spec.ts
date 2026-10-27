import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { WORD_STATS_KEY, type WordStatEntry } from '../../src/lib/vocabulary-stats';
import { continuePastMilestone } from './helpers';

const EXAM_KEY = 'medicinsk-svenska.exam-session.v1';

async function grade(page: Page, correct: boolean) {
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: correct ? 'Osasin' : 'En osannut', exact: true }).click();
  await continuePastMilestone(page);
}

test('empty difficult review is explained and is available only on the exam side', async ({ page }) => {
  await page.goto('/tentti/');
  await expect(page.locator('[data-difficult-cta]')).toBeHidden();
  await expect(page.locator('[data-difficult-empty]')).toBeVisible();
  await page.goto('/tentti/harjoitus?mode=difficult&answer=cards&direction=fi-sv&amount=10');
  await expect(page.locator('#error-title')).toHaveText('Vaikeimmat sanat -pakka on tyhjä');
  await expect(page.locator('#error-detail')).toContainText('3 virheen jälkeen');
  await page.goto('/kortit/harjoitus?mode=difficult&answer=cards&direction=fi-sv&amount=10');
  await expect(page.locator('#error-title')).toHaveText('Pakkaa ei löytynyt');
});

test('a third miss adds a card, retries do not count, and three consecutive first attempts clear it', async ({ page }) => {
  await page.goto('/tentti/');
  const id = await page.evaluate(key => {
    const id = (JSON.parse(document.getElementById('cards-data-ids')!.textContent!) as string[])[0]!;
    const now = Date.now();
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, cards: {
      [id]: { attempts: 2, incorrect: 2, correctStreak: 0, lastAttemptAt: now, lastIncorrectAt: now },
    } }));
    return id;
  }, WORD_STATS_KEY);
  const readStreak = () => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).cards[id].firstAttemptCorrectStreak, { key: WORD_STATS_KEY, id });
  await page.reload();
  await expect(page.locator('[data-difficult-cta]')).toBeHidden();
  await page.locator('[data-review-cta]').click();
  await grade(page, false);
  await grade(page, true);
  expect(await readStreak()).toBe(0);
  await page.getByRole('link', { name: 'Takaisin tenttisanastoon', exact: true }).click();
  await expect(page.locator('[data-difficult-count]')).toHaveText('1 sana');
  await page.locator('[data-difficult-cta]').click();
  await expect(page.locator('#session-label')).toHaveText('Vaikeimmat sanat');
  await expect(page.locator('#difficult-progress')).toContainText('0 / 3');
  await grade(page, true);
  await page.getByRole('link', { name: 'Takaisin tenttisanastoon', exact: true }).click();
  await expect(page.locator('[data-review-cta]')).toBeHidden();
  await expect(page.locator('[data-difficult-count]')).toHaveText('1 sana');
  await page.locator('[data-difficult-cta]').click();
  await expect(page.locator('#difficult-progress')).toContainText('1 / 3');
  await grade(page, true);
  await page.getByRole('button', { name: 'Uusi kierros' }).click();
  await page.reload();
  await expect(page.locator('#difficult-progress')).toContainText('2 / 3');
  await grade(page, false);
  await expect(page.locator('#difficult-progress')).toContainText('0 / 3');
  await grade(page, true);
  expect(await readStreak()).toBe(0);

  for (let streak = 1; streak <= 3; streak++) {
    await page.getByRole('button', { name: 'Uusi kierros' }).click();
    await grade(page, true);
    await expect(page.locator('#summary-view')).toBeVisible();
    expect(await readStreak()).toBe(streak);
    if (streak < 3) await expect(page.locator('#review-complete')).toBeHidden();
  }
  await expect(page.locator('#review-complete')).toHaveText('Vaikeimmat sanat -pakka on nyt tyhjä.');
  await expect(page.getByRole('button', { name: 'Uusi kierros' })).toBeHidden();
  await page.reload();
  await expect(page.locator('#summary-view')).toBeVisible();
  expect(await readStreak()).toBe(3);
  await page.getByRole('link', { name: 'Takaisin tenttisanastoon', exact: true }).click();
  await expect(page.locator('[data-difficult-cta]')).toBeHidden();
  await expect(page.locator('[data-difficult-empty]')).toBeVisible();
});

test('difficult review filters the pool, samples the chosen count, remembers the round and fits mobile', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto('/tentti/');
  const eligible = await page.evaluate(key => {
    const ids = (JSON.parse(document.getElementById('cards-data-ids')!.textContent!) as string[]).slice(0, 20);
    const now = Date.now();
    const missed: WordStatEntry = { attempts: 3, incorrect: 3, correctStreak: 0, lastAttemptAt: now, lastIncorrectAt: now };
    const cards: Record<string, WordStatEntry> = Object.fromEntries([...ids, 'mediciner-001', 'tenttisanasto-anatomi-132'].map(id => [id, missed]));
    cards[ids[0]!] = { ...missed, attempts: 2, incorrect: 2 };
    cards[ids[1]!] = { ...missed, attempts: 6, correctStreak: 3, firstAttemptCorrectStreak: 3 };
    cards[ids[2]!] = { ...missed, attempts: 4, correctStreak: 1, firstAttemptCorrectStreak: 1, reviewClearedAt: now };
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, cards }));
    return ids.slice(2);
  }, WORD_STATS_KEY);
  await page.reload();
  await expect(page.locator('[data-difficult-count]')).toHaveText('18 sanaa');
  await page.getByLabel('Ruotsi → suomi').check();
  await page.getByLabel('10', { exact: true }).check();
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  await page.screenshot({ path: 'tmp/difficult-setup-mobile.png', fullPage: true });
  await page.locator('[data-difficult-cta]').click();
  await expect(page.locator('#progress')).toHaveText('0 / 10');
  await expect(page.locator('#front-term')).toHaveAttribute('lang', 'sv');
  const readSelection = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).selectedCardIds as string[], EXAM_KEY);
  const selected = await readSelection();
  expect(new Set(selected).size).toBe(10);
  expect(selected.every(id => eligible.includes(id))).toBe(true);
  expect(selected.some(id => !eligible.slice(0, 10).includes(id))).toBe(true);
  await page.reload();
  await expect(page.locator('#difficult-progress')).toBeVisible();
  expect(await readSelection()).toEqual(selected);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  await page.screenshot({ path: 'tmp/difficult-practice-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Takaisin', exact: true }).click();
  await expect(page.getByLabel('10', { exact: true })).toBeChecked();
  await page.getByLabel('Kaikki', { exact: true }).check();
  await page.locator('[data-difficult-cta]').click();
  await expect(page.locator('#progress')).toHaveText('0 / 18');
  expect(new Set(await readSelection())).toEqual(new Set(eligible));
});
