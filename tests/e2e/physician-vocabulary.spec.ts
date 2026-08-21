import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSpecificCard } from './helpers';

const STORAGE_KEY = 'medicinsk-svenska.flashcard-session.v1';

test('new physician decks are compact semantic rows with exact counts', async ({ page }) => {
  await page.goto('/kortit');
  const expected = [
    ['Vastaanotto ja anamneesi', '27 korttia', 'vastaanotto-anamneesi'],
    ['Tutkimukset ja hoito', '50 korttia', 'tutkimukset-hoito'],
    ['Osastot', '18 korttia', 'avdelningar'],
  ] as const;
  for (const [name, count] of expected) {
    const row = page.locator('.deck-row').filter({ hasText: name });
    await expect(row).toHaveCount(1);
    expect(await row.evaluate((element) => element.tagName)).toBe('A');
    await expect(row.locator('a,button')).toHaveCount(0);
    await expect(row.locator('.deck-count')).toHaveText(count);
  }
  const intake = page.locator('.deck-row').filter({ hasText: 'Vastaanotto ja anamneesi' });
  await intake.getByRole('heading', { name: 'Vastaanotto ja anamneesi' }).click();
  await expect(page).toHaveURL(/deck=vastaanotto-anamneesi/);
  await expect(page.locator('#progress')).toHaveText('0 / 25');
});

test('new decks select ten cards and cap a requested fifty without duplicates', async ({ page }) => {
  await page.goto('/kortit');
  await page.getByRole('group', { name: 'Korttien määrä' }).locator('label').filter({ hasText: '10' }).click();
  await page.locator('.deck-row').filter({ hasText: 'Tutkimukset ja hoito' }).click();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null')?.selectedCardIds.length ?? 0, STORAGE_KEY)).toBe(10);
  let state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(state.selectedCardIds).toHaveLength(10);
  expect(new Set(state.selectedCardIds).size).toBe(10);

  await page.goto('/kortit/harjoitus?mode=deck&deck=vastaanotto-anamneesi&direction=fi-sv&amount=50&session=physician-small-pool');
  state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(state.selectedCardIds).toHaveLength(27);
  expect(new Set(state.selectedCardIds).size).toBe(27);
  await expect(page.locator('#progress')).toHaveText('0 / 27');
});

test('a deterministic new card works in both directions and reveals grammar only on demand', async ({ page }) => {
  const card = { id: 'vastaanotto-anamneesi-urinprov', deckId: 'vastaanotto-anamneesi' };
  await openSpecificCard(page, card, 'fi-sv');
  await expect(page.locator('#front-term')).toHaveText('virtsanäyte');
  await expect(page.locator('#answer-area')).toBeHidden();
  await expect(page.getByText('ett', { exact: true })).toHaveCount(0);
  await expect(page.getByText('urinprovet, urinprov, urinproven', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await expect(page.locator('#back-term')).toHaveText('ett urinprov');
  await expect(page.locator('#grammar')).toContainText('substantiivi');
  await expect(page.locator('#grammar')).toContainText('urinprovet, urinprov, urinproven');

  await openSpecificCard(page, card, 'sv-fi');
  await expect(page.locator('#front-term')).toHaveText('ett urinprov');
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await expect(page.locator('#back-term')).toHaveText('virtsanäyte');
});

test('lucky mode includes the expanded global pool and new IDs persist across reload', async ({ page }) => {
  await page.goto('/kortit');
  await page.getByRole('group', { name: 'Korttien määrä' }).locator('label').filter({ hasText: 'Kaikki' }).click();
  await expect(page.getByRole('link', { name: /Kokeilen onneani/ })).toContainText('Kaikki kortit');
  await page.getByRole('link', { name: /Kokeilen onneani/ }).click();
  await expect.poll(() => page.evaluate((key) => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value).selectedCardIds.length : 0;
  }, STORAGE_KEY)).toBe(455);
  const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(before.selectedCardIds).toHaveLength(455);
  expect(new Set(before.selectedCardIds).size).toBe(455);
  expect(before.selectedCardIds).toContain('tutkimukset-hoito-epikris');
  await page.reload();
  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(after.selectedCardIds).toEqual(before.selectedCardIds);
});

test('all seven rows remain usable on narrow phones without overflow or serious accessibility issues', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/kortit');
    await expect(page.locator('.deck-row')).toHaveCount(7);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const rows = await page.locator('.deck-row').evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
    expect(rows.every((height) => height >= 56)).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await openSpecificCard(page, { id: 'osastot-foretagshalsovardsstation', deckId: 'avdelningar' }, 'sv-fi');
  await expect(page.locator('#front-term')).toHaveText('en företagshälsovårdsstation');
  expect(await page.locator('#front-term').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''));
  expect(violations).toEqual([]);
});
