import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  answerCurrentVocabularyCard,
  continuePastMilestone,
  currentExerciseSection,
  deckCardIds,
  seedFlashcardSession,
} from './helpers';

const FLASHCARD_STORAGE = 'medicinsk-svenska.flashcard-session.v1';

test('Sekoitus is offered alongside Kortit, Monivalinta, and Kirjoita and starts a working session', async ({ page }) => {
  await page.goto('/kortit/');
  const group = page.getByRole('group', { name: 'Harjoitustapa' });
  await expect(group.getByLabel('Kortit')).toBeChecked();
  await expect(group.getByLabel('Sekoitus')).toBeVisible();
  await group.locator('label').filter({ hasText: 'Sekoitus' }).click();
  await expect(group.getByLabel('Sekoitus')).toBeChecked();
  await page.locator('.deck-row').filter({ hasText: 'Anatomia' }).click();
  await expect(page).toHaveURL(/answer=mixed/);
  await expect(page.locator('#progress')).toHaveText('0 / 25');
  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FLASHCARD_STORAGE);
  expect(state.answerMode).toBe('mixed');
  expect(await currentExerciseSection(page)).not.toBeNull();
});

test('Sekoitus assigns each card a stable exercise type that varies across the session', async ({ page }) => {
  const sessionId = 'mixed-variety-1';
  await page.goto(`/kortit/harjoitus?mode=deck&answer=mixed&deck=anatomi&direction=fi-sv&amount=25&session=${sessionId}`);
  const ids = await deckCardIds(page, 'anatomi', 12);
  expect(ids).toHaveLength(12);

  const seenTypes = new Set<string>();
  for (const currentCardId of ids) {
    await seedFlashcardSession(page, `/kortit/harjoitus?mode=deck&answer=mixed&deck=anatomi&direction=fi-sv&amount=25&session=${sessionId}`, {
      sessionId, mode: 'deck', answerMode: 'mixed', sourceDeckId: 'anatomi', direction: 'fi-sv',
      requestedAmount: 25, selectedCardIds: ids, currentCardId,
    });
    const section = await currentExerciseSection(page);
    expect(section).not.toBeNull();
    seenTypes.add(section!);
  }
  expect(seenTypes.size).toBeGreaterThan(1);
});

test('a card resolved to Kortit inside Sekoitus is labeled, while a plain Kortit session shows no label', async ({ page }) => {
  const sessionId = 'mixed-tag-1';
  await page.goto(`/kortit/harjoitus?mode=deck&answer=mixed&deck=anatomi&direction=fi-sv&amount=25&session=${sessionId}`);
  const ids = await deckCardIds(page, 'anatomi', 30);

  let cardsCardId: string | null = null;
  for (const id of ids) {
    await seedFlashcardSession(page, `/kortit/harjoitus?mode=deck&answer=mixed&deck=anatomi&direction=fi-sv&amount=25&session=${sessionId}`, {
      sessionId, mode: 'deck', answerMode: 'mixed', sourceDeckId: 'anatomi', direction: 'fi-sv',
      requestedAmount: 25, selectedCardIds: ids, currentCardId: id,
    });
    if (await currentExerciseSection(page) === 'cards') { cardsCardId = id; break; }
  }
  expect(cardsCardId).not.toBeNull();
  await expect(page.locator('#flashcard-mode-tag')).toBeVisible();
  await expect(page.locator('#flashcard-mode-tag')).toHaveText('Kortit');

  await seedFlashcardSession(page, `/kortit/harjoitus?mode=deck&answer=cards&deck=anatomi&direction=fi-sv&amount=25&session=plain-cards-1`, {
    sessionId: 'plain-cards-1', mode: 'deck', answerMode: 'cards', sourceDeckId: 'anatomi', direction: 'fi-sv',
    requestedAmount: 25, selectedCardIds: ids, currentCardId: cardsCardId!,
  });
  await expect(page.locator('#flashcard')).toBeVisible();
  await expect(page.locator('#flashcard-mode-tag')).toBeHidden();
});

test('Sekoitus works in both language directions', async ({ page }) => {
  for (const direction of ['fi-sv', 'sv-fi'] as const) {
    await page.goto(`/kortit/harjoitus?mode=deck&answer=mixed&deck=laboratoriokokeet&direction=${direction}&amount=10&session=mixed-${direction}`);
    await expect(page.locator('#progress')).toHaveText('0 / 10');
    expect(await currentExerciseSection(page)).not.toBeNull();
    for (let i = 0; i < 3; i += 1) {
      await answerCurrentVocabularyCard(page, true);
      await continuePastMilestone(page);
    }
    const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FLASHCARD_STORAGE);
    expect(state.direction).toBe(direction);
    expect(state.masteredCardIds.length).toBeGreaterThanOrEqual(3);
  }
});

test('grading a full Sekoitus session reaches the same summary and retry mechanics as other modes', async ({ page }) => {
  await page.goto('/kortit/harjoitus?mode=deck&answer=mixed&deck=avdelningar&direction=fi-sv&amount=10&session=mixed-full-run');
  await answerCurrentVocabularyCard(page, false);
  await continuePastMilestone(page);
  const missedState = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FLASHCARD_STORAGE);
  expect(missedState.totalMissedCount).toBe(1);
  expect(missedState.pendingRetries).toHaveLength(1);

  for (let i = 0; i < 9; i += 1) {
    await answerCurrentVocabularyCard(page, true);
    await continuePastMilestone(page);
  }
  // The single miss is replayed immediately once the normal queue is exhausted — the existing retry behavior, unchanged by Sekoitus.
  await expect(page.locator('#waiting-view')).toBeHidden();
  await answerCurrentVocabularyCard(page, true);
  await continuePastMilestone(page);
  await expect(page.getByRole('heading', { name: 'Valmis', exact: true })).toBeVisible();
  const completed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FLASHCARD_STORAGE);
  expect(completed.masteredCardIds).toHaveLength(10);
  expect(completed.totalMissedCount).toBe(1);
});

test('a Sekoitus session persists its per-card exercise type and progress across reload', async ({ page }) => {
  await page.goto('/kortit/harjoitus?mode=deck&answer=mixed&deck=anatomi&direction=fi-sv&amount=10&session=mixed-persist-1');
  const sectionBefore = await currentExerciseSection(page);
  const before = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FLASHCARD_STORAGE);
  await page.reload();
  const sectionAfter = await currentExerciseSection(page);
  const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), FLASHCARD_STORAGE);
  expect(after.selectedCardIds).toEqual(before.selectedCardIds);
  expect(after.currentCardId).toBe(before.currentCardId);
  expect(after.answerMode).toBe('mixed');
  expect(sectionAfter).toBe(sectionBefore);
});

test('Sekoitus setup and practice fit narrow mobile viewports without accessibility violations', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/kortit/');
  const group = page.getByRole('group', { name: 'Harjoitustapa' });
  await group.locator('label').filter({ hasText: 'Sekoitus' }).click();
  await expect(group.getByLabel('Sekoitus')).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);

  await page.goto('/kortit/harjoitus?mode=deck&answer=mixed&deck=anatomi&direction=fi-sv&amount=10&session=mixed-mobile-1');
  await currentExerciseSection(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});
