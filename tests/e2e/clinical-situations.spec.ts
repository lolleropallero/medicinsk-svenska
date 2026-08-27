import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { answerCurrentClinicalStep, CLINICAL_STORAGE_KEY, continuePastMilestone, seedClinicalSession } from './helpers';

const PROGRESS_KEY = 'medicinsk-svenska.progress.v1';
const readSession = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), CLINICAL_STORAGE_KEY);
// Astro's client-side navigation resolves the URL before the page script has finished writing its
// first session to storage, so callers that just navigated must wait for the key to exist.
async function waitForClinicalSession(page: Page) {
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) !== null, CLINICAL_STORAGE_KEY)).toBe(true);
  return readSession(page);
}

test('landing, navigation, and setup expose eleven category links plus a mixed all-situations link', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Stäng dagens uppdrag' }).click();
  await expect(page.getByRole('link', { name: 'Kliiniset tilanteet' })).toBeVisible();
  await page.getByRole('link', { name: 'Kliiniset tilanteet' }).click();
  await expect(page.getByRole('heading', { name: 'Kliiniset tilanteet' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Tilanteiden määrä' }).getByLabel('5')).toBeChecked();
  await expect(page.locator('.category-row')).toHaveCount(11);
  const expected = [['Esitiedot', '3 tilannetta'], ['Kipu', '3 tilannetta'], ['Toimenpiteeseen valmistautuminen', '2 tilannetta']] as const;
  for (const [name, count] of expected) {
    const row = page.locator('.category-row').filter({ hasText: name });
    expect(await row.evaluate((element) => element.tagName)).toBe('A');
    await expect(row.locator('a,button')).toHaveCount(0);
    await expect(row).toContainText(count);
  }
  await expect(page.getByRole('link', { name: /Kaikki tilanteet.*32 tilannetta/ })).toBeVisible();
  await page.locator('.category-row').filter({ hasText: 'Kipu' }).getByRole('heading').click();
  await expect(page).toHaveURL(/category=kipu/);
  const payload = JSON.parse((await page.locator('#clinical-scenarios-data').textContent())!) as { id: string; categoryId: string }[];
  const byId = new Map(payload.map((item) => [item.id, item.categoryId]));
  const session = await waitForClinicalSession(page);
  expect(session.selectedScenarioIds).toHaveLength(3);
  expect(session.selectedScenarioIds.every((id: string) => byId.get(id) === 'kipu')).toBe(true);
});

test('5, 10, and Kaikki select unique shuffled scenarios, and a small category uses its whole pool', async ({ page }) => {
  for (const [label, expected] of [['5', 5], ['10', 10], ['Kaikki', 32]] as const) {
    await page.goto('/tilanteet');
    await page.getByRole('group', { name: 'Tilanteiden määrä' }).locator('label').filter({ hasText: label }).click();
    await page.getByRole('link', { name: /Kaikki tilanteet/ }).click();
    const session = await waitForClinicalSession(page);
    const ids = session.selectedScenarioIds as string[];
    expect(ids).toHaveLength(expected);
    expect(new Set(ids).size).toBe(expected);
  }
  await page.goto('/tilanteet');
  await page.getByRole('group', { name: 'Tilanteiden määrä' }).locator('label').filter({ hasText: '10' }).click();
  await page.locator('.category-row').filter({ hasText: 'Toimenpiteeseen valmistautuminen' }).locator('.category-count').click();
  const smallCategory = await waitForClinicalSession(page);
  expect(smallCategory.selectedScenarioIds).toHaveLength(2);
});

test('a correct and an incorrect choice give distinct feedback, and resolved turns fold into the visible transcript as the canonical line', async ({ page }) => {
  await seedClinicalSession(page, ['tilanne-anamneesi-uusi-potilas-yleisesitiedot', 'tilanne-anamneesi-laakitys-ja-allergiat'], { sessionId: 'flow-1' });
  await expect(page.getByRole('heading', { name: 'Uuden potilaan yleisesitiedot' })).toBeVisible();
  await expect(page.locator('.clinical-turn-patient').last()).toContainText('Jag är ny patient här');
  await expect(page.locator('#clinical-step-position')).toHaveText('Vaihe 1 / 4');

  await answerCurrentClinicalStep(page, false);
  await expect(page.locator('#clinical-feedback')).toHaveAttribute('data-result', 'incorrect');
  await expect(page.locator('#clinical-feedback-label')).toHaveText('Ei aivan paras sanamuoto tähän kohtaan.');
  await expect(page.locator('#clinical-feedback-explanation')).toBeVisible();
  await expect(page.locator('#clinical-feedback-explanation')).toContainText('monikon toisella persoonalla');
  await expect(page.locator('[data-state="incorrect"]')).toHaveText('Hej. Vad är fel på dig?');
  await expect(page.locator('[data-state="model"]')).toHaveText('Hej och välkommen! Vad är orsaken till ert besök idag?');
  await expect(page.getByRole('button', { name: 'Jatka' })).toBeFocused();

  await page.getByRole('button', { name: 'Jatka' }).click();
  await expect(page.locator('#clinical-step-position')).toHaveText('Vaihe 2 / 4');
  // The step that was just resolved now reads as a clean, canonical exchange in the transcript.
  const turns = page.locator('.clinical-turn');
  await expect(turns.nth(0)).toContainText('Jag är ny patient här');
  await expect(turns.nth(1)).toContainText('Hej och välkommen! Vad är orsaken till ert besök idag?');
  await expect(page.locator('[data-state="incorrect"]')).toHaveCount(0);
  await expect(page.locator('[data-state="model"]')).toHaveCount(0);

  await answerCurrentClinicalStep(page, true);
  await expect(page.locator('#clinical-feedback')).toHaveAttribute('data-result', 'correct');
  await expect(page.locator('#clinical-feedback-label')).toHaveText('Hyvä, luonteva vastaus.');
  await expect(page.locator('#clinical-feedback-explanation')).toBeHidden();
});

test('a scenario ending shows a closing beat, offers the summary once every situation is done, and Uusi kierros starts a fresh retained round', async ({ page }) => {
  const done = (scenarioId: string, steps: number) => Object.fromEntries(
    Array.from({ length: steps }, (_, index) => [`${scenarioId}:step-${index + 1}`, { optionId: 'a', correct: true }]),
  );
  await seedClinicalSession(page, ['tilanne-toimenpide-haavan-ompelu', 'tilanne-toimenpide-kanyylin-laitto'], {
    sessionId: 'flow-2', categoryId: 'toimenpide', amount: 5,
    currentScenarioIndex: 1, currentStepIndex: 3,
    answers: { ...done('tilanne-toimenpide-haavan-ompelu', 4), ...done('tilanne-toimenpide-kanyylin-laitto', 3) },
  });
  await expect(page.locator('#clinical-step-position')).toHaveText('Vaihe 4 / 4');
  await answerCurrentClinicalStep(page, true);
  await expect(page.locator('#clinical-resolution')).toBeVisible();
  await expect(page.locator('#clinical-resolution-sv')).toHaveText('Tack, det gick faktiskt bättre än jag trodde!');
  await expect(page.locator('#clinical-resolution-fi')).toHaveText('Kanyyli on paikallaan, ja nestehoito voidaan aloittaa suunnitellusti.');
  await expect(page.getByRole('button', { name: 'Näytä yhteenveto' })).toBeVisible();
  await page.getByRole('button', { name: 'Näytä yhteenveto' }).click();
  await continuePastMilestone(page);

  await expect(page.getByRole('heading', { name: 'Valmis', exact: true })).toBeFocused();
  await expect(page.locator('#clinical-summary-flawless')).toHaveText('2 / 2');
  await expect(page.locator('#clinical-summary-steps')).toHaveText('8 / 8');
  await expect(page.locator('#clinical-rewards')).toBeVisible();
  await expect(page.locator('#clinical-rewards')).toContainText('XP');
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);

  const old = await readSession(page);
  await page.getByRole('button', { name: 'Uusi kierros' }).click();
  const fresh = await readSession(page);
  expect(fresh.sessionId).not.toBe(old.sessionId);
  expect(fresh).toMatchObject({ mode: 'category', sourceCategoryId: 'toimenpide', requestedAmount: 5, currentScenarioIndex: 0, currentStepIndex: 0, currentStepAnswer: null, answers: {} });
  expect(new URL(page.url()).searchParams.get('session')).toBe(fresh.sessionId);
});

test('reload preserves the exact step, both while awaiting an answer and while feedback is showing', async ({ page }) => {
  await seedClinicalSession(page, ['tilanne-kipu-alaselkakipu'], { sessionId: 'reload-1' });
  await expect(page.locator('#clinical-options button').first()).toBeVisible();
  await page.reload();
  await expect(page.locator('#clinical-scenario-title')).toHaveText('Alaselän kivun kartoitus');
  await expect(page.locator('#clinical-options button')).toHaveCount(3);

  await answerCurrentClinicalStep(page, false);
  const beforeReload = await readSession(page);
  await page.reload();
  const afterReload = await readSession(page);
  expect(afterReload.currentStepAnswer).toEqual(beforeReload.currentStepAnswer);
  await expect(page.locator('#clinical-feedback')).toHaveAttribute('data-result', 'incorrect');
  await expect(page.getByRole('button', { name: 'Jatka' })).toBeFocused();
});

test('invalid URLs, corrupted state, and cross-category tampering fail closed without persisting bad data', async ({ page }) => {
  await page.goto('/tilanteet/harjoitus?mode=category&category=missing&amount=5&session=bad');
  await expect(page.getByRole('heading', { name: 'Tilannetta ei löytynyt' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Takaisin tilanteisiin' })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), CLINICAL_STORAGE_KEY)).toBeNull();

  await page.goto('/tilanteet/harjoitus?mode=all&amount=7&session=bad-amount');
  await expect(page.getByRole('heading', { name: 'Tilannetta ei löytynyt' })).toBeFocused();

  await seedClinicalSession(page, ['tilanne-vatsa-akuutti-vatsakipu'], { sessionId: 'cross-category', categoryId: 'vatsa' });
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.selectedScenarioIds = ['tilanne-kipu-alaselkakipu'];
    localStorage.setItem(key, JSON.stringify(state));
  }, CLINICAL_STORAGE_KEY);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tilannetta ei löytynyt' })).toBeFocused();

  await page.goto('/tilanteet');
  await page.evaluate((key) => localStorage.setItem(key, '{broken'), CLINICAL_STORAGE_KEY);
  await page.goto('/tilanteet/harjoitus?mode=all&amount=5&session=corrupt-state');
  await expect(page.getByRole('heading', { name: 'Tilannetta ei löytynyt' })).toBeFocused();

  await page.goto('/tilanteet/harjoitus?mode=all&amount=5');
  const generatedId = new URL(page.url()).searchParams.get('session');
  expect(generatedId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._~-]+$/);
  const generated = await readSession(page);
  expect(generated.sessionId).toBe(generatedId);
  expect(generated.selectedScenarioIds).toHaveLength(5);
});

test('completing a situation counts once toward the daily goal and XP, and sets the last-used mode, without touching flashcard word stats', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await seedClinicalSession(page, ['tilanne-kipu-paansarky', 'tilanne-kipu-nivelkipu'], {
    sessionId: 'progress-1', categoryId: 'kipu', currentScenarioIndex: 0, currentStepIndex: 3, answers: {
      'tilanne-kipu-paansarky:step-1': { optionId: 'a', correct: true },
      'tilanne-kipu-paansarky:step-2': { optionId: 'a', correct: true },
      'tilanne-kipu-paansarky:step-3': { optionId: 'a', correct: true },
    },
  });
  await answerCurrentClinicalStep(page, true);
  await page.getByRole('button', { name: /Seuraava tilanne/ }).click();
  await continuePastMilestone(page);

  const progress = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  expect(progress.lastUsedMode).toBe('clinical');
  expect(progress.lifetime.xp).toBeGreaterThan(0);
  const todayKey = Object.keys(progress.daily).sort().at(-1)!;
  const today = progress.daily[todayKey] as { uniqueItemIds: string[]; modes: string[] };
  expect(today.uniqueItemIds).toContain('clinical:tilanne-kipu-paansarky');
  expect(today.modes).toContain('clinical');
  const wordStats = await page.evaluate(() => localStorage.getItem('medicinsk-svenska.word-stats.v1'));
  expect(wordStats).toBeNull();
});

test('routes, payload, header, touch targets, and narrow layouts are accessible', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 700 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/tilanteet');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    // Kliiniset tilanteet is reachable from the home launcher and desktop header nav; the mobile
    // bottom bar deliberately stays at its existing five items, so no bottom-nav link is expected here.
    await page.evaluate((key) => localStorage.removeItem(key), CLINICAL_STORAGE_KEY);
    await page.getByRole('link', { name: /Kaikki tilanteet/ }).click();
    await expect(page).toHaveURL(/\/tilanteet\/harjoitus/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    for (const option of await page.locator('#clinical-options button').all()) {
      const box = await option.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
    await answerCurrentClinicalStep(page, false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const continueBox = await page.getByRole('button', { name: 'Jatka' }).boundingBox();
    expect(continueBox?.height).toBeGreaterThanOrEqual(44);
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  }
  const scenarioPayload = JSON.parse((await page.locator('#clinical-scenarios-data').textContent())!);
  const categoryPayload = JSON.parse((await page.locator('#clinical-categories-data').textContent())!);
  expect(scenarioPayload.every((item: Record<string, unknown>) => Object.keys(item).every((key) => ['id', 'categoryId', 'titleFi', 'contextFi', 'steps', 'resolutionSv', 'resolutionFi'].includes(key)))).toBe(true);
  expect(categoryPayload.every((item: Record<string, unknown>) => Object.keys(item).every((key) => ['id', 'nameFi'].includes(key)))).toBe(true);
  expect(await page.locator('html').innerText()).not.toContain('published');
});
