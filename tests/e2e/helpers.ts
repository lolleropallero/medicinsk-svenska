import type { Page } from '@playwright/test';
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
