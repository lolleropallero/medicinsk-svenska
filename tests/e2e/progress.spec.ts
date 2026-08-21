import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSpecificCard } from './helpers';

const PROGRESS='medicinsk-svenska.progress.v1';
const readProgress=(page:import('@playwright/test').Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),PROGRESS);

test('fresh home shows a zeroed compact Tänään panel and progress navigation',async({page})=>{
  await page.goto('/');await expect(page.getByRole('heading',{name:'Tänään'})).toBeVisible();await expect(page.getByText('0 / 10 tehtävää')).toBeVisible();
  await page.getByRole('link',{name:'Edistyminen',exact:true}).click();await expect(page.getByRole('heading',{name:'Edistyminen'})).toBeVisible();await expect(page.getByText('Taso 1')).toBeVisible();
});

test('one mastered flashcard records idempotent progress and XP',async({page})=>{
  await openSpecificCard(page,{id:'anatomi-001',deckId:'anatomi'},'fi-sv');await page.getByRole('button',{name:'Näytä vastaus'}).click();await page.getByRole('button',{name:'Osasin'}).click();
  let progress=await readProgress(page);expect(progress.lifetime.completedItems).toBe(1);expect(progress.lifetime.xp).toBe(2);expect(progress.lifetime.sessionsStarted).toBe(1);expect(progress.lifetime.sessionsCompleted).toBe(1);
  await page.reload();progress=await readProgress(page);expect(progress.lifetime.completedItems).toBe(1);expect(progress.lifetime.xp).toBe(2);expect(progress.lifetime.sessionsCompleted).toBe(1);
});

test('one phrase and one description feed the same progress state',async({page})=>{
  await page.goto('/fraasit/harjoitus?mode=all&amount=10&session=progress-phrase');await page.getByRole('button',{name:'Näytä vastaus'}).click();await page.getByRole('button',{name:'Osasin'}).click();
  await page.goto('/kuvailu/harjoitus?mode=all&amount=10&session=progress-description');await page.getByRole('button',{name:'Näytä vastaus'}).click();
  const progress=await readProgress(page);expect(progress.lifetime.completedItems).toBe(2);expect(progress.lifetime.xp).toBeGreaterThanOrEqual(4);expect(progress.daily[Object.keys(progress.daily).sort().at(-1)!].modes.sort()).toEqual(['descriptions','phrases']);
});

test('daily goal is awarded once and appears on progress page',async({page})=>{
  await page.goto('/edistyminen/');await page.locator('#daily-goal').selectOption('5');
  for(let index=1;index<=5;index++){await openSpecificCard(page,{id:`anatomi-${String(index).padStart(3,'0')}`,deckId:'anatomi'},'fi-sv');await page.getByRole('button',{name:'Näytä vastaus'}).click();await page.getByRole('button',{name:'Osasin'}).click();}
  const progress=await readProgress(page),day=progress.daily[Object.keys(progress.daily).sort().at(-1)!];expect(day.goalClaimed).toBe(true);expect(progress.inventory.capsules.filter((c:{id:string})=>c.id.includes('daily-goal')).length).toBe(1);
  await page.reload();expect((await readProgress(page)).inventory.capsules.filter((c:{id:string})=>c.id.includes('daily-goal')).length).toBe(1);await page.goto('/edistyminen/');await expect(page.locator('.quest')).toHaveCount(3);
});

test('capsule opens once, shows rarity text, and collection equipment is operable',async({page})=>{
  await page.goto('/palkinnot/');await expect(page.locator('.inventory-head')).toBeVisible();await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key)!==null,PROGRESS)).toBe(true);await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.inventory.capsules.push({id:'browser-capsule',kind:'golden',earnedAt:Date.now()});localStorage.setItem(key,JSON.stringify(state));},PROGRESS);await page.reload();
  await page.getByRole('button',{name:/Kultainen palkintokapseli Avaa/}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('#capsule-rarity')).toHaveText(/Harvinainen|Eeppinen|Legendaarinen/);await page.getByRole('button',{name:'Sulje'}).click();
  const progress=await readProgress(page);expect(progress.inventory.capsules.find((c:{id:string})=>c.id==='browser-capsule').openedAt).toBeTruthy();await page.reload();await expect(page.getByRole('button',{name:/Kultainen palkintokapseli Avaa/})).toHaveCount(0);
});

test('shop is stable and a purchase deducts credits only once',async({page})=>{
  await page.goto('/palkinnot/');await expect(page.locator('.inventory-head')).toBeVisible();await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key)!==null,PROGRESS)).toBe(true);await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.inventory.credits=1000;localStorage.setItem(key,JSON.stringify(state));},PROGRESS);await page.reload();
  const labels=await page.locator('.offer strong').allTextContents(),button=page.locator('.offer button').first();const before=(await readProgress(page)).inventory.credits;await button.click();const after=(await readProgress(page)).inventory.credits;expect(after).toBeLessThan(before);await page.reload();expect(await page.locator('.offer strong').allTextContents()).toEqual(labels);await expect(page.locator('.offer button').first()).toBeDisabled();
});

test('season and league pages expose a free personal path without fake players',async({page})=>{
  await page.goto('/kausi/');await expect(page.locator('.tier')).toHaveCount(30);await expect(page.getByText('Pronssi')).toBeVisible();await expect(page.getByText('Ei vastustajia eikä keinotekoisia sijoituksia.')).toBeVisible();await expect(page.getByText(/premium|osta|pelaaja/i)).toHaveCount(0);
});

test('export and reset leave active exercise session storage separate',async({page})=>{
  await openSpecificCard(page,{id:'anatomi-001',deckId:'anatomi'},'fi-sv');const session=await page.evaluate(()=>localStorage.getItem('medicinsk-svenska.flashcard-session.v1'));await page.goto('/edistyminen/');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Vie tiedot'}).click();expect((await download).suggestedFilename()).toMatch(/^medicinsk-svenska-progress-\d{4}-\d{2}-\d{2}\.json$/);
  page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Nollaa edistyminen'}).click();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('medicinsk-svenska.flashcard-session.v1'))).toBe(session);
});

test('new routes have no serious accessibility violations or horizontal overflow at 320px',async({page})=>{
  await page.setViewportSize({width:320,height:568});for(const route of ['/','/edistyminen/','/palkinnot/','/kausi/']){await page.goto(route);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),route).toBe(true);expect((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??'')),route).toEqual([]);}
});
