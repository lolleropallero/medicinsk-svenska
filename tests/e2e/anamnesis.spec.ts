import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ANAMNESIS_STORAGE_KEY, anamnesisItems, continuePastMilestone, seedAnamnesisSession } from './helpers';

const PROGRESS_KEY = 'medicinsk-svenska.progress.v1';
const RETIRED_KEY = 'medicinsk-svenska.clinical-session.v1';
const readSession = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), ANAMNESIS_STORAGE_KEY);
// Astro's client-side navigation resolves the URL before the page script has finished writing its
// first session to storage, so callers that just navigated must wait for the key to exist.
async function waitForAnamnesisSession(page: Page) {
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) !== null, ANAMNESIS_STORAGE_KEY)).toBe(true);
  return readSession(page);
}
function sectionsOf(sections: readonly { items: readonly unknown[] }[]) {
  const boundaries: number[] = [];
  let index = 0;
  for (const section of sections) { boundaries.push(index); index += section.items.length; }
  return boundaries;
}

test('landing page links to the Rintakipu case with its item and section counts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Stäng dagens uppdrag' }).click();
  await expect(page.getByRole('link', { name: 'Kliiniset tilanteet' })).toBeVisible();
  await page.getByRole('link', { name: 'Kliiniset tilanteet' }).click();
  await expect(page.getByRole('heading', { name: 'Kliiniset tilanteet' })).toBeVisible();
  const row = page.getByRole('link', { name: /Rintakipu/ });
  await expect(row).toContainText('39 kysymystä');
  await expect(row).toContainText('8 osiota');
  await row.click();
  await expect(page).toHaveURL(/case=rintakipu/);
  const session = await waitForAnamnesisSession(page);
  expect(session).toMatchObject({ caseId: 'rintakipu', currentItemIndex: 0 });
});

test('walks through all 39 items across all 8 sections in exact order, self-assessing regardless of what was typed, ending on an accurate summary', async ({ page }) => {
  test.setTimeout(90_000);
  await seedAnamnesisSession(page, 'rintakipu', { sessionId: 'full-walk' });
  const items = await anamnesisItems(page);
  expect(items).toHaveLength(39);
  const cases = await page.evaluate(() => JSON.parse(document.getElementById('anamnesis-cases-data')!.textContent!));
  const sectionStarts = new Set(sectionsOf(cases[0].sections));
  const sectionNames: string[] = cases[0].sections.flatMap((section: { nameFi: string; items: unknown[] }) => Array(section.items.length).fill(section.nameFi));

  for (let index = 0; index < items.length; index += 1) {
    await expect(page.locator('#clinical-progress')).toHaveText(`Kysymys ${index + 1} / 39`);
    await expect(page.locator('#clinical-transcript')).toContainText(items[index]!.patientSv);
    await expect(page.locator('#anamnesis-section-position')).toContainText(sectionNames[index]!);
    if (sectionStarts.has(index) && index > 0) expect(await page.evaluate(() => document.activeElement?.id)).toBe('anamnesis-section-position');

    // Deliberately not the real model question: self-assessment must not depend on what was typed.
    await page.locator('#anamnesis-input').fill('Min egen fråga.');
    await expect(page.getByRole('button', { name: 'Näytä mallikysymys' })).toBeEnabled();
    await page.getByRole('button', { name: 'Näytä mallikysymys' }).click();
    await expect(page.locator('#clinical-transcript')).toContainText('Min egen fråga.');
    for (const question of items[index]!.modelQuestionsSv) await expect(page.locator('#clinical-transcript')).toContainText(question);
    await expect(page.locator('#clinical-transcript .bubble-caption').nth(1)).toHaveText(items[index]!.modelQuestionsSv.length > 1 ? 'Mallikysymykset:' : 'Mallikysymys:');

    const knew = index % 2 === 0;
    await page.getByRole('button', { name: knew ? 'Osasin' : 'En osannut' }).click();
    const isLast = index === items.length - 1;
    await expect(page.locator('#anamnesis-continue')).toHaveText(isLast ? 'Näytä yhteenveto' : 'Jatka');
    await page.locator('#anamnesis-continue').click();
    // XP, levels, and achievements accumulate across 39 items, so a milestone celebration can
    // interrupt at any point (not just at the very end) and must be dismissed before continuing.
    await continuePastMilestone(page);
  }

  await expect(page.getByRole('heading', { name: 'Valmis', exact: true })).toBeFocused();
  await expect(page.locator('#clinical-summary-knew')).toHaveText('20');
  await expect(page.locator('#clinical-summary-missed')).toHaveText('19');
  await expect(page.locator('#clinical-rewards')).toContainText('XP');
  const finished = await readSession(page);
  expect(Object.keys(finished.resultsByItem)).toHaveLength(39);

  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);

  const before = await readSession(page);
  await page.getByRole('button', { name: 'Uusi kierros' }).click();
  const fresh = await readSession(page);
  expect(fresh.sessionId).not.toBe(before.sessionId);
  expect(fresh).toMatchObject({ caseId: 'rintakipu', currentItemIndex: 0, currentRevealed: false, currentSelfAssessment: null, resultsByItem: {} });
});

test('reload preserves the exact item and in-progress state, whether drafting, revealed, or already self-assessed', async ({ page }) => {
  await seedAnamnesisSession(page, 'rintakipu', { sessionId: 'reload-draft' });
  await page.locator('#anamnesis-input').fill('Ett halvfärdigt utkast');
  await expect.poll(async () => (await readSession(page)).currentDraftAnswer).toBe('Ett halvfärdigt utkast');
  await page.reload();
  await expect(page.locator('#anamnesis-input')).toHaveValue('Ett halvfärdigt utkast');

  await seedAnamnesisSession(page, 'rintakipu', {
    sessionId: 'reload-revealed', currentItemIndex: 2, currentDraftAnswer: 'Var i bröstet?', currentRevealed: true,
    resultsByItem: { 'rintakipu-01': 'knew', 'rintakipu-02': 'did-not-know' },
  });
  await expect(page.locator('#anamnesis-actions')).toBeVisible();
  await expect(page.locator('#clinical-transcript')).toContainText('Var i bröstet?');
  await page.reload();
  await expect(page.locator('#clinical-progress')).toHaveText('Kysymys 3 / 39');
  await expect(page.locator('#anamnesis-did-not-know')).toBeVisible();
  await expect(page.locator('#anamnesis-knew')).toBeVisible();

  await page.getByRole('button', { name: 'Osasin' }).click();
  await expect(page.locator('#anamnesis-continue')).toBeVisible();
  const beforeReload = await readSession(page);
  await page.reload();
  const afterReload = await readSession(page);
  expect(afterReload.currentSelfAssessment).toBe(beforeReload.currentSelfAssessment);
  await expect(page.getByRole('button', { name: 'Jatka' })).toBeFocused();
});

test('completing an item counts once toward the daily goal and XP, and sets the last-used mode, without touching flashcard word stats', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await seedAnamnesisSession(page, 'rintakipu', { sessionId: 'progress-1' });
  await page.locator('#anamnesis-input').fill('Vad har ni för besvär?');
  await page.getByRole('button', { name: 'Näytä mallikysymys' }).click();
  await page.getByRole('button', { name: 'Osasin' }).click();
  await page.locator('#anamnesis-continue').click();
  await continuePastMilestone(page);

  const progress = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  expect(progress.lastUsedMode).toBe('clinical');
  expect(progress.lifetime.xp).toBeGreaterThan(0);
  const todayKey = Object.keys(progress.daily).sort().at(-1)!;
  const today = progress.daily[todayKey] as { uniqueItemIds: string[]; modes: string[] };
  expect(today.uniqueItemIds).toContain('clinical:rintakipu-01');
  expect(today.modes).toContain('clinical');
  const wordStats = await page.evaluate(() => localStorage.getItem('medicinsk-svenska.word-stats.v1'));
  expect(wordStats).toBeNull();
});

test('stale sessions fail safely: the retired key is cleaned up, corrupted state self-heals, and an unknown case shows the not-found state', async ({ page }) => {
  await page.goto('/tilanteet');
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, mode: 'all', selectedScenarioIds: ['x'] })), RETIRED_KEY);
  await page.goto('/tilanteet/harjoitus?case=rintakipu&session=cleanup-check');
  await waitForAnamnesisSession(page);
  expect(await page.evaluate((key) => localStorage.getItem(key), RETIRED_KEY)).toBeNull();

  await page.evaluate((key) => localStorage.setItem(key, '{broken'), ANAMNESIS_STORAGE_KEY);
  await page.goto('/tilanteet/harjoitus?case=rintakipu&session=corrupt-check');
  await expect(page.locator('#clinical-progress')).toHaveText('Kysymys 1 / 39');
  const healed = await readSession(page);
  expect(healed.sessionId).toBe('corrupt-check');

  await page.goto('/tilanteet/harjoitus?case=unknown-case');
  await expect(page.getByRole('heading', { name: 'Tilannetta ei löytynyt' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Takaisin tilanteisiin' })).toBeVisible();
  // An unrelated bad request must not clobber whatever valid session already existed.
  expect(await page.evaluate((key) => localStorage.getItem(key), ANAMNESIS_STORAGE_KEY)).not.toBeNull();

  await page.goto('/tilanteet/harjoitus?case=rintakipu');
  const generatedId = new URL(page.url()).searchParams.get('session');
  expect(generatedId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._~-]+$/);
  const generated = await waitForAnamnesisSession(page);
  expect(generated.sessionId).toBe(generatedId);
  expect(generated.currentItemIndex).toBe(0);
});

test('routes, payload, header, touch targets, and narrow layouts are accessible', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 700 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/tilanteet');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.evaluate((key) => localStorage.removeItem(key), ANAMNESIS_STORAGE_KEY);
    await page.getByRole('link', { name: /Rintakipu/ }).click();
    await expect(page).toHaveURL(/\/tilanteet\/harjoitus/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const inputBox = await page.locator('#anamnesis-input').boundingBox();
    expect(inputBox?.height).toBeGreaterThanOrEqual(44);
    const revealBox = await page.getByRole('button', { name: 'Näytä mallikysymys' }).boundingBox();
    expect(revealBox?.height).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);

    await page.locator('#anamnesis-input').fill('Vad har ni för besvär?');
    await page.getByRole('button', { name: 'Näytä mallikysymys' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    for (const button of [page.getByRole('button', { name: 'En osannut' }), page.getByRole('button', { name: 'Osasin' })]) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  }
  const casePayload = JSON.parse((await page.locator('#anamnesis-cases-data').textContent())!);
  expect(casePayload.every((item: Record<string, unknown>) => Object.keys(item).every((key) => ['id', 'nameFi', 'sections'].includes(key)))).toBe(true);
  expect(await page.locator('html').innerText()).not.toContain('published');
});
