import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSpecificCard } from './helpers';

const PROGRESS = 'medicinsk-svenska.progress.v1';

async function captureMilestoneFeedback(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { milestoneSounds: string[] }).milestoneSounds = [];
    (window as unknown as { milestoneSoundContexts: boolean[] }).milestoneSoundContexts = [];
    window.addEventListener('sound-effect-requested', (event) => {
      const effect = (event as CustomEvent<{ effect: string }>).detail.effect;
      if (['level-up', 'achievement', 'quest-complete'].includes(effect))
        (window as unknown as { milestoneSounds: string[] }).milestoneSounds.push(effect);
      if (['level-up', 'achievement', 'quest-complete'].includes(effect))
        (window as unknown as { milestoneSoundContexts: boolean[] }).milestoneSoundContexts.push(
          Boolean((document.getElementById('milestone-overlay') as HTMLDialogElement | null)?.open),
        );
    });
  });
}

async function prepareCard(page: Page, mutate: (state: Record<string, any>, day: string) => void) {
  await openSpecificCard(page, { id: 'anatomi-004', deckId: 'anatomi' }, 'fi-sv');
  await page.evaluate(({ key, source }) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    const date = new Date();
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    // The mutation source is test-owned deterministic state, not application markup.
    Function('state', 'day', 'unlockAll', `(${source})(state, day)`)(
      state,
      day,
      (value: Record<string, any>) => { for (const item of value.achievements) item.unlockedAt = 1; },
    ); // eslint-disable-line no-new-func
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: PROGRESS, source: mutate.toString() });
  await page.reload();
}

async function masterCard(page: Page) {
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'Osasin' }).click();
  return page.getByRole('dialog', { name: 'Det här har du klarat' });
}

const unlockAll = (state: Record<string, any>) => {
  for (const item of state.achievements) item.unlockedAt = 1;
};

test.beforeEach(async ({ page }) => captureMilestoneFeedback(page));

test('achievement-only final card explains the achievement once and resumes at completion', async ({ page }) => {
  await prepareCard(page, () => {});
  const dialog = await masterCard(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Prestation upplåst');
  await expect(dialog).toContainText('Första steget');
  await expect(dialog).toContainText('Slutför din första uppgift.');
  await expect(page.locator('.notification[data-notification-kind="achievement"]')).toHaveCount(0);
  await expect(page.locator('#milestone-overlay')).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { milestoneSounds: string[] }).milestoneSounds)).toEqual(['achievement']);
  await expect(page.getByRole('button', { name: 'Fortsätt' })).toBeFocused();
  await page.getByRole('button', { name: 'Fortsätt' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#summary-view')).toBeVisible();
  await expect(page.locator('#summary-first')).toHaveText('1 / 1');
  await page.reload();
  await expect(dialog).not.toBeVisible();
});

test('level-only milestone identifies the final level with one fanfare', async ({ page }) => {
  await prepareCard(page, (state) => {
    unlockAll(state);
    state.lifetime.completedItems = 20;
    state.lifetime.xp = 18;
    state.highestRewardedLevel = 1;
  });
  const dialog = await masterCard(page);
  await expect(dialog).toContainText('Ny nivå');
  await expect(dialog.locator('.milestone-level-number')).toHaveText('2');
  expect(await page.evaluate(() => (window as unknown as { milestoneSounds: string[] }).milestoneSounds)).toEqual(['level-up']);
  expect(await page.evaluate(() => (window as unknown as { milestoneSoundContexts: boolean[] }).milestoneSoundContexts)).toEqual([true]);
});

test('daily quest-only milestone identifies the quest with one fanfare', async ({ page }) => {
  await prepareCard(page, (state, day) => {
    unlockAll(state);
    state.lifetime.completedItems = 20;
    state.lifetime.xp = 0;
    state.daily[day].uniqueItemIds = Array.from({ length: 9 }, (_, index) => `flashcards:seed-${index}`);
    state.daily[day].completedItems = 9;
    state.daily[day].quests.slice(1).forEach((quest: Record<string, any>) => { quest.claimed = true; });
  });
  const dialog = await masterCard(page);
  await expect(dialog).toContainText('Dagens mål klart');
  await expect(dialog).toContainText('Gör 10 olika uppgifter');
  expect(await page.evaluate(() => (window as unknown as { milestoneSounds: string[] }).milestoneSounds)).toEqual(['quest-complete']);
});

test('weekly quest-only milestone identifies the weekly quest with one fanfare', async ({ page }) => {
  await prepareCard(page, (state, day) => {
    unlockAll(state);
    state.lifetime.completedItems = 200;
    state.lifetime.xp = 25;
    state.highestRewardedLevel = 2;
    state.daily[day].uniqueItemIds = Array.from({ length: 99 }, (_, index) => `flashcards:weekly-seed-${index}`);
    state.daily[day].completedItems = 99;
    state.daily[day].quests.forEach((quest: Record<string, any>) => { quest.claimed = true; });
    state.daily[day].allQuestsClaimed = true;
  });
  const dialog = await masterCard(page);
  await expect(dialog).toContainText('Veckouppdrag klart');
  await expect(dialog).toContainText('Gör 100 olika uppgifter');
  expect(await page.evaluate(() => (window as unknown as { milestoneSounds: string[] }).milestoneSounds)).toEqual(['quest-complete']);
});

test('combined level, achievement, and quest share one overlay and one fanfare', async ({ page }) => {
  await prepareCard(page, (state, day) => {
    unlockAll(state);
    delete state.achievements.find((item: Record<string, any>) => item.id === 'items-10').unlockedAt;
    state.lifetime.completedItems = 9;
    state.lifetime.xp = 18;
    state.highestRewardedLevel = 1;
    state.daily[day].uniqueItemIds = Array.from({ length: 9 }, (_, index) => `flashcards:seed-${index}`);
    state.daily[day].completedItems = 9;
    state.daily[day].quests.slice(1).forEach((quest: Record<string, any>) => { quest.claimed = true; });
  });
  const dialog = await masterCard(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-milestone-kind="level"]')).toContainText('2');
  await expect(dialog.locator('[data-milestone-kind="achievement"]')).toContainText('En bra början');
  await expect(dialog.locator('[data-milestone-kind="daily-quest"]')).toContainText('Gör 10 olika uppgifter');
  await expect(dialog).toHaveAttribute('data-milestone-count', '3');
  expect(await page.evaluate(() => (window as unknown as { milestoneSounds: string[] }).milestoneSounds)).toEqual(['level-up']);
});

test('two achievements share one readable overlay', async ({ page }) => {
  await prepareCard(page, (state) => {
    state.lifetime.completedItems = 9;
    state.lifetime.xp = 0;
  });
  const dialog = await masterCard(page);
  await expect(dialog).toContainText('Prestationer upplåsta');
  await expect(dialog).toContainText('Första steget');
  await expect(dialog).toContainText('En bra början');
  await expect(dialog.locator('.achievement-item')).toHaveCount(2);
  expect(await page.evaluate(() => (window as unknown as { milestoneSounds: string[] }).milestoneSounds)).toEqual(['achievement']);
});

test('calm and reduced-motion modes preserve milestone text and Escape dismissal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepareCard(page, (state) => { state.settings.calmMode = true; });
  const dialog = await masterCard(page);
  await expect(dialog).toContainText('Första steget');
  await expect(dialog).toHaveAttribute('data-motion-mode', 'reduced');
  expect(await dialog.locator('.milestone-level-number').count()).toBe(0);
  expect(await dialog.locator('.milestone-sheet').evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  // Calm mode follows the existing sound policy but never suppresses the explanation.
  expect(await page.evaluate(() => (window as unknown as { milestoneSounds: string[] }).milestoneSounds)).toEqual(['achievement']);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('320 x 568 combined layout has no horizontal overflow or serious axe violations', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await prepareCard(page, (state, day) => {
    unlockAll(state);
    delete state.achievements.find((item: Record<string, any>) => item.id === 'items-10').unlockedAt;
    state.lifetime.completedItems = 9;
    state.lifetime.xp = 18;
    state.highestRewardedLevel = 1;
    state.daily[day].uniqueItemIds = Array.from({ length: 9 }, (_, index) => `flashcards:seed-${index}`);
    state.daily[day].completedItems = 9;
  });
  const dialog = await masterCard(page);
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const bounds = await dialog.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(320);
  const continueBounds = await page.getByRole('button', { name: 'Fortsätt' }).boundingBox();
  expect(continueBounds?.y).toBeGreaterThanOrEqual(0);
  expect((continueBounds?.y ?? 0) + (continueBounds?.height ?? 0)).toBeLessThanOrEqual(568);
  const results = await new AxeBuilder({ page }).include('#milestone-overlay').analyze();
  expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});

test('390 x 844 layout remains contained and readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareCard(page, () => {});
  const dialog = await masterCard(page);
  await expect(dialog).toContainText('Första steget');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const bounds = await dialog.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
});

test('En osannut replays the final card immediately and creates no fake milestone', async ({ page }) => {
  await prepareCard(page, () => {});
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'En osannut' }).click();
  await expect(page.getByRole('dialog', { name: 'Det här har du klarat' })).not.toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { milestoneSounds: string[] }).milestoneSounds)).toEqual([]);
  const retryState = await page.evaluate(() => JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(retryState.pendingRetries).toEqual([]);
  expect(retryState.currentCardId).toBe('anatomi-004');
  expect(retryState.totalMissedCount).toBe(1);
  await expect(page.getByRole('button', { name: 'Näytä vastaus' })).toBeFocused();
});

test('persisted milestones establish a silent baseline on reload', async ({ page }) => {
  await page.goto('/kortit/');
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    for (const item of state.achievements) item.unlockedAt = 1;
    state.lifetime.xp = 180;
    state.highestRewardedLevel = 4;
    const day = Object.keys(state.daily)[0];
    if (day) for (const quest of state.daily[day].quests) quest.claimed = true;
    localStorage.setItem(key, JSON.stringify(state));
  }, PROGRESS);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Det här har du klarat' })).not.toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { milestoneSounds: string[] }).milestoneSounds)).toEqual([]);
});

test('phrase grading preserves the advanced session behind its milestone', async ({ page }) => {
  await page.goto('/fraasit/harjoitus?mode=all&amount=10&session=milestone-phrase');
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'Osasin' }).click();
  const dialog = page.getByRole('dialog', { name: 'Det här har du klarat' });
  await expect(dialog).toContainText('Första steget');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('medicinsk-svenska.phrase-session.v1')!));
  expect(stored.masteredPhraseIds).toHaveLength(1);
  expect(stored.currentPhraseId).not.toBe(stored.masteredPhraseIds[0]);
  await page.getByRole('button', { name: 'Fortsätt' }).click();
  await expect(page.locator('#phrase-session-view')).toBeVisible();
});

test('description correct-answer grading preserves resolved state behind its milestone', async ({ page }) => {
  await page.goto('/kuvailu/harjoitus?mode=all&amount=10&session=milestone-description&round=initial');
  const answer = await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('medicinsk-svenska.description-session.v1')!);
    const items = JSON.parse(document.getElementById('descriptions-data')!.textContent!);
    return items.find((item: { id: string }) => item.id === session.selectedExerciseIds[session.currentIndex]).answerSv;
  });
  await page.getByRole('textbox').fill(answer);
  await page.getByRole('button', { name: /Tarkista/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Det här har du klarat' });
  await expect(dialog).toContainText('Första steget');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('medicinsk-svenska.description-session.v1')!).currentResolvedResult)).toBe('correct');
  await page.getByRole('button', { name: 'Fortsätt' }).click();
  await expect(page.locator('#description-feedback')).toHaveAttribute('data-result', 'correct');
  await page.locator('#description-next').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('medicinsk-svenska.description-session.v1')!).currentIndex)).toBe(1);
});
