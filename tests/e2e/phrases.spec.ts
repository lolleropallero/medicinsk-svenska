import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { continuePastMilestone } from './helpers';

const STORAGE_KEY = 'medicinsk-svenska.phrase-session.v1';

async function seedPhraseSession(page: Page, ids: string[], options: { sessionId?: string; categoryId?: string; startedAt?: number; revealed?: boolean } = {}) {
  const sessionId = options.sessionId ?? 'seeded-phrases';
  const mode = options.categoryId ? 'category' : 'all';
  await page.goto('/fraasit');
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  const params = new URLSearchParams({ mode, amount: '10', session: sessionId });
  if (options.categoryId) params.set('category', options.categoryId);
  await page.goto(`/fraasit/harjoitus?${params}`);
  await page.evaluate(({ key, selected, id, sourceMode, categoryId, startedAt, revealed }) => {
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1, sessionId: id, mode: sourceMode,
      ...(sourceMode === 'category' ? { sourceCategoryId: categoryId } : {}),
      requestedAmount: 10, selectedPhraseIds: selected, unseenPhraseQueue: selected.slice(1),
      currentPhraseId: selected[0], revealed, masteredPhraseIds: [], pendingRetries: [],
      attemptCountByPhrase: {}, firstAttemptCorrectByPhrase: {}, totalMissedCount: 0,
      startedAt: startedAt ?? Date.now(),
    }));
  }, { key: STORAGE_KEY, selected: ids, id: sessionId, sourceMode: mode, categoryId: options.categoryId, startedAt: options.startedAt, revealed: options.revealed ?? false });
  await page.reload();
}

test('landing, navigation, and setup expose three complete phrase-category links', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Stäng dagens uppdrag'}).click();
  await expect(page.getByRole('link', { name: 'Fraasit' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Fraasit' }).first().click();
  await expect(page.getByRole('heading', { name: 'Vastaanottofraasit' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Fraasien määrä' }).getByLabel('10')).toBeChecked();
  await expect(page.locator('.category-row')).toHaveCount(3);
  const expected = [['Taustatiedot', '7 fraasia'], ['Oireet ja vointi', '20 fraasia'], ['Hoito ja lääkitys', '46 fraasia']] as const;
  for (const [name, count] of expected) {
    const row = page.locator('.category-row').filter({ hasText: name });
    expect(await row.evaluate((element) => element.tagName)).toBe('A');
    await expect(row.locator('a,button')).toHaveCount(0);
    await expect(row).toContainText(count);
  }
  await expect(page.getByRole('link', { name: /Kaikki fraasit.*73 fraasia/ })).toBeVisible();
  await page.locator('.category-row').filter({ hasText: 'Oireet ja vointi' }).getByRole('heading').click();
  await expect(page).toHaveURL(/category=oireet-vointi/);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) !== null, STORAGE_KEY)).toBe(true);
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  const payload = JSON.parse((await page.locator('#phrases-data').textContent())!);
  const byId = new Map(payload.map((item: { id: string; categoryId: string }) => [item.id, item.categoryId]));
  expect(state.selectedPhraseIds).toHaveLength(10);
  expect(state.selectedPhraseIds.every((id: string) => byId.get(id) === 'oireet-vointi')).toBe(true);
});

test('10, 25, and Kaikki select unique shuffled phrases and short categories use the whole pool', async ({ page }) => {
  for (const [label, expected] of [['10', 10], ['25', 25], ['Kaikki', 73]] as const) {
    await page.goto('/fraasit');
    await page.getByRole('group', { name: 'Fraasien määrä' }).locator('label').filter({ hasText: label }).click();
    await page.getByRole('link', { name: /Kaikki fraasit/ }).click();
    await expect.poll(() => page.evaluate((key) => {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value).selectedPhraseIds.length : 0;
    }, STORAGE_KEY)).toBe(expected);
    const ids = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).selectedPhraseIds as string[], STORAGE_KEY);
    expect(ids).toHaveLength(expected); expect(new Set(ids).size).toBe(expected);
  }
  await page.goto('/fraasit');
  await page.getByRole('group', { name: 'Fraasien määrä' }).locator('label').filter({ hasText: '25' }).click();
  await page.locator('.category-row').filter({ hasText: 'Taustatiedot' }).locator('.category-count').click();
  await expect.poll(() => page.evaluate((key) => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value).selectedPhraseIds.length : 0;
  }, STORAGE_KEY)).toBe(7);
  const ids = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).selectedPhraseIds as string[], STORAGE_KEY);
  expect(ids).toHaveLength(7); expect(new Set(ids).size).toBe(7);
});

test('Finnish cue reveals Swedish, restores focus and state, then grading advances', async ({ page }) => {
  await seedPhraseSession(page, ['fraasi-oireet-vointi-gora-ont', 'fraasi-oireet-vointi-andas-in'], { categoryId: 'oireet-vointi' });
  await expect(page.locator('#phrase-fi')).toHaveText('tehdä kipeää');
  await expect(page.locator('#phrase-fi')).toHaveAttribute('lang', 'fi');
  await expect(page.locator('#phrase-sv')).toBeHidden();
  await expect(page.getByText('Suomeksi', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Ruotsiksi', { exact: true })).toHaveCount(0);
  const reveal = page.getByRole('button', { name: 'Näytä vastaus' });
  await expect(reveal).toBeFocused();
  await expect(page.locator('button', { hasText: 'Näytä vastaus' })).toHaveCount(0);
  await reveal.press('Space');
  await expect(page.locator('#phrase-sv')).toHaveText('göra ont');
  await expect(page.locator('#phrase-sv')).toHaveAttribute('lang', 'sv');
  await expect(page.getByRole('button', { name: 'En osannut' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Osasin' })).toBeVisible();
  await page.reload();
  await expect(page.locator('#phrase-sv')).toBeVisible();
  await expect(page.getByRole('button', { name: 'En osannut' })).toBeFocused();
  await page.getByRole('button', { name: 'Osasin' }).click();
  await continuePastMilestone(page);
  await expect(page.locator('#phrase-fi')).toHaveText('hengittää sisään');
  await expect(page.getByRole('button', { name: 'Näytä vastaus' })).toBeFocused();
});

test('controlled five-minute retry waits, survives reload, continues automatically, and summarizes', async ({ page }) => {
  const clockStart = new Date('2030-07-01T09:59:00.000Z');
  const start = new Date('2030-07-01T10:00:00.000Z');
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(start);
  await seedPhraseSession(page, ['fraasi-oireet-vointi-gora-ont'], { categoryId: 'oireet-vointi', startedAt: start.getTime() });
  await expect(page.locator('#phrase-elapsed')).toHaveText('00:00');
  await page.clock.pauseAt(start.getTime() + 1_000);
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'En osannut' }).click();
  const waiting = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(waiting.pendingRetries[0].dueAt).toBe(start.getTime() + 1_000 + 5 * 60 * 1000);
  await expect(page.locator('#phrase-waiting-copy')).toHaveText('1 fraasi odottaa kertausta');
  await expect(page.locator('#phrase-waiting-copy')).toBeFocused();
  await expect(page.getByRole('link', { name: 'Takaisin fraaseihin' })).toBeVisible();
  await expect(page.locator('#phrase-retry-countdown')).toHaveText('05:00');
  await page.clock.fastForward(299_999);
  await expect(page.locator('#phrase-retry-countdown')).toHaveText('00:01');
  expect((await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)).currentPhraseId).toBeNull();
  await page.reload();
  await expect(page.locator('#phrase-retry-countdown')).toHaveText('00:01');
  await page.clock.fastForward(1);
  await expect(page.getByRole('button', { name: 'Näytä vastaus' })).toBeFocused();
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'Osasin' }).click();
  await continuePastMilestone(page);
  await expect(page.getByRole('heading', { name: 'Valmis', exact: true })).toBeFocused();
  await expect(page.locator('#phrase-summary-first')).toHaveText('0 / 1');
  await expect(page.locator('#phrase-summary-missed')).toHaveText('1');
  await expect(page.locator('#phrase-summary-time')).toHaveText('05:01');
});

test('Uusi kierros creates fresh retained configuration and invalid state fails closed', async ({ page }) => {
  await seedPhraseSession(page, ['fraasi-taustatiedot-vara-pensionerad'], { categoryId: 'taustatiedot', sessionId: 'complete-old' });
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'Osasin' }).click();
  await continuePastMilestone(page);
  const old = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  await page.getByRole('button', { name: 'Uusi kierros' }).click();
  const fresh = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(fresh.sessionId).not.toBe(old.sessionId);
  expect(fresh).toMatchObject({ mode: 'category', sourceCategoryId: 'taustatiedot', requestedAmount: 10, totalMissedCount: 0, revealed: false });
  expect(fresh.selectedPhraseIds).toHaveLength(7);
  expect(fresh.masteredPhraseIds).toEqual([]); expect(fresh.pendingRetries).toEqual([]); expect(fresh.attemptCountByPhrase).toEqual({});
  expect(new URL(page.url()).searchParams.get('session')).toBe(fresh.sessionId);

  await page.goto('/fraasit'); await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.goto('/fraasit/harjoitus?mode=category&category=missing&amount=10&session=bad');
  await expect(page.getByRole('heading', { name: 'Harjoitusta ei löytynyt' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Takaisin fraaseihin' })).toBeVisible();

  await seedPhraseSession(page, ['fraasi-oireet-vointi-gora-ont'], { categoryId: 'oireet-vointi', sessionId: 'cross-category' });
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.selectedPhraseIds = ['fraasi-taustatiedot-vara-pensionerad'];
    state.currentPhraseId = 'fraasi-taustatiedot-vara-pensionerad';
    localStorage.setItem(key, JSON.stringify(state));
  }, STORAGE_KEY);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Harjoitusta ei löytynyt' })).toBeFocused();

  await page.goto('/fraasit');
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), STORAGE_KEY);
  await page.goto('/fraasit/harjoitus?mode=all&amount=10&session=corrupt-state');
  await expect(page.getByRole('heading', { name: 'Harjoitusta ei löytynyt' })).toBeFocused();

  await page.goto('/fraasit/harjoitus?mode=all&amount=10');
  const generatedId = new URL(page.url()).searchParams.get('session');
  expect(generatedId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._~-]+$/);
  const generated = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(generated.sessionId).toBe(generatedId);
  expect(generated.selectedPhraseIds).toHaveLength(10);
});

test('phrase routes, payload, header, touch targets, and narrow layouts are accessible', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 700 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/fraasit');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Fraasit' })).toBeVisible();
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.getByRole('link', { name: /Kaikki fraasit/ }).click();
    await expect(page).toHaveURL(/\/fraasit\/harjoitus/);
    const reveal = page.getByRole('button', { name: 'Näytä vastaus' });
    await expect(reveal).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await reveal.click();
    for (const name of ['En osannut', 'Osasin']) {
      const grading = page.getByRole('button', { name });
      await expect(grading).toBeVisible();
      expect((await grading.boundingBox())!.height).toBeGreaterThanOrEqual(52);
    }
  }
  const payload = JSON.parse((await page.locator('#phrases-data').textContent())!);
  const categories = JSON.parse((await page.locator('#phrase-categories-data').textContent())!);
  expect(payload.every((item: Record<string, unknown>) => Object.keys(item).every((key) => ['id', 'categoryId', 'fi', 'sv'].includes(key)))).toBe(true);
  expect(categories.every((item: Record<string, unknown>) => Object.keys(item).every((key) => ['id', 'nameFi'].includes(key)))).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});
