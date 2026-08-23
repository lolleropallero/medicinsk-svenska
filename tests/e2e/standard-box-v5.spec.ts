import { expect, test, type Locator } from '@playwright/test';

const PROGRESS = 'medicinsk-svenska.progress.v1';
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

const loaded = (image: Locator) => expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
const overlaps = async (first: Locator, second: Locator) => {
  const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  if (!a || !b) throw new Error('missing geometry');
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
};
const expectAspectRatio = async (image: Locator) => {
  const values = await image.evaluate((node: HTMLImageElement) => ({
    natural: node.naturalWidth / node.naturalHeight,
    rendered: node.getBoundingClientRect().width / node.getBoundingClientRect().height,
    fit: getComputedStyle(node).objectFit,
  }));
  expect(values.fit).toBe('contain');
  expect(Math.abs(values.natural - values.rendered)).toBeLessThan(0.03);
};

test('daily goal and all-three bonus use Kruunu & Kilpi art without overlap', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'image' || request.resourceType() === 'font') requested.push(request.url());
  });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const overlay = page.getByRole('dialog', { name: 'Dagens uppdrag' });
    if (!(await overlay.isVisible())) await page.getByRole('button', { name: /Dagens uppdrag/ }).click();
    await expect(overlay).toBeVisible();

    const goalImage = page.locator('.overlay-goal .reward-box-visual > img');
    const bonusImage = page.locator('.daily-all-bonus .reward-box-visual > img');
    await loaded(goalImage); await loaded(bonusImage);
    await expect(goalImage).toHaveAttribute('src', /reward-standard\.[^/]+\.svg$/);
    await expect(bonusImage).toHaveAttribute('src', /reward-golden\.[^/]+\.svg$/);
    await expect(bonusImage).not.toHaveAttribute('src', /box-|standard-box-v5/);
    await expect(page.locator('.daily-all-bonus')).toContainText('Slutför alla tre och få en gyllene belöning');
    await expectAspectRatio(goalImage); await expectAspectRatio(bonusImage);

    expect(await overlaps(goalImage, page.locator('.overlay-goal h3'))).toBe(false);
    expect(await overlaps(goalImage, page.locator('.overlay-goal .meter'))).toBe(false);
    expect(await overlaps(goalImage, page.locator('.overlay-goal small'))).toBe(false);
    expect(await overlaps(bonusImage, page.locator('.daily-all-bonus-copy'))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    if (viewport.width === 320) {
      const goalHeight = (await goalImage.boundingBox())!.height;
      const bonusHeight = (await bonusImage.boundingBox())!.height;
      expect(goalHeight).toBeGreaterThanOrEqual(58);
      expect(goalHeight).toBeLessThanOrEqual(92);
      expect(bonusHeight).toBeGreaterThanOrEqual(64);
      expect(bonusHeight).toBeLessThanOrEqual(84);
    }
  }

  expect(requested.some((url) => /standard-box-v5|visual-fix-v4\/rewards|reference-sheet/i.test(url))).toBe(false);
  expect(requested.filter((url) => new URL(url).origin !== new URL(page.url()).origin)).toEqual([]);
});

test('HUD, inventory, and reveals use the intended Kruunu & Kilpi variants', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'image' || request.resourceType() === 'font') requested.push(request.url());
  });
  await page.goto('/palkinnot/');
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key) !== null, PROGRESS)).toBe(true);
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.inventory.capsules = [
      { id: 'v5-standard', kind: 'standard', earnedAt: Date.now() },
      { id: 'v5-golden', kind: 'golden', earnedAt: Date.now() + 1 },
      { id: 'v5-legendary', kind: 'legendary', earnedAt: Date.now() + 2 },
    ];
    localStorage.setItem(key, JSON.stringify(state));
  }, PROGRESS);
  await page.reload();

  await expect(page.locator('.reward-tabs .compact-reward-box img')).toHaveAttribute('src', /reward-hud\.[^/]+\.svg$/);
  await expect(page.locator('.hud-boxes img')).toHaveAttribute('src', /reward-hud\.[^/]+\.svg$/);
  await expect(page.locator('.capsule.box-standard .reward-box-visual > img')).toHaveAttribute('src', /reward-standard\.[^/]+\.svg$/);
  await expect(page.locator('.capsule.box-golden .reward-box-visual > img')).toHaveAttribute('src', /reward-golden\.[^/]+\.svg$/);
  await expect(page.locator('.capsule.box-legendary .reward-box-visual > img')).toHaveAttribute('src', /reward-legendary\.[^/]+\.svg$/);
  await expect(page.locator('.capsule img[src*="box-"],.capsule img[src*="standard-box-v5"]')).toHaveCount(0);
  await loaded(page.locator('.capsule.box-standard .reward-box-visual > img'));
  await expect(page.locator('.capsule.box-standard .reward-box-visual > img')).toHaveAttribute('width', '320');
  await expect(page.locator('.capsule.box-standard .reward-box-visual > img')).toHaveAttribute('height', '360');
  await expectAspectRatio(page.locator('.capsule.box-standard .reward-box-visual > img'));

  const stableBefore = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    return { settings: state.settings, daily: state.daily, weekly: state.weekly, streak: state.streak, capsuleCount: state.inventory.capsules.length };
  }, PROGRESS);
  for (const kind of ['standard', 'golden', 'legendary'] as const) {
    await page.locator(`.capsule.box-${kind}`).click();
    const dialogImage = page.locator('.capsule-dialog .reward-box-visual > img');
    await loaded(dialogImage);
    await expect(dialogImage).toHaveAttribute('src', new RegExp(`reward-${kind}\\.[^/]+\\.svg$`));
    if (kind === 'standard') {
      await expect(dialogImage).toHaveAttribute('width', '320');
      await expect(dialogImage).toHaveAttribute('height', '360');
    }
    await expectAspectRatio(dialogImage);
    await page.getByRole('button', { name: 'Stäng' }).click();
  }
  const stableAfter = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    return { settings: state.settings, daily: state.daily, weekly: state.weekly, streak: state.streak, capsuleCount: state.inventory.capsules.length, opened: state.inventory.capsules.filter((item: { openedAt?: number }) => typeof item.openedAt === 'number').length };
  }, PROGRESS);
  expect(stableAfter).toMatchObject({ ...stableBefore, opened: 3 });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/palkinnot/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  expect(requested.some((url) => /standard-box-v5|visual-fix-v4\/rewards|reference-sheet/i.test(url))).toBe(false);
  expect(requested.filter((url) => new URL(url).origin !== new URL(page.url()).origin)).toEqual([]);
});

test('progress-page golden bonus keeps its shield inside the media column with clear card spacing', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/edistyminen/');
    const bonus = page.locator('.all-quests-bonus');
    const shield = bonus.locator('.reward-box-visual');
    const copy = bonus.locator(':scope > span:last-child');
    const quests = page.locator('.daily-missions .quest-list');
    const [bonusBox, shieldBox, copyBox, questsBox] = await Promise.all([
      bonus.boundingBox(), shield.boundingBox(), copy.boundingBox(), quests.boundingBox(),
    ]);
    if (!bonusBox || !shieldBox || !copyBox || !questsBox) throw new Error('missing progress bonus geometry');
    expect(shieldBox.x + shieldBox.width).toBeLessThanOrEqual(copyBox.x);
    expect(shieldBox.x).toBeGreaterThanOrEqual(bonusBox.x);
    expect(shieldBox.x + shieldBox.width).toBeLessThanOrEqual(bonusBox.x + bonusBox.width);
    expect(bonusBox.y - (questsBox.y + questsBox.height)).toBeGreaterThanOrEqual(12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test('capture Kruunu & Kilpi reward states', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.screenshot({ path: 'tmp/visual/v5-daily-fresh-320x568.png', fullPage: true });
  await page.getByRole('button', { name: 'Stäng dagens uppdrag' }).click();
  await page.screenshot({ path: 'tmp/visual/v5-hud-zero-320x568.png', fullPage: true });

  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    const date = new Date();
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const quest = (slot: number, kind: string, target: number, mode?: string) => ({
      id: `${day}:${slot}:0`, slot, kind, ...(mode ? { mode } : {}), target,
      xp: slot * 5, credits: slot * 5 + 5, seasonPoints: slot * 5 + 5,
      rerollIndex: 0, claimed: false,
    });
    state.daily[day] = {
      uniqueItemIds: Array.from({ length: 4 }, (_, index) => `flashcards:v5-partial-${index}`),
      completedItems: 4, activeStudyMs: 0, xp: 0, modes: ['flashcards'],
      sessionsStarted: 1, sessionsCompleted: 0, retriesMastered: 0,
      goalTarget: 10, goalClaimed: false, qualified: false, freezeUsed: false,
      quests: [quest(1, 'items', 10), quest(2, 'mode', 5, 'phrases'), quest(3, 'active', 300000)],
      freeRerollUsed: false, allQuestsClaimed: false,
      sessionDropEligible: 0, sessionDropAwarded: false,
    };
    state.inventory.capsules = [{ id: 'v5-hud-one', kind: 'standard', earnedAt: Date.now() }];
    localStorage.setItem(key, JSON.stringify(state));
  }, PROGRESS);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('button', { name: /Dagens uppdrag/ }).click();
  await page.screenshot({ path: 'tmp/visual/v5-daily-partial-390x844.png', fullPage: true });
  await page.getByRole('button', { name: 'Stäng dagens uppdrag' }).click();
  await page.screenshot({ path: 'tmp/visual/v5-hud-one-390x844.png', fullPage: true });

  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    const day = Object.keys(state.daily).sort().at(-1)!;
    state.daily[day].uniqueItemIds = Array.from({ length: 10 }, (_, index) => `flashcards:v5-complete-${index}`);
    state.daily[day].goalClaimed = true;
    state.daily[day].quests.forEach((quest: { claimed: boolean }) => { quest.claimed = true; });
    state.daily[day].allQuestsClaimed = true;
    localStorage.setItem(key, JSON.stringify(state));
  }, PROGRESS);
  await page.reload();
  await page.getByRole('button', { name: /Dagens uppdrag/ }).click();
  await page.screenshot({ path: 'tmp/visual/v5-daily-all-complete-390x844.png', fullPage: true });

  await page.goto('/palkinnot/');
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.inventory.capsules = [
      { id: 'v5-shot-standard', kind: 'standard', earnedAt: Date.now() },
      { id: 'v5-shot-golden', kind: 'golden', earnedAt: Date.now() + 1 },
      { id: 'v5-shot-legendary', kind: 'legendary', earnedAt: Date.now() + 2 },
    ];
    localStorage.setItem(key, JSON.stringify(state));
  }, PROGRESS);
  await page.reload();
  await page.screenshot({ path: 'tmp/visual/v5-inventory-multiple-390x844.png', fullPage: true });
  for (const kind of ['standard', 'golden', 'legendary'] as const) {
    await page.locator(`.capsule.box-${kind}`).click();
    await page.screenshot({ path: `tmp/visual/v5-reveal-${kind}-390x844.png`, fullPage: true });
    await page.getByRole('button', { name: 'Stäng' }).click();
  }
});
