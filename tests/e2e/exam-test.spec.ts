import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { EXAM_TEST_STORAGE_KEY, type ExamTestSession, type ExamTestTerm } from '../../src/lib/exam-test-session';

const state = (page: import('@playwright/test').Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!) as ExamTestSession, EXAM_TEST_STORAGE_KEY);

test('Tee tentti opens fifty unique terms, balanced directions and all six source lists', async ({ page }) => {
  await page.goto('/tentti/');
  await page.getByRole('link', { name: /Tee tentti/ }).click();
  await expect(page.getByRole('heading', { name: 'Kirjoita ruotsiksi · 1 / 25' })).toBeVisible();
  await expect(page.locator('#exam-test-progress')).toHaveText('1 / 50');
  await expect(page.getByLabel('Vastauksesi')).toBeFocused();
  await expect(page.getByLabel('Vastauksesi')).toHaveAttribute('lang', 'sv');
  await expect(page.locator('.site-header,.mobile-navigation,#metagame-hud')).toHaveCount(0);
  const session = await state(page);
  expect(session.questions).toHaveLength(50);
  expect(new Set(session.questions.map((question) => question.termId)).size).toBe(50);
  const terms = JSON.parse((await page.locator('#exam-test-data').textContent())!) as ExamTestTerm[];
  const byId = new Map(terms.map((term) => [term.id, term]));
  for (const [index, half] of [session.questions.slice(0, 25), session.questions.slice(25)].entries()) {
    expect(half.every((question) => question.direction === (index === 0 ? 'fi-sv' : 'sv-fi'))).toBe(true);
    expect(new Set(half.flatMap((question) => byId.get(question.termId)!.topicIds)).size).toBe(6);
  }
  await expect(page.locator('#exam-test-instructions')).toContainText('ett barn 5');
  await expect(page.locator('#exam-test-summary')).toBeHidden();
});

test('drafts, questions, position and elapsed time persist without touching card practice', async ({ page }) => {
  await page.clock.install({ time: new Date('2030-03-01T09:00:00Z') });
  await page.goto('/tentti/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=preserved-practice');
  const practice = await page.evaluate(() => localStorage.getItem('medicinsk-svenska.exam-session.v1'));
  await page.goto('/tentti/koe/harjoitus/');
  const url = page.url();
  const before = await state(page);
  await page.getByLabel('Vastauksesi').fill('ett keskeneräinen 5');
  await page.getByRole('button', { name: 'Seuraava', exact: true }).click();
  await page.getByLabel('Vastauksesi').fill('toinen vastaus');
  await page.clock.runFor(65000);
  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(page.locator('#exam-test-progress')).toHaveText('2 / 50');
  await expect(page.getByLabel('Vastauksesi')).toHaveValue('toinen vastaus');
  await expect(page.locator('#exam-test-time')).toHaveText(/01:0[5-9]/);
  expect((await state(page)).questions).toEqual(before.questions);
  await page.getByRole('button', { name: 'Edellinen', exact: true }).click();
  await expect(page.getByLabel('Vastauksesi')).toHaveValue('ett keskeneräinen 5');
  expect(await page.evaluate(() => localStorage.getItem('medicinsk-svenska.exam-session.v1'))).toBe(practice);
});

test('a full exam checks listed classes, scores both languages and retains the submitted review', async ({ page }) => {
  await page.goto('/tentti/koe/harjoitus/');
  await expect(page.locator('#exam-test-progress')).toHaveText('1 / 50');
  const session = await state(page);
  const terms = JSON.parse((await page.locator('#exam-test-data').textContent())!) as ExamTestTerm[];
  const byId = new Map(terms.map((term) => [term.id, term]));
  const missingClassIndex = session.questions.slice(0, 25).findIndex((question) => /\b[1-5]\b/u.test(byId.get(question.termId)!.svAnswers[0]!));
  expect(missingClassIndex).toBeGreaterThanOrEqual(0);
  for (const [index, question] of session.questions.entries()) {
    const term = byId.get(question.termId)!;
    let answer = (question.direction === 'fi-sv' ? term.svAnswers : term.fiAnswers)[0]!;
    if (index === missingClassIndex) answer = answer.replace(/\s+[1-5]\b/u, '');
    if (index === 25) answer = 'väärä vastaus';
    if (index === 25) {
      await expect(page.getByRole('heading', { name: 'Kirjoita suomeksi · 1 / 25' })).toBeVisible();
      await expect(page.getByLabel('Vastauksesi')).toHaveAttribute('lang', 'fi');
      await page.getByRole('button', { name: 'Edellinen', exact: true }).click();
      await expect(page.locator('#exam-test-progress')).toHaveText('25 / 50');
      await page.getByRole('button', { name: 'Seuraava', exact: true }).click();
    }
    await page.getByLabel('Vastauksesi').fill(answer);
    await expect(page.locator('#exam-test-summary')).toBeHidden();
    await page.getByRole('button', { name: index === 49 ? 'Palauta tentti' : 'Seuraava', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Tentti valmis' })).toBeFocused();
  await expect(page.locator('#exam-test-total')).toHaveText('97 / 100');
  await expect(page.locator('#exam-test-swedish')).toHaveText('49 / 50');
  await expect(page.locator('#exam-test-finnish')).toHaveText('48 / 50');
  await expect(page.locator('#exam-test-results > li')).toHaveCount(50);
  await expect(page.locator('#exam-test-results > [data-result="incorrect"]')).toHaveCount(1);
  await expect(page.locator('#exam-test-results > [data-result="partial"]')).toHaveCount(1);
  await expect(page.locator('#exam-test-results > [data-result="partial"]')).toContainText('Termi: 1 / 1 p · Taivutusluokka: 0 / 1 p');
  await page.getByLabel('Näytä vain virheet').check();
  await expect(page.locator('#exam-test-results > li')).toHaveCount(2);
  const completed = await state(page);
  await page.reload();
  await expect(page.locator('#exam-test-total')).toHaveText('97 / 100');
  expect((await state(page)).completedAt).toBe(completed.completedAt);
  const oldUrl = page.url();
  await page.getByRole('button', { name: 'Tee uusi tentti' }).click();
  expect(page.url()).not.toBe(oldUrl);
  await expect(page.locator('#exam-test-progress')).toHaveText('1 / 50');
  await expect(page.getByLabel('Vastauksesi')).toBeEmpty();
  expect((await state(page)).completedAt).toBeNull();
});

test('invalid URLs fail closed and malformed browser sessions are safely recreated', async ({ page }) => {
  await page.goto('/tentti/koe/harjoitus/?session=bad%2Fid');
  await expect(page.getByRole('heading', { name: 'Tenttiä ei löytynyt' })).toBeVisible();
  await page.getByRole('link', { name: 'Takaisin tenttisanastoon' }).click();
  await page.getByRole('link', { name: /Tee tentti/ }).click();
  await expect(page.locator('#exam-test-progress')).toHaveText('1 / 50');
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, questions: [] })), EXAM_TEST_STORAGE_KEY);
  await page.reload();
  await expect(page.locator('#exam-test-progress')).toHaveText('1 / 50');
  expect((await state(page)).questions).toHaveLength(50);
});

test('exam and result review fit narrow phones and meet accessibility checks', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/tentti/koe/harjoitus/');
  await expect(page.getByLabel('Vastauksesi')).toBeVisible();
  const inputBounds = await page.getByLabel('Vastauksesi').boundingBox();
  expect(inputBounds!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const violations = (await new AxeBuilder({ page }).analyze()).violations;
  expect(violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  await page.evaluate((key) => {
    const session = JSON.parse(localStorage.getItem(key)!);
    session.completedAt = Date.now();
    localStorage.setItem(key, JSON.stringify(session));
  }, EXAM_TEST_STORAGE_KEY);
  await page.reload();
  await expect(page.locator('#exam-test-total')).toHaveText('0 / 100');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const reviewViolations = (await new AxeBuilder({ page }).analyze()).violations;
  expect(reviewViolations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
});
