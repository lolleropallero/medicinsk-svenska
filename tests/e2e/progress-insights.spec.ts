import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedWordStats, type SeededWordStatEntry } from './helpers';

const PROGRESS = 'medicinsk-svenska.progress.v1';
const WORD_STATS = 'medicinsk-svenska.word-stats.v1';
const FLASHCARD_SESSION = 'medicinsk-svenska.flashcard-session.v1';

async function insightsCardIds(page: Page, deckId: string, count: number): Promise<string[]> {
  return page.evaluate(({ deckId, count }) => {
    const cards = JSON.parse(document.getElementById('insights-cards-data')!.textContent!) as { id: string; deckId: string }[];
    return cards.filter((card) => card.deckId === deckId).map((card) => card.id).slice(0, count);
  }, { deckId, count });
}

// Backdates createdAt and seeds a little daily history so the "last 7 / 30 days" and trend logic
// (which requires ~2 weeks of possible history before it will render a trend) have something to show.
async function seedRecentActivity(page: Page, options: { itemsToday?: string[] } = {}) {
  await page.evaluate(({ key, itemsToday }) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.createdAt = Date.now() - 25 * 24 * 60 * 60 * 1000;
    const today = new Date();
    const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    state.daily[dayKey] = {
      uniqueItemIds: itemsToday ?? ['flashcards:seed-a', 'flashcards:seed-b'],
      completedItems: (itemsToday ?? ['flashcards:seed-a', 'flashcards:seed-b']).length,
      activeStudyMs: 120_000, xp: 4, modes: ['flashcards'], sessionsStarted: 1, sessionsCompleted: 1,
      retriesMastered: 0, goalTarget: state.settings.dailyGoal, goalClaimed: false, qualified: false,
      freezeUsed: false, quests: state.daily[dayKey]?.quests ?? [], freeRerollUsed: false,
      allQuestsClaimed: false, sessionDropEligible: 0, sessionDropAwarded: false,
    };
    state.lifetime.completedItems = Math.max(state.lifetime.completedItems, 2);
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: PROGRESS, itemsToday: options.itemsToday });
}

function weakEntry(overrides: Partial<SeededWordStatEntry> = {}): SeededWordStatEntry {
  return { attempts: 4, incorrect: 3, correctStreak: 0, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now(), ...overrides };
}

test('insights show an honest empty state for a brand-new learner', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/edistyminen/');
  const insights = page.locator('#insights-dashboard');
  await expect(insights).toBeVisible();
  await expect(insights).toContainText('Börja öva, så visas dina insikter här.');
  await expect(insights).toContainText('Harjoittele muutama kierros');
  await expect(insights.locator('.insight-block')).toHaveCount(0);
  await expect(insights.locator('.insights-cta')).toHaveCount(0);
});

test('insights surface recent activity, accuracy, category strengths, and hardest words from real local data', async ({ page }) => {
  await page.goto('/edistyminen/');
  const anatomiIds = await insightsCardIds(page, 'anatomi', 2);
  const sjukdomarIds = await insightsCardIds(page, 'sjukdomar', 2);
  await seedWordStats(page, {
    ...Object.fromEntries(anatomiIds.map((id) => [id, { attempts: 5, incorrect: 0, correctStreak: 5, lastAttemptAt: Date.now() }])),
    ...Object.fromEntries(sjukdomarIds.map((id) => [id, weakEntry()])),
  });
  await seedRecentActivity(page, { itemsToday: [`flashcards:${anatomiIds[0]}`, `flashcards:${sjukdomarIds[0]}`] });
  await page.reload();

  const insights = page.locator('#insights-dashboard');
  await expect(insights).toBeVisible();
  // Recent activity: exactly the two items seeded for today.
  await expect(insights).toContainText('2Uppgifter, 7 dagar');
  await expect(insights).toContainText('1 / 7Aktiva dagar');
  // Accuracy: anatomi contributes 10/10 correct, sjukdomar contributes 2/8 correct => 12/18 attempts.
  await expect(insights).toContainText('67 %rätt');
  await expect(insights).toContainText('12 rätt · 6 fel av 18 försök');
  // Category strength: anatomi (100%) strongest, sjukdomar (25%) weakest, and they must be distinct.
  await expect(insights.locator('.category-line')).toHaveCount(2);
  await expect(insights.locator('.category-line').nth(0)).toContainText('Starkast:');
  await expect(insights.locator('.category-line').nth(0)).toContainText('Anatomia');
  await expect(insights.locator('.category-line').nth(1)).toContainText('Öva mer:');
  await expect(insights.locator('.category-line').nth(1)).toContainText('Sairaudet ja vaivat');
  // Hardest words: only the sjukdomar cards were ever missed.
  await expect(insights.locator('.hardest-word-list li')).toHaveCount(2);
  await expect(insights.locator('.hardest-word-list')).toContainText('Sairaudet ja vaivat');
  // Mode volume: only flashcards were practiced.
  await expect(insights).toContainText('2Sanakortit');
  await expect(insights).toContainText('0Fraasit');
  await expect(insights).toContainText('0Kuvailu');
});

test('the hardest-words CTA starts a Kertaa vaikeita session containing exactly those weak words', async ({ page }) => {
  await page.goto('/edistyminen/');
  const weakIds = await insightsCardIds(page, 'anatomi', 3);
  await seedWordStats(page, Object.fromEntries(weakIds.map((id, index) => [id, weakEntry({ incorrect: 1 + index })])));
  await page.reload();

  const cta = page.locator('.insights-cta');
  await expect(cta).toBeVisible();
  await expect(cta).toContainText('3 sanaa');
  await cta.click();
  await expect(page).toHaveURL(/\/kortit\/harjoitus\?.*mode=review/);
  await expect(page.locator('#progress')).toHaveText('0 / 3');
  const session = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FLASHCARD_SESSION);
  expect(session.mode).toBe('review');
  expect(new Set(session.selectedCardIds)).toEqual(new Set(weakIds));
});

test('an encouraging message replaces the CTA once every word has graduated', async ({ page }) => {
  await page.goto('/edistyminen/');
  const ids = await insightsCardIds(page, 'anatomi', 2);
  await seedWordStats(page, Object.fromEntries(ids.map((id) => [id, { attempts: 6, incorrect: 1, correctStreak: 5, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now() - 1_000 }])));
  await page.reload();

  const insights = page.locator('#insights-dashboard');
  await expect(insights).toContainText('Inga svåra ord just nu — bra jobbat!');
  await expect(insights.locator('.insights-cta')).toHaveCount(0);
});

test('insights are a read-only view: rendering them never mutates word-stats or progress state', async ({ page }) => {
  await page.goto('/edistyminen/');
  const ids = await insightsCardIds(page, 'anatomi', 2);
  await seedWordStats(page, Object.fromEntries(ids.map((id) => [id, weakEntry()])));
  await seedRecentActivity(page);
  await page.reload();
  await expect(page.locator('#insights-dashboard')).toContainText('Insikter');

  const wordStatsBefore = await page.evaluate((key) => localStorage.getItem(key), WORD_STATS);
  const progressBefore = await page.evaluate((key) => localStorage.getItem(key), PROGRESS);
  await page.reload();
  await expect(page.locator('#insights-dashboard')).toContainText('Insikter');
  const wordStatsAfter = await page.evaluate((key) => localStorage.getItem(key), WORD_STATS);
  const progressAfter = await page.evaluate((key) => localStorage.getItem(key), PROGRESS);
  expect(wordStatsAfter).toBe(wordStatsBefore);
  expect(progressAfter).toBe(progressBefore);
});

test('insights fit narrow mobile viewports without accessibility violations', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/edistyminen/');
  const ids = await insightsCardIds(page, 'anatomi', 3);
  await seedWordStats(page, Object.fromEntries(ids.map((id) => [id, weakEntry()])));
  await seedRecentActivity(page);
  await page.reload();

  await expect(page.locator('#insights-dashboard')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const violations = (await new AxeBuilder({ page }).include('#insights-dashboard').analyze()).violations
    .filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
  expect(violations).toEqual([]);

  await page.locator('.insights-cta').click();
  await expect(page).toHaveURL(/mode=review/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
