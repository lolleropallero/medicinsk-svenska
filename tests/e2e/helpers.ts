import { expect, type Page } from '@playwright/test';
import type { Direction } from '../../src/types/content';

const STORAGE_KEY = 'medicinsk-svenska.flashcard-session.v1';

export async function openSpecificCard(
  page: Page,
  card: { id: string; deckId: string },
  direction: Direction,
) {
  const sessionId = `test-${card.id}-${direction}`;
  await page.goto(`/kortit/harjoitus?mode=deck&deck=${card.deckId}&direction=${direction}&amount=10&session=${sessionId}`);
  await page.evaluate(({ key, id, deckId, selectedDirection, selectedSessionId }) => {
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      sessionId: selectedSessionId,
      mode: 'deck',
      sourceDeckId: deckId,
      direction: selectedDirection,
      requestedAmount: 10,
      selectedCardIds: [id],
      unseenCardQueue: [],
      currentCardId: id,
      masteredCardIds: [],
      pendingRetries: [],
      attemptCountByCard: {},
      firstAttemptCorrectByCard: {},
      totalMissedCount: 0,
      startedAt: Date.now(),
      revealed: false,
    }));
  }, { key: STORAGE_KEY, id: card.id, deckId: card.deckId, selectedDirection: direction, selectedSessionId: sessionId });
  await page.reload();
  await page.evaluate(() => window.scrollTo(0, 0));
}

export async function continuePastMilestone(page: Page) {
  const button = page.getByRole('button', { name: 'Fortsätt' });
  if (await button.isVisible()) await button.click();
}

export interface SeededFlashcardSession {
  sessionId: string;
  mode: 'deck' | 'lucky' | 'review';
  answerMode: 'cards' | 'choice' | 'written' | 'mixed';
  sourceDeckId?: string;
  direction: Direction;
  requestedAmount: number | 'all';
  selectedCardIds: string[];
  currentCardId: string | null;
  unseenCardQueue?: string[];
  masteredCardIds?: string[];
  pendingRetries?: { cardId: string; dueAt: number }[];
  attemptCountByCard?: Record<string, number>;
  firstAttemptCorrectByCard?: Record<string, boolean>;
  totalMissedCount?: number;
  startedAt?: number;
  revealed?: boolean;
  answerDraft?: string;
}

export async function seedFlashcardSession(page: Page, url: string, session: SeededFlashcardSession) {
  await page.goto(url);
  await page.evaluate(({ key, session }) => {
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      unseenCardQueue: [],
      masteredCardIds: [],
      pendingRetries: [],
      attemptCountByCard: {},
      firstAttemptCorrectByCard: {},
      totalMissedCount: 0,
      startedAt: Date.now(),
      revealed: false,
      answerDraft: '',
      ...session,
    }));
  }, { key: STORAGE_KEY, session });
  await page.reload();
}

export async function deckCardIds(page: Page, deckId: string, count?: number): Promise<string[]> {
  return page.evaluate(({ deckId, count }) => {
    const cards = JSON.parse(document.getElementById('cards-data')!.textContent!) as { id: string; deckId: string }[];
    const ids = cards.filter((card) => card.deckId === deckId).map((card) => card.id);
    return typeof count === 'number' ? ids.slice(0, count) : ids;
  }, { deckId, count });
}

export async function currentVocabularyAnswer(page: Page): Promise<string> {
  return page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    const cards = JSON.parse(document.getElementById('cards-data')!.textContent!) as { id: string; fi: string; sv: string; article?: string }[];
    const card = cards.find((item) => item.id === state.currentCardId)!;
    return state.direction === 'fi-sv' ? `${card.article ? `${card.article} ` : ''}${card.sv}` : card.fi;
  }, STORAGE_KEY);
}

export type ExerciseSection = 'cards' | 'choice' | 'written' | null;

// Polls for the app's render() to have run at least once (it always sets #progress first) before
// reading section visibility, so callers never race a navigation/reload against script init.
export async function currentExerciseSection(page: Page): Promise<ExerciseSection> {
  await expect.poll(async () => (await page.locator('#progress').textContent()) ?? '').not.toBe('');
  if (await page.locator('#flashcard').isVisible()) return 'cards';
  if (await page.locator('#choice-exercise').isVisible()) return 'choice';
  if (await page.locator('#written-exercise').isVisible()) return 'written';
  return null;
}

// Grades whichever exercise section (Kortit/Monivalinta/Kirjoita) is currently rendered, so callers
// don't need to know which vocabulary exercise type a Sekoitus or Kertaa vaikeita card resolved to.
export async function answerCurrentVocabularyCard(page: Page, correct: boolean) {
  const section = await currentExerciseSection(page);
  if (section === 'cards') {
    await page.getByRole('button', { name: 'Näytä vastaus' }).click();
    await page.getByRole('button', { name: correct ? 'Osasin' : 'En osannut' }).click();
    return;
  }
  if (section === 'choice') {
    const buttons = page.locator('#choice-options button');
    const labels = await buttons.locator('.choice-label').allTextContents();
    const answer = await currentVocabularyAnswer(page);
    const index = correct ? labels.findIndex((label) => label === answer) : labels.findIndex((label) => label !== answer);
    await buttons.nth(index).click();
    if (!correct) await page.getByRole('button', { name: 'Jatka' }).click();
    return;
  }
  if (section === 'written') {
    const answer = correct ? await currentVocabularyAnswer(page) : '__wrong-answer__';
    await page.getByLabel('Vastauksesi').fill(answer);
    await page.getByRole('button', { name: 'Tarkista' }).click();
    if (!correct) await page.getByRole('button', { name: 'Jatka' }).click();
  }
}

export const WORD_STATS_KEY = 'medicinsk-svenska.word-stats.v1';

export interface SeededWordStatEntry {
  attempts: number;
  incorrect: number;
  correctStreak: number;
  lastAttemptAt: number;
  lastIncorrectAt?: number;
}

export async function seedWordStats(page: Page, cards: Record<string, SeededWordStatEntry>) {
  await page.evaluate(({ key, cards }) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, cards }));
  }, { key: WORD_STATS_KEY, cards });
}

export async function readWordStats(page: Page): Promise<{ schemaVersion: 1; cards: Record<string, SeededWordStatEntry> } | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, WORD_STATS_KEY);
}
