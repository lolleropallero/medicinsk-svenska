import { expect, test, type Locator, type Page } from '@playwright/test';
import { openSpecificCard } from './helpers';

const rejectedLabels = ['Suomi', 'Svenska', 'Suomeksi', 'Ruotsiksi'];

async function expectNoVisibleLanguageLabels(scope: Page | Locator) {
  for (const label of rejectedLabels) await expect(scope.getByText(label, { exact: true })).toHaveCount(0);
}

test('flashcards use language metadata without decorative flag ribbons', async ({ page }) => {
  for (const direction of ['fi-sv', 'sv-fi'] as const) {
    await openSpecificCard(page, { id: 'anatomi-004', deckId: 'anatomi' }, direction);
    const sourceLanguage = direction === 'fi-sv' ? 'fi' : 'sv';
    const targetLanguage = direction === 'fi-sv' ? 'sv' : 'fi';
    const front = page.locator('#front-term');
    const back = page.locator('#back-term');

    await expectNoVisibleLanguageLabels(page.locator('#flashcard-app'));
    await expect(page.locator('#flashcard .language-ribbon')).toHaveCount(0);
    await expect(page.locator('#flashcard img')).toHaveCount(0);
    await expect(front).toHaveAttribute('lang', sourceLanguage);
    await expect(back).toHaveAttribute('lang', targetLanguage);
    await expect(page.locator('#answer-area')).toBeHidden();
    await expect(back).toBeHidden();

    await page.getByRole('button', { name: 'Näytä vastaus' }).click();
    await expectNoVisibleLanguageLabels(page.locator('#flashcard-app'));
    await expect(front).toHaveAttribute('lang', sourceLanguage);
    await expect(back).toHaveAttribute('lang', targetLanguage);
    await expect(back).toBeVisible();
    await expect(page.locator('#flashcard .language-ribbon')).toHaveCount(0);
    await expect(page.locator('#flashcard img')).toHaveCount(0);
  }
});

test('phrases use language metadata without decorative flag ribbons', async ({ page }) => {
  await page.goto('/fraasit/harjoitus?mode=all&amount=10&session=language-markers-phrases');
  const cue = page.locator('.speech-bubble.cue');
  const answer = page.locator('.speech-bubble.target');

  await expectNoVisibleLanguageLabels(page.locator('.phrase-practice'));
  await expect(page.locator('.phrase-card .language-ribbon, .phrase-card img')).toHaveCount(0);
  await expect(page.locator('#phrase-fi')).toHaveAttribute('lang', 'fi');
  await expect(page.locator('#phrase-sv')).toHaveAttribute('lang', 'sv');
  await expect(page.locator('#phrase-sv')).toBeHidden();

  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await expectNoVisibleLanguageLabels(page.locator('.phrase-practice'));
  await expect(page.locator('#phrase-fi')).toBeVisible();
  await expect(page.locator('#phrase-sv')).toBeVisible();
  expect(await cue.evaluate(element => getComputedStyle(element).backgroundColor))
    .not.toBe(await answer.evaluate(element => getComputedStyle(element).backgroundColor));
});

test('description exercise keeps Swedish in metadata without a decorative flag ribbon', async ({ page }) => {
  await page.goto('/kuvailu/harjoitus?mode=all&amount=10&session=language-markers-description');

  await expectNoVisibleLanguageLabels(page.locator('.description-practice'));
  await expect(page.locator('.description-card .language-ribbon, .description-card img')).toHaveCount(0);
  await expect(page.locator('#description-text')).toHaveAttribute('lang', 'sv');
  await expect(page.getByLabel('Vastauksesi')).toHaveAttribute('lang', 'sv');
  await expect(page.getByRole('button', { name: 'Tarkista' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Näytä vastaus' })).toBeVisible();

  await page.getByRole('button', { name: 'Näytä vastaus' }).click();
  await expectNoVisibleLanguageLabels(page.locator('.description-practice'));
  await expect(page.locator('#canonical-answer')).toHaveAttribute('lang', 'sv');
  await expect(page.locator('#canonical-answer')).toBeVisible();
  await expect(page.getByText('Vastaus näytetty', { exact: true })).toBeVisible();
  const swedishIds = await page.locator('[lang="sv"]').evaluateAll(elements => elements.map(element => element.id).filter(Boolean));
  expect(new Set(swedishIds)).toEqual(new Set(['description-text', 'answer', 'canonical-answer']));
});
