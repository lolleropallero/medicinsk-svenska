import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { WORD_STATS_KEY } from '../../src/lib/vocabulary-stats';
import { continuePastMilestone } from './helpers';

const EXAM_KEY = 'medicinsk-svenska.exam-session.v1';
const GENERAL_KEY = 'medicinsk-svenska.flashcard-session.v1';

test('home opens one exam collection with all six source topics', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Stäng dagens uppdrag' }).click();
  await page.getByRole('link', { name: /Ruotsin tenttisanasto/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ruotsin tenttisanasto');
  await expect(page.locator('.setup-heading .eyebrow')).toHaveText('6 sanalistaa · 518 korttia');
  for (const [name, count] of [['Anatomia', 136], ['Sairaudet ja vaivat', 138], ['Sydänsairaudet', 47], ['Anamneesi', 70], ['Tutkiminen', 49], ['Epikriisi', 78]]) {
    const row = page.locator('.deck-row').filter({ has: page.getByRole('heading', { name: String(name), exact: true }) });
    await expect(row.locator('.deck-count')).toHaveText(`${count} korttia`);
  }
  await page.getByLabel('Kaikki', { exact: true }).check();
  await page.getByRole('link', { name: /Koko tenttisanasto/ }).click();
  await expect(page).toHaveURL(/\/tentti\/harjoitus\?mode=lucky/);
  await expect(page.locator('#session-label')).toHaveText('Koko tenttisanasto');
  await expect(page.locator('#progress')).toHaveText('0 / 518');
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), EXAM_KEY);
  expect(new Set(state.selectedCardIds).size).toBe(518);
  expect(state.selectedCardIds.every((id: string) => id.startsWith('tenttisanasto-'))).toBe(true);
});

test('source languages, original notation and reveal state survive reload in both directions', async ({ page }) => {
  for (const [deck, firstId, fi, sv] of [
    ['anatomi', 'tenttisanasto-anatomi-001', 'pää', 'ett huvud 5'],
    ['tentti-epikriisi', 'tenttisanasto-tentti-epikriisi-001', 'hoitoaika', 'vårdtid, -en'],
  ]) {
    for (const direction of ['fi-sv', 'sv-fi']) {
      await page.goto(`/tentti/harjoitus?mode=deck&answer=cards&deck=${deck}&direction=${direction}&amount=10&session=exam-${deck}-${direction}`);
      await page.evaluate(({ key, id }) => {
        const state = JSON.parse(localStorage.getItem(key)!);
        state.selectedCardIds = [id]; state.currentCardId = id; state.unseenCardQueue = [];
        localStorage.setItem(key, JSON.stringify(state));
      }, { key: EXAM_KEY, id: firstId });
      await page.reload();
      await expect(page.locator('#front-term')).toHaveText(direction === 'fi-sv' ? fi! : sv!);
      await expect(page.locator('#front-term')).toHaveAttribute('lang', direction === 'fi-sv' ? 'fi' : 'sv');
      await expect(page.locator('#answer-area')).toBeHidden();
      await page.getByRole('button', { name: 'Näytä vastaus' }).click();
      await expect(page.locator('#back-term')).toHaveText(direction === 'fi-sv' ? sv! : fi!);
      await page.reload();
      await expect(page.locator('#answer-area')).toBeVisible();
      await expect(page.getByRole('button', { name: 'En osannut' })).toBeFocused();
    }
  }
});

test('En osannut records a missed exam card and reopens it for review in the selected direction', async ({ page }) => {
  await page.goto('/tentti/');
  await expect(page.locator('[data-review-cta]')).toBeHidden();
  await expect(page.locator('[data-review-empty]')).toContainText('En osannut -kertaus on vielä tyhjä');
  await page.locator('[data-deck="tentti-tutkiminen"]').click();
  await expect(page.locator('#progress')).toHaveText('0 / 25');
  const missed = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    const cards = JSON.parse(document.getElementById('cards-data')!.textContent!) as { id: string; sv: string }[];
    return cards.find((card) => card.id === state.currentCardId)!;
  }, EXAM_KEY);
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'En osannut' }).click();
  await page.getByRole('link', { name: 'Takaisin', exact: true }).click();
  const review = page.locator('[data-review-cta]');
  await expect(review).toBeVisible();
  await expect(review.locator('[data-review-count]')).toHaveText('1 sana');
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  await page.getByLabel('Ruotsi → suomi').check();
  await page.getByLabel('Kaikki', { exact: true }).check();
  await review.click();
  await expect(page).toHaveURL(/\/tentti\/harjoitus\?mode=review&answer=cards&direction=sv-fi&amount=all/);
  await expect(page.locator('#session-label')).toHaveText('En osannut');
  await expect(page.locator('#front-term')).toHaveText(missed.sv);
  await page.reload();
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), EXAM_KEY);
  expect(state.selectedCardIds).toEqual([missed.id]);
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'Osasin', exact: true }).click();
  const milestone = page.getByRole('button', { name: 'Fortsätt' });
  if (await milestone.isVisible()) await milestone.click();
  await expect(page.locator('#summary-view')).toBeVisible();
  await expect(page.locator('#review-complete')).toHaveText('Kertauslista on nyt tyhjä.');
  await expect(page.getByRole('button', { name: 'Uusi kierros' })).toBeHidden();
  await page.reload();
  await expect(page.locator('#summary-view')).toBeVisible();
  await expect(page.locator('#review-complete')).toBeVisible();
  await page.getByRole('link', { name: 'Takaisin tenttisanastoon', exact: true }).click();
  await expect(page.locator('[data-review-cta]')).toBeHidden();
  await expect(page.locator('[data-review-empty]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-review-cta]')).toBeHidden();
});

test('exam review immediately drops first-attempt successes but keeps a missed card after a correct retry', async ({ page }) => {
  await page.goto('/tentti/');
  await page.evaluate((key) => {
    const ids = (JSON.parse(document.getElementById('cards-data-ids')!.textContent!) as string[]).slice(0, 2);
    const now = Date.now();
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, cards: Object.fromEntries(ids.map(id => [id, { attempts: 1, incorrect: 1, correctStreak: 0, lastAttemptAt: now, lastIncorrectAt: now }])) }));
  }, WORD_STATS_KEY);
  await page.reload();
  await page.locator('[data-review-cta]').click();
  await expect(page.locator('#progress')).toHaveText('0 / 2');
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'Osasin', exact: true }).click();
  await continuePastMilestone(page);
  await page.getByRole('link', { name: 'Takaisin', exact: true }).click();
  await expect(page.locator('[data-review-count]')).toHaveText('1 sana');
  await page.locator('[data-review-cta]').click();
  await expect(page.locator('#progress')).toHaveText('0 / 1');
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'En osannut' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'Osasin', exact: true }).click();
  await continuePastMilestone(page);
  await expect(page.locator('#summary-view')).toBeVisible();
  await expect(page.locator('#review-complete')).toBeHidden();
  await page.getByRole('button', { name: 'Uusi kierros' }).click();
  await expect(page.locator('#progress')).toHaveText('0 / 1');
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'Osasin', exact: true }).click();
  await continuePastMilestone(page);
  await expect(page.locator('#review-complete')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Uusi kierros' })).toBeHidden();
});

test('exam review excludes unrelated, removed and mastered cards and honors both limited and all amounts', async ({ page }) => {
  await page.goto('/tentti/');
  const expectedIds = await page.evaluate((key) => {
    const ids = JSON.parse(document.getElementById('cards-data-ids')!.textContent!) as string[];
    const now = Date.now();
    const missed = { attempts: 1, incorrect: 1, correctStreak: 0, lastAttemptAt: now, lastIncorrectAt: now };
    const cards = Object.fromEntries([...ids, 'mediciner-001', 'tenttisanasto-anatomi-132', 'tenttisanasto-tentti-sydansairaudet-004', 'tenttisanasto-tentti-sydansairaudet-044', 'tenttisanasto-tentti-tutkiminen-011'].map((id) => [id, missed]));
    cards[ids[0]!] = { ...missed, attempts: 6, correctStreak: 5 };
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, cards }));
    return ids.slice(1);
  }, WORD_STATS_KEY);
  await page.reload();
  await expect(page.locator('[data-review-count]')).toHaveText('517 sanaa');
  await page.getByLabel('10', { exact: true }).check();
  await page.locator('[data-review-cta]').click();
  await expect(page.locator('#progress')).toHaveText('0 / 10');
  let state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), EXAM_KEY);
  expect(state.selectedCardIds).toHaveLength(10);
  expect(state.selectedCardIds.every((id: string) => expectedIds.includes(id))).toBe(true);
  await page.getByRole('link', { name: 'Takaisin', exact: true }).click();
  await page.getByLabel('Kaikki', { exact: true }).check();
  await page.locator('[data-review-cta]').click();
  await expect(page.locator('#progress')).toHaveText('0 / 517');
  state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), EXAM_KEY);
  expect(new Set(state.selectedCardIds)).toEqual(new Set(expectedIds));
});

test('exam retries, completion and new round retain their scope without overwriting general practice', async ({ page }) => {
  await page.goto('/kortit/harjoitus?mode=deck&deck=mediciner&direction=fi-sv&amount=10&session=general-preserved');
  const general = await page.evaluate((key) => localStorage.getItem(key), GENERAL_KEY);
  await page.goto('/tentti/');
  await page.getByLabel('Ruotsi → suomi').check();
  await page.getByLabel('10', { exact: true }).check();
  await page.locator('[data-deck="tentti-tutkiminen"]').click();
  await expect(page.locator('#progress')).toHaveText('0 / 10');
  const firstSessionId = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.selectedCardIds = [state.currentCardId]; state.unseenCardQueue = [];
    localStorage.setItem(key, JSON.stringify(state));
    return state.sessionId;
  }, EXAM_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'En osannut' }).click();
  await expect(page.locator('#answer-area')).toBeHidden();
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.getByRole('button', { name: 'Osasin', exact: true }).click();
  const milestone = page.getByRole('button', { name: 'Fortsätt' });
  if (await milestone.isVisible()) await milestone.click();
  await expect(page.locator('#summary-view')).toBeVisible();
  await expect(page.locator('#summary-missed')).toHaveText('1');
  await page.getByRole('button', { name: 'Uusi kierros' }).click();
  await expect(page).toHaveURL(/\/tentti\/harjoitus\?/);
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), EXAM_KEY);
  expect(state.sessionId).not.toBe(firstSessionId);
  expect(state.direction).toBe('sv-fi');
  expect(state.selectedCardIds).toHaveLength(10);
  expect(state.selectedCardIds.every((id: string) => id.startsWith('tenttisanasto-tentti-tutkiminen-'))).toBe(true);
  expect(await page.evaluate((key) => localStorage.getItem(key), GENERAL_KEY)).toBe(general);
  await page.getByRole('link', { name: 'Takaisin', exact: true }).click();
  await expect(page).toHaveURL(/\/tentti\/?$/);
});

test('general anatomy uses the source deck and exam rejects unrelated decks', async ({ page }) => {
  await page.goto('/kortit');
  await page.getByLabel('Kirjoita', { exact: true }).check();
  const anatomy = page.locator('[data-deck="anatomi"]');
  await expect(anatomy).toContainText('136 korttia');
  await anatomy.click();
  await expect(page).toHaveURL(/answer=cards/);
  const cards = await page.locator('#cards-data').textContent();
  expect(JSON.parse(cards!).filter((card: { deckId: string }) => card.deckId === 'anatomi')).toHaveLength(136);
  await page.goto('/tentti/harjoitus?mode=deck&deck=mediciner&direction=fi-sv&amount=10');
  await expect(page.locator('#error-view')).toBeVisible();
  await page.getByRole('link', { name: 'Takaisin tenttisanastoon' }).click();
  await expect(page).toHaveURL(/\/tentti\/?$/);
});

test('exam setup and long source phrases fit narrow phones and have no serious accessibility issues', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/tentti');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  let violations = (await new AxeBuilder({ page }).analyze()).violations;
  expect(violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  await page.locator('[data-deck="tentti-epikriisi"]').click();
  await expect(page.locator('#progress')).toHaveText('0 / 25');
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    const cards = JSON.parse(document.getElementById('cards-data')!.textContent!) as { id: string; deckId: string; sv: string }[];
    const longest = cards.filter((card) => card.deckId === state.sourceDeckId).sort((a, b) => b.sv.length - a.sv.length)[0]!;
    state.selectedCardIds = [longest.id]; state.currentCardId = longest.id; state.unseenCardQueue = [];
    localStorage.setItem(key, JSON.stringify(state));
  }, EXAM_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const controls = await page.locator('#grade-actions').boundingBox();
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(568);
  violations = (await new AxeBuilder({ page }).analyze()).violations;
  expect(violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});
