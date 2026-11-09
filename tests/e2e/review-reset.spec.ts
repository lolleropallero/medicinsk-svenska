import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { WORD_STATS_KEY, type WordStatsStateV1 } from '../../src/lib/vocabulary-stats';
import type { ProgressStateV1 } from '../../src/lib/progress/types';
import { continuePastMilestone } from './helpers';

const EXAM_KEY = 'medicinsk-svenska.exam-session.v1';
const GENERAL_KEY = 'medicinsk-svenska.flashcard-session.v1';
const PROGRESS_KEY = 'medicinsk-svenska.progress.v1';

async function seed(page: Page) {
  await page.goto('/tentti/');
  const id = await page.evaluate(({ statsKey, generalKey }) => {
    const id = JSON.parse(document.getElementById('cards-data-ids')!.textContent!)[0] as string;
    const now = Date.now();
    const missed = { attempts: 4, incorrect: 3, correctStreak: 1, firstAttemptCorrectStreak: 0, lastAttemptAt: now, lastIncorrectAt: now };
    localStorage.setItem(statsKey, JSON.stringify({ schemaVersion: 1, cards: { [id]: missed, 'mediciner-001': missed } }));
    localStorage.setItem(generalKey, '{"preserve":"general session"}');
    return id;
  }, { statsKey: WORD_STATS_KEY, generalKey: GENERAL_KEY });
  await page.reload();
  return id;
}

const readStats = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as WordStatsStateV1, WORD_STATS_KEY);
const readProgress = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as ProgressStateV1, PROGRESS_KEY);

for (const mode of ['review', 'difficult'] as const) {
  test(`${mode} reset can be cancelled, clears only its pool, survives reload and ends its saved round`, async ({ page, context }) => {
    const id = await seed(page);
    const otherMode = mode === 'review' ? 'difficult' : 'review';
    await page.locator(`[data-${mode}-cta]`).click();
    await expect(page.locator('#progress')).toHaveText('0 / 1');
    const roundUrl = page.url();
    await page.getByRole('link', { name: 'Takaisin', exact: true }).click();
    const before = await readStats(page);
    const sessionBefore = await page.evaluate(key => localStorage.getItem(key), EXAM_KEY);
    const reset = page.locator(`[data-clear-review="${mode}"]`);
    page.once('dialog', dialog => dialog.dismiss());
    await reset.click();
    expect(await readStats(page)).toEqual(before);
    expect(await page.evaluate(key => localStorage.getItem(key), EXAM_KEY)).toBe(sessionBefore);

    const otherPractice = await context.newPage();
    await otherPractice.goto(`/tentti/harjoitus?mode=${otherMode}&answer=cards&direction=fi-sv&amount=10`);
    await expect(otherPractice.locator('#progress')).toHaveText('0 / 1');
    await otherPractice.getByRole('button', { name: 'Näytä vastaus' }).click();
    const practice = await context.newPage();
    await practice.goto(roundUrl);
    await expect(practice.locator('#progress')).toHaveText('0 / 1');
    const progressBefore = await readProgress(page);
    page.once('dialog', dialog => dialog.accept());
    await reset.click();
    await expect(page.locator('[data-review-reset-status]')).toContainText('pakka tyhjennetty');
    await expect(page.locator('[data-review-reset-status]')).toBeFocused();
    await expect(page.locator(`[data-${mode}-cta]`)).toBeHidden();
    await expect(page.locator(`[data-${otherMode}-count]`)).toHaveText('1 sana');
    await expect(reset).toBeDisabled();
    const after = await readStats(page);
    expect(after.cards[id]).toMatchObject({ ...before.cards[id]! });
    expect(after.cards['mediciner-001']).toEqual(before.cards['mediciner-001']);
    expect(await page.evaluate(key => localStorage.getItem(key), EXAM_KEY)).toBeNull();
    expect(await page.evaluate(key => localStorage.getItem(key), GENERAL_KEY)).toBe('{"preserve":"general session"}');
    const progressAfter = await readProgress(page);
    expect(progressAfter).toMatchObject({
      installationId: progressBefore.installationId,
      createdAt: progressBefore.createdAt,
      settings: progressBefore.settings,
      inventory: progressBefore.inventory,
      lifetime: { ...progressBefore.lifetime, activeStudyMs: expect.any(Number) },
    });
    // The other tab legitimately records its final study time when its round closes.
    expect(progressAfter.lifetime.activeStudyMs).toBeGreaterThanOrEqual(progressBefore.lifetime.activeStudyMs);
    await expect(practice.locator('#error-view')).toBeVisible();
    await expect(otherPractice.locator('#answer-area')).toBeVisible();
    await practice.close();
    await otherPractice.close();
    await page.reload();
    await expect(reset).toBeDisabled();
    await expect(page.locator(`[data-${mode}-empty]`)).toBeVisible();
    await expect(page.locator(`[data-${otherMode}-count]`)).toHaveText('1 sana');
    await page.goto(roundUrl);
    await expect(page.locator('#error-view')).toBeVisible();
  });
}

test('difficult reset survives a new miss in an already open review tab', async ({ page, context }) => {
  const id = await seed(page);
  const practice = await context.newPage();
  await practice.goto('/tentti/harjoitus?mode=review&answer=cards&direction=fi-sv&amount=10');
  await expect(practice.locator('#progress')).toHaveText('0 / 1');
  const saved = await page.evaluate(key => localStorage.getItem(key), EXAM_KEY);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-clear-review="difficult"]').click();
  expect(await page.evaluate(key => localStorage.getItem(key), EXAM_KEY)).toBe(saved);
  for (let miss = 1; miss <= 3; miss++) {
    await practice.getByRole('button', { name: 'Näytä vastaus' }).click();
    await practice.getByRole('button', { name: 'En osannut', exact: true }).click();
    const state = await readStats(practice);
    expect(state.cards[id]!.difficultResetIncorrect).toBe(3);
    expect(state.cards[id]!.incorrect).toBe(3 + miss);
    await expect(page.locator('[data-difficult-cta]')).toBeVisible({ visible: miss === 3 });
  }
  await practice.getByRole('button', { name: 'Näytä vastaus' }).click();
  await practice.getByRole('button', { name: 'Osasin', exact: true }).click();
  await continuePastMilestone(practice);
  await practice.close();
});

test('reset failure leaves the deck usable and reports the storage error', async ({ page }) => {
  await seed(page);
  const before = await readStats(page);
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, WORD_STATS_KEY);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-clear-review="review"]').click();
  await expect(page.locator('[data-review-reset-status]')).toContainText('Tyhjennystä ei voitu tallentaa');
  await expect(page.locator('[data-review-cta]')).toBeVisible();
  await expect(page.locator('[data-clear-review="review"]')).toBeEnabled();
  expect(await readStats(page)).toEqual(before);
});

test('reset buttons fit mobile, are accessible and are disabled for empty decks', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 320, height: 568 });
  for (const mode of ['review', 'difficult']) {
    const bounds = await page.locator(`[data-clear-review="${mode}"]`).boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  await page.screenshot({ path: 'tmp/review-reset-mobile.png', fullPage: true });
  for (const mode of ['review', 'difficult']) {
    page.once('dialog', dialog => dialog.accept());
    await page.locator(`[data-clear-review="${mode}"]`).click();
  }
  await page.reload();
  await expect(page.locator('[data-clear-review="review"]')).toBeDisabled();
  await expect(page.locator('[data-clear-review="difficult"]')).toBeDisabled();
  await page.goto('/kortit/');
  await expect(page.locator('[data-clear-review]')).toHaveCount(0);
});
