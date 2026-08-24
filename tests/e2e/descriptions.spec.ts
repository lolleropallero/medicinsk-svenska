import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { continuePastMilestone } from './helpers';

const STORAGE_KEY = 'medicinsk-svenska.description-session.v1';

async function seedDescriptionSession(
  page: Page,
  options: { ids: string[]; sessionId?: string; mode?: 'all' | 'category'; categoryId?: string; startedAt?: number },
) {
  const sessionId = options.sessionId ?? 'seeded-description';
  const mode = options.mode ?? 'all';
  const query = new URLSearchParams({ mode, amount: '10', session: sessionId });
  if (mode === 'category') query.set('category', options.categoryId!);
  await page.goto(`/kuvailu/harjoitus?${query.toString()}`);
  await page.evaluate(({ key, ids, id, sourceMode, categoryId, startedAt }) => {
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      sessionId: id,
      sourceMode,
      ...(sourceMode === 'category' ? { sourceCategoryId: categoryId } : {}),
      requestedAmount: 10,
      roundType: 'initial',
      selectedExerciseIds: ids,
      currentIndex: 0,
      currentResolvedResult: null,
      currentDraftAnswer: '',
      resultsByExercise: {},
      startedAt: startedAt ?? Date.now(),
    }));
  }, { key: STORAGE_KEY, ids: options.ids, id: sessionId, sourceMode: mode, categoryId: options.categoryId, startedAt: options.startedAt });
  await page.reload();
}

test('setup lists all categories and starts from either whole semantic row area', async ({ page }) => {
  await page.goto('/kuvailu');
  const expected = [
    ['Solut, kudokset ja iho', '8 tehtävää'],
    ['Luusto, nivelet ja lihakset', '7 tehtävää'],
    ['Hermosto ja aistit', '7 tehtävää'],
    ['Verenkierto ja hengitys', '8 tehtävää'],
    ['Veri ja imunestejärjestelmä', '6 tehtävää'],
    ['Ruoansulatus ja virtsatiet', '7 tehtävää'],
    ['Lisääntyminen ja hormonit', '8 tehtävää'],
  ] as const;
  for (const [name, count] of expected) {
    const row = page.locator('.category-row').filter({ hasText: name });
    await expect(row).toContainText(count);
    expect(await row.evaluate((element) => element.tagName)).toBe('A');
    await expect(row.locator('a,button')).toHaveCount(0);
  }
  await expect(page.getByRole('link', { name: /Kaikki aiheet.*51 tehtävää/ })).toBeVisible();
  await page.locator('.category-row').filter({ hasText: 'Hermosto ja aistit' }).getByRole('heading').click();
  await expect(page).toHaveURL(/mode=category.*category=hermosto-aistit|category=hermosto-aistit.*mode=category/);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) !== null, STORAGE_KEY)).toBe(true);
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  const payload = JSON.parse((await page.locator('#descriptions-data').textContent())!);
  const byId = new Map(payload.map((item: {id:string;categoryId:string}) => [item.id, item.categoryId]));
  expect(state.selectedExerciseIds).toHaveLength(7);
  expect(state.selectedExerciseIds.every((id: string) => byId.get(id) === 'hermosto-aistit')).toBe(true);
});

test('all-topics sizes are unique and short categories use the complete pool', async ({ page }) => {
  for (const [label, expected] of [['10', 10], ['25', 25], ['50', 50], ['Kaikki', 51]] as const) {
    await page.goto('/kuvailu');
    await page.getByRole('group', { name: 'Tehtävien määrä' }).locator('label').filter({ hasText: label }).click();
    await page.getByRole('link', { name: /Kaikki aiheet/ }).click();
    await expect.poll(() => page.evaluate((key) => {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value).selectedExerciseIds.length : 0;
    }, STORAGE_KEY)).toBe(expected);
    const ids = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).selectedExerciseIds as string[], STORAGE_KEY);
    expect(ids).toHaveLength(expected);
    expect(new Set(ids).size).toBe(expected);
  }
  await page.goto('/kuvailu');
  await page.getByRole('group', { name: 'Tehtävien määrä' }).locator('label').filter({ hasText: '50' }).click();
  await page.locator('.category-row').filter({ hasText: 'Veri ja imunestejärjestelmä' }).locator('.category-count').click();
  await expect.poll(() => page.evaluate((key) => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value).selectedExerciseIds.length : 0;
  }, STORAGE_KEY)).toBe(6);
  const categoryIds = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).selectedExerciseIds as string[], STORAGE_KEY);
  expect(categoryIds).toHaveLength(6);
  expect(new Set(categoryIds).size).toBe(6);
});

test('absolute timer, draft, order, and focus survive controlled background time and reload', async ({ page }) => {
  const start = new Date('2026-05-01T09:00:00.000Z');
  await page.clock.install({ time: start });
  await page.goto('/kuvailu/harjoitus?mode=all&amount=10&session=persistence-clock');
  await expect(page.locator('#description-elapsed')).toHaveText('00:00');
  await expect(page.getByLabel('Vastauksesi')).toBeFocused();
  const initial = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  await page.getByLabel('Vastauksesi').fill('keskeneräinen vastaus');
  await page.clock.fastForward(5_000);
  await expect(page.locator('#description-elapsed')).toHaveText('00:05');
  await page.reload();
  await expect(page.getByLabel('Vastauksesi')).toHaveValue('keskeneräinen vastaus');
  await expect(page.getByLabel('Vastauksesi')).toBeFocused();
  const restored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(restored.selectedExerciseIds).toEqual(initial.selectedExerciseIds);
  expect(restored.startedAt).toBe(initial.startedAt);
  await page.clock.pauseAt(initial.startedAt + 65_000);
  await page.reload();
  await expect(page.locator('#description-elapsed')).toHaveText('01:05');
  await expect(page.locator('#description-elapsed')).toHaveAttribute('aria-label', 'Kulunut aika 01:05');
});

test('Swedish answer semantics and exact canonical, inflection, and article acceptance work with Enter', async ({ page }) => {
  await seedDescriptionSession(page, { ids: ['beskrivning-023'], mode: 'category', categoryId: 'verenkierto-hengitys' });
  await expect(page.locator('#description-text')).toHaveAttribute('lang', 'sv');
  const input = page.getByLabel('Vastauksesi');
  await expect(input).toHaveAttribute('lang', 'sv');
  await expect(input).toHaveAttribute('autocomplete', 'off');
  await expect(input).toHaveAttribute('autocapitalize', 'none');
  await expect(input).toHaveAttribute('spellcheck', 'false');
  await expect(input).toHaveAttribute('enterkeyhint', 'done');
  await input.fill('HJÄRTAT.');
  await input.press('Enter');
  await continuePastMilestone(page);
  await expect(page.locator('#result-label')).toHaveText('Oikein');
  await expect(page.locator('#canonical-answer')).toHaveText('ett hjärta');
  await expect(page.getByRole('button', { name: 'Seuraava' })).toBeFocused();

  await seedDescriptionSession(page, { ids: ['beskrivning-023'], sessionId: 'correct-article', mode: 'category', categoryId: 'verenkierto-hengitys' });
  await input.fill('ett hjärta');
  await input.press('Enter');
  await continuePastMilestone(page);
  await expect(page.locator('#result-label')).toHaveText('Oikein');

  for (const [sessionId, answer] of [['wrong-article', 'en hjärta'], ['definite-article', 'ett hjärtat']] as const) {
    await seedDescriptionSession(page, { ids: ['beskrivning-023'], sessionId, mode: 'category', categoryId: 'verenkierto-hengitys' });
    await page.getByLabel('Vastauksesi').fill(answer);
    await page.getByLabel('Vastauksesi').press('Enter');
    await expect(page.getByText('Ei aivan', { exact: true })).toBeVisible();
  }
});

test('incorrect and revealed resolution restore feedback and focus without double submission', async ({ page }) => {
  await seedDescriptionSession(page, { ids: ['beskrivning-038', 'beskrivning-040'], mode: 'category', categoryId: 'ruoansulatus-virtsatiet' });
  await page.getByLabel('Vastauksesi').fill('maksa');
  await page.getByRole('button', { name: 'Tarkista' }).click();
  await continuePastMilestone(page);
  await expect(page.getByText('Ei aivan', { exact: true })).toBeVisible();
  await expect(page.locator('#canonical-answer')).toHaveText('en lever');
  await page.reload();
  await expect(page.getByText('Ei aivan', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seuraava' })).toBeFocused();
  await expect(page.getByLabel('Vastauksesi')).toBeHidden();
  await page.getByRole('button', { name: 'Seuraava' }).click();
  await expect(page.getByLabel('Vastauksesi')).toBeFocused();
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await continuePastMilestone(page);
  await expect(page.getByText('Vastaus näytetty', { exact: true })).toBeVisible();
  await expect(page.locator('#canonical-answer')).toHaveText('njurar');
  await expect(page.getByRole('button', { name: 'Seuraava' })).toBeFocused();
});

test('summary, retry, and new round use fresh persisted session state', async ({ page }) => {
  await page.addInitScript(() => { let value = 0; Math.random = () => { value = (value + 0.173) % 1; return value; }; });
  const start = new Date('2026-06-01T10:00:00.000Z');
  await page.clock.install({ time: start });
  await seedDescriptionSession(page, { ids: ['beskrivning-023', 'beskrivning-027', 'beskrivning-030'], startedAt: start.getTime() });
  await page.getByLabel('Vastauksesi').fill('hjärta');
  await page.getByRole('button', { name: 'Tarkista' }).click();
  await continuePastMilestone(page);
  await page.getByRole('button', { name: 'Seuraava' }).click();
  await page.getByLabel('Vastauksesi').fill('fel');
  await page.getByRole('button', { name: 'Tarkista' }).click();
  await continuePastMilestone(page);
  await page.getByRole('button', { name: 'Seuraava' }).click();
  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await page.clock.fastForward(258_000);
  await page.getByRole('button', { name: 'Seuraava' }).click();
  await expect(page.getByRole('heading', { name: 'Valmis', exact: true })).toBeFocused();
  await expect(page.locator('#description-summary-correct')).toHaveText('1 / 3');
  await expect(page.locator('#description-summary-errors')).toHaveText('2');
  await expect(page.locator('#description-summary-time')).toHaveText(/^04:(?:1[89]|2[0-5])$/);
  const completed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);

  await page.getByRole('button', { name: 'Harjoittele virheet uudelleen' }).click();
  const retry = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(retry.sessionId).not.toBe(completed.sessionId);
  expect(retry.roundType).toBe('retry');
  expect(new Set(retry.selectedExerciseIds)).toEqual(new Set(['beskrivning-027', 'beskrivning-030']));
  expect(retry.resultsByExercise).toEqual({});
  await expect(page.getByLabel('Vastauksesi')).toBeFocused();
  await page.reload();
  expect((await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY)).selectedExerciseIds).toEqual(retry.selectedExerciseIds);

  for (let index = 0; index < 2; index += 1) {
    await page.getByRole('button', { name: 'Näytä vastaus' }).click();
    await continuePastMilestone(page);
    await page.getByRole('button', { name: 'Seuraava' }).click();
    await continuePastMilestone(page);
  }
  const beforeNew = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  await page.clock.fastForward(1_000);
  await page.getByRole('button', { name: 'Uusi kierros' }).click();
  const fresh = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  expect(fresh.sessionId).not.toBe(beforeNew.sessionId);
  expect(fresh.startedAt).toBeGreaterThan(beforeNew.startedAt);
  expect(fresh).toMatchObject({ sourceMode: 'all', requestedAmount: 10, roundType: 'initial', currentIndex: 0, currentDraftAnswer: '', resultsByExercise: {} });
  expect(fresh.selectedExerciseIds).toHaveLength(10);
  await expect(page.getByLabel('Vastauksesi')).toBeFocused();
});

test('invalid category and missing retry state fail closed while corrupted category state is replaced safely', async ({ page }) => {
  await page.goto('/kuvailu/harjoitus?mode=category&category=missing&amount=10&session=invalid');
  await expect(page.getByRole('heading', { name: 'Harjoitusta ei löytynyt' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Takaisin kuvailutehtäviin' })).toBeVisible();
  await page.goto('/kuvailu/harjoitus?mode=all&amount=10&session=missing-retry&round=retry');
  await expect(page.getByRole('heading', { name: 'Harjoitusta ei löytynyt' })).toBeFocused();

  await seedDescriptionSession(page, { ids: ['beskrivning-016'], sessionId: 'wrong-category', mode: 'category', categoryId: 'solut-kudokset-iho' });
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
  const payload = JSON.parse((await page.locator('#descriptions-data').textContent())!);
  const byId = new Map(payload.map((item: {id:string;categoryId:string}) => [item.id, item.categoryId]));
  expect(state.selectedExerciseIds.every((id: string) => byId.get(id) === 'solut-kudokset-iho')).toBe(true);
});

test('description exercise is accessible and has no horizontal overflow or unreachable controls', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 700 }]) {
    await page.setViewportSize(viewport);
    await page.goto(`/kuvailu/harjoitus?mode=all&amount=10&session=responsive-${viewport.width}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const inputBox = await page.getByLabel('Vastauksesi').boundingBox();
    expect(inputBox?.height).toBeGreaterThanOrEqual(52);
    for (const name of ['Tarkista', 'Näytä vastaus']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(52);
      expect(box && box.y < viewport.height).toBe(true);
    }
  }
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  const swedish = await page.locator('[lang="sv"]').evaluateAll((elements) => elements.map((element) => element.id).filter(Boolean));
  expect(new Set(swedish)).toEqual(new Set(['description-text', 'answer', 'canonical-answer']));
});

test('portrait focus and normal scrolling keep the description input and actions usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/kuvailu/harjoitus?mode=all&amount=10&session=portrait-focus');const input=page.getByLabel('Vastauksesi');await expect(input).toBeFocused();await input.fill('keskeneräinen');
  await page.setViewportSize({width:390,height:500});await input.evaluate(element=>element.scrollIntoView({block:'center'}));const inputBox=await input.boundingBox(),checkBox=await page.getByRole('button',{name:'Tarkista'}).boundingBox();expect(inputBox&&inputBox.y>=0&&inputBox.y+inputBox.height<=500).toBe(true);expect(checkBox&&checkBox.y>=0&&checkBox.y+checkBox.height<=500).toBe(true);expect(await page.locator('.description-practice .action-row').evaluate(element=>getComputedStyle(element).position)).toBe('static');
  await page.getByRole('button',{name:'Näytä vastaus'}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeInViewport();await page.reload();await expect(input).toBeFocused();await expect(input).toHaveValue('keskeneräinen');await input.press('Enter');await expect(page.locator('#description-feedback')).toBeVisible();
});
