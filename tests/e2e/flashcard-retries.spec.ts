import { expect, test } from '@playwright/test';
import type { FlashcardSession } from '../../src/lib/session';
import { continuePastMilestone } from './helpers';

for (const [route, storageKey] of [
  ['/kortit', 'medicinsk-svenska.flashcard-session.v1'],
  ['/tentti', 'medicinsk-svenska.exam-session.v1'],
] as const) {
  test(`${route} caps a fifty-card round at five unmastered cards and retains the timer across reload`, async ({ page }) => {
    const start = new Date('2030-01-01T10:00:00.000Z');
    await page.clock.install({ time: start });
    await page.clock.pauseAt(start);
    await page.goto(`${route}/harjoitus?mode=deck&deck=anatomi&answer=cards&direction=fi-sv&amount=50&session=retry-limit`);
    await expect(page.locator('#progress')).toHaveText('0 / 50');
    const readSession = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as FlashcardSession, storageKey);
    const grade = async (correct: boolean) => {
      await page.getByRole('button', { name: 'Näytä vastaus' }).click();
      await page.getByRole('button', { name: correct ? 'Osasin' : 'En osannut', exact: true }).click();
      await continuePastMilestone(page);
    };
    const initial = await readSession();
    for (let index = 0; index < 4; index += 1) await grade(false);
    const beforeReload = await readSession();
    expect(beforeReload.currentCardId).toBe(initial.selectedCardIds[4]);
    expect(beforeReload.pendingRetries).toHaveLength(4);
    await page.reload();
    await expect(page.locator('#progress')).toHaveText('0 / 50');
    expect(await readSession()).toEqual(beforeReload);

    await grade(false);
    const retry = await readSession();
    expect(retry.currentCardId).toBe(initial.selectedCardIds[0]);
    expect(retry.pendingRetries).toHaveLength(4);
    expect(retry.unseenCardQueue).toEqual(initial.selectedCardIds.slice(5));
    expect(retry.pendingRetries.every(item => item.dueAt === start.getTime() + 2 * 60 * 1000)).toBe(true);
    await expect(page.locator('#waiting-view')).toBeHidden();

    await grade(false);
    expect((await readSession()).currentCardId).toBe(initial.selectedCardIds[1]);
    await grade(true);
    const resumed = await readSession();
    expect(resumed.currentCardId).toBe(initial.selectedCardIds[5]);
    expect(resumed.pendingRetries.map(item => item.cardId)).toEqual([
      ...initial.selectedCardIds.slice(2, 5), initial.selectedCardIds[0],
    ]);
    await page.reload();
    await expect(page.locator('#progress')).toHaveText('1 / 50');
    expect(await readSession()).toEqual(resumed);

    await page.clock.fastForward(2 * 60 * 1000);
    await grade(true);
    const timedRetry = await readSession();
    expect(timedRetry.currentCardId).toBe(initial.selectedCardIds[2]);
    expect(timedRetry.pendingRetries).toHaveLength(3);
    expect(timedRetry.unseenCardQueue).toEqual(initial.selectedCardIds.slice(6));
  });
}
