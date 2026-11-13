import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { continuePastMilestone } from './helpers';
import { WORD_STATS_KEY } from '../../src/lib/vocabulary-stats';

const KEY = 'medicinsk-svenska.everyday-session.v1';
const MEDICAL_KEY = 'medicinsk-svenska.flashcard-session.v1';
const EXAM_KEY = 'medicinsk-svenska.exam-session.v1';
const TEST_KEY = 'medicinsk-svenska.everyday-test.v1';

test('header opens 20 everyday decks with 500 cards, accessible on phones and desktops', async ({ page }) => {
  await page.goto('/kortit/');
  await page.locator('.desktop-navigation').getByRole('link', { name: 'Arkisanasto' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Arkisanasto');
  await expect(page.locator('.deck-row')).toHaveCount(20);
  await expect(page.locator('.deck-count', { hasText: '25 korttia' })).toHaveCount(20);
  for (const width of [1440, 1024, 390, 320]) {
    await page.setViewportSize({ width, height: width > 980 ? 1000 : 844 });
    const nav = width > 980 ? page.locator('.desktop-navigation a[href="/arkisanasto/"]') : page.locator('.mobile-everyday-link');
    await expect(nav).toBeVisible();
    await expect(nav).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440 || width === 390 || width === 320) await page.screenshot({ path: `tmp/arkisanasto-${width}.png`, fullPage: false });
  }
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''));
  expect(violations).toEqual([]);
});

test('all cards and reload stay in an independent session without replacing medical or exam work', async ({ page }) => {
  await page.goto('/kortit/harjoitus?mode=lucky&direction=fi-sv&amount=10');
  const medical = await page.evaluate(key => localStorage.getItem(key), MEDICAL_KEY);
  await page.goto('/tentti/harjoitus?mode=lucky&direction=fi-sv&amount=10');
  const exam = await page.evaluate(key => localStorage.getItem(key), EXAM_KEY);
  await page.goto('/arkisanasto/');
  await page.getByLabel('Kaikki', { exact: true }).check();
  await page.getByRole('link', { name: /Koko arkisanasto/ }).click();
  await expect(page.locator('#progress')).toHaveText('0 / 500');
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
  expect(new Set(before.selectedCardIds).size).toBe(500);
  expect(before.selectedCardIds.every((id: string) => id.startsWith('arki-'))).toBe(true);
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.reload();
  await expect(page.locator('#answer-area')).toBeVisible();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).selectedCardIds, KEY)).toEqual(before.selectedCardIds);
  expect(await page.evaluate(key => localStorage.getItem(key), MEDICAL_KEY)).toBe(medical);
  expect(await page.evaluate(key => localStorage.getItem(key), EXAM_KEY)).toBe(exam);
});

test('classes and irregular forms reveal correctly in both directions', async ({ page }) => {
  for (const direction of ['fi-sv', 'sv-fi']) {
    await page.goto(`/arkisanasto/harjoitus?mode=deck&deck=arki-tyo-opiskelu&direction=${direction}&amount=10`);
    await page.evaluate(key => {
      const state = JSON.parse(localStorage.getItem(key)!);
      state.selectedCardIds = ['arki-tyo-opiskelu-bok']; state.currentCardId = state.selectedCardIds[0]; state.unseenCardQueue = [];
      localStorage.setItem(key, JSON.stringify(state));
    }, KEY);
    await page.reload();
    await expect(page.locator('#front-term')).toHaveText(direction === 'fi-sv' ? 'kirja' : 'en bok 3');
    await expect(page.locator('#answer-area')).toBeHidden();
    await page.getByRole('button', { name: 'Näytä vastaus' }).click();
    await expect(page.locator('#back-term')).toHaveText(direction === 'fi-sv' ? 'en bok 3' : 'kirja');
    await expect(page.locator('#grammar')).toContainText('boken, böcker, böckerna');
  }
  await page.screenshot({ path: 'tmp/arkisanasto-card.png' });
});

test('new round uses the exam mix of old and new everyday cards', async ({ page }) => {
  await page.goto('/arkisanasto/harjoitus?mode=lucky&direction=fi-sv&amount=10');
  await page.evaluate(() => document.documentElement.dataset.calm = 'true');
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
  for (let index = 0; index < 10; index++) {
    await page.getByRole('button', { name: 'Näytä vastaus' }).click();
    await page.getByRole('button', { name: 'Osasin', exact: true }).click();
    await continuePastMilestone(page);
  }
  await expect(page.locator('#summary-view')).toBeVisible();
  await page.getByRole('button', { name: 'Uusi kierros' }).click();
  await expect(page.locator('#progress')).toHaveText('0 / 10');
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
  expect(after.sessionId).not.toBe(before.sessionId);
  expect(after.selectedCardIds.filter((id: string) => before.selectedCardIds.includes(id))).toHaveLength(2);
  expect(after.selectedCardIds.filter((id: string) => !before.selectedCardIds.includes(id))).toHaveLength(8);
});

test('review decks and their reset ignore medical mistakes', async ({ page }) => {
  await page.goto('/arkisanasto/');
  await page.evaluate(key => {
    const mistake = { attempts: 3, incorrect: 3, correctStreak: 0, lastAttemptAt: Date.now(), lastIncorrectAt: Date.now() };
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, cards: { 'arki-tyo-opiskelu-bok': mistake, 'tenttisanasto-anatomi-001': mistake } }));
  }, WORD_STATS_KEY);
  await page.reload();
  await expect(page.locator('[data-review-count]')).toHaveText('1 sana');
  await expect(page.locator('[data-difficult-count]')).toHaveText('1 sana');
  await page.locator('[data-difficult-cta]').click();
  await expect(page.locator('#progress')).toHaveText('0 / 1');
  await expect(page.locator('#front-term')).toHaveText('kirja');
  await page.getByRole('link', { name: 'Takaisin', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Tyhjennä En osannut -pakka', exact: true }).click();
  await expect(page.locator('[data-review-cta]')).toBeHidden();
  await page.goto('/tentti/');
  await expect(page.locator('[data-review-count]')).toHaveText('1 sana');
});

test('written test covers 20 topics in each half and preserves the medical test', async ({ page }) => {
  await page.goto('/tentti/koe/harjoitus/');
  const exam = await page.evaluate(() => localStorage.getItem('medicinsk-svenska.exam-test.v1'));
  await page.goto('/arkisanasto/');
  await page.getByRole('link', { name: /Tee sanastotesti/ }).click();
  await expect(page.locator('#exam-test-progress')).toHaveText('1 / 50');
  const state = await page.evaluate(key => {
    const session = JSON.parse(localStorage.getItem(key)!);
    const terms = JSON.parse(document.getElementById('exam-test-data')!.textContent!);
    return { session, topics: session.questions.map((q: { termId: string }) => terms.find((term: { id: string }) => term.id === q.termId).topicIds[0]) };
  }, TEST_KEY);
  expect(new Set(state.topics.slice(0, 25)).size).toBe(20);
  expect(new Set(state.topics.slice(25)).size).toBe(20);
  expect(new Set(state.session.questions.map((q: { termId: string }) => q.termId)).size).toBe(50);
  await page.getByLabel('Vastauksesi').fill('minun vastaukseni');
  await page.reload();
  await expect(page.getByLabel('Vastauksesi')).toHaveValue('minun vastaukseni');
  expect(await page.evaluate(() => localStorage.getItem('medicinsk-svenska.exam-test.v1'))).toBe(exam);
  await page.getByRole('link', { name: 'Takaisin', exact: true }).click();
  await expect(page).toHaveURL(/\/arkisanasto\/$/);
});

test('foreign deck URLs cannot pull medical cards into everyday practice', async ({ page }) => {
  await page.goto('/arkisanasto/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10');
  await expect(page.getByRole('heading', { name: 'Pakkaa ei löytynyt' })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), KEY)).toBeNull();
});
