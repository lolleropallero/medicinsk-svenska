import { expect, test } from '@playwright/test';
import { UI_PREFERENCES_KEY } from '../../src/lib/progress/ui-preferences';

for (const route of ['/kortit/', '/tentti/']) {
  test(`${route} remembers ten cards after practice, reload and reopening the page`, async ({ page, context }) => {
    await page.goto(route);
    await expect(page.getByLabel('25', { exact: true })).toBeChecked();
    await page.getByLabel('10', { exact: true }).check();
    await page.reload();
    await expect(page.getByLabel('10', { exact: true })).toBeChecked();
    await expect(page.locator('[data-selected-count]')).toHaveText('10 korttia');
    expect(await page.locator('[data-start]').evaluateAll(links => links.every(link => new URL((link as HTMLAnchorElement).href).searchParams.get('amount') === '10'))).toBe(true);
    await page.locator('[data-mode="deck"]').first().click();
    await expect(page.locator('#progress')).toHaveText('0 / 10');
    await page.getByRole('link', { name: 'Takaisin', exact: true }).click();
    await expect(page.getByLabel('10', { exact: true })).toBeChecked();
    const reopened = await context.newPage();
    await reopened.goto(route);
    await expect(reopened.getByLabel('10', { exact: true })).toBeChecked();
    await reopened.close();
  });
}

test('the most recent count is shared between general and exam cards, including all and returning to 25', async ({ page }) => {
  await page.goto('/tentti/');
  await page.getByLabel('50', { exact: true }).check();
  await page.locator('.desktop-navigation').getByRole('link', { name: 'Sanakortit', exact: true }).click();
  await expect(page.getByLabel('50', { exact: true })).toBeChecked();
  await expect(page.locator('[data-selected-count]')).toHaveText('50 korttia');
  await page.getByLabel('Kaikki', { exact: true }).check();
  await page.getByRole('link', { name: /Ruotsin tenttisanasto/ }).click();
  await expect(page.getByLabel('Kaikki', { exact: true })).toBeChecked();
  await expect(page.locator('[data-selected-count]')).toHaveText('Kaikki kortit');
  expect(await page.locator('[data-start]').evaluateAll(links => links.every(link => new URL((link as HTMLAnchorElement).href).searchParams.get('amount') === 'all'))).toBe(true);
  await page.reload();
  await expect(page.getByLabel('Kaikki', { exact: true })).toBeChecked();
  await page.getByLabel('25', { exact: true }).check();
  await page.locator('.desktop-navigation').getByRole('link', { name: 'Sanakortit', exact: true }).click();
  await expect(page.getByLabel('25', { exact: true })).toBeChecked();
  await expect(page.locator('[data-selected-count]')).toHaveText('25 korttia');
});

test('an invalid saved count falls back safely and choosing a count preserves other preferences', async ({ page }) => {
  await page.goto('/tentti/');
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, cardAmount: 77, soundEnabled: false, soundVolume: .3, musicEnabled: false, musicVolume: .2 })), UI_PREFERENCES_KEY);
  await page.reload();
  await expect(page.getByLabel('25', { exact: true })).toBeChecked();
  await page.getByLabel('10', { exact: true }).check();
  await page.reload();
  await expect(page.getByLabel('10', { exact: true })).toBeChecked();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), UI_PREFERENCES_KEY)).toMatchObject({ cardAmount: 10, soundEnabled: false, soundVolume: .3, musicEnabled: false, musicVolume: .2 });
});
