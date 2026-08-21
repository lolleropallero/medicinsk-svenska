import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSpecificCard } from './helpers';

const PROGRESS='medicinsk-svenska.progress.v1';
const readProgress=(page:import('@playwright/test').Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),PROGRESS);

test('fresh home is daily-first with HUD, three bilingual quests, reward, and progress navigation',async({page})=>{
  await page.goto('/');await expect(page.getByRole('heading',{name:'Dagens mål'})).toBeVisible();await expect(page.locator('.daily-goal-value')).toHaveText('0 / 10');await expect(page.getByText('Vanlig låda · 10 krediter · 20 säsongspoäng')).toBeVisible();
  await expect(page.locator('#metagame-hud')).toContainText('Nivå');await expect(page.locator('#metagame-hud')).toContainText('Svit');await expect(page.locator('#metagame-hud')).toContainText('Krediter');await expect(page.locator('#metagame-hud')).toContainText('Lådor');
  await expect(page.locator('.daily-quests .quest')).toHaveCount(3);await expect(page.getByText('Gör 10 olika uppgifter')).toBeVisible();await expect(page.getByText('Suorita 10 eri tehtävää')).toBeVisible();await expect(page.getByText('Slutför alla tre och få en gyllene låda')).toBeVisible();
  expect(await page.evaluate(()=>{const daily=document.querySelector('.daily-quests'),actions=document.querySelector('.home-actions');return Boolean(daily&&actions&&(daily.compareDocumentPosition(actions)&Node.DOCUMENT_POSITION_FOLLOWING));})).toBe(true);
  await page.getByRole('link',{name:'Framsteg',exact:true}).click();await expect(page.getByRole('heading',{name:'Framsteg'})).toBeVisible();await expect(page.getByText('Nivå 1')).toBeVisible();
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
  await page.getByRole('button',{name:/Gyllene låda Öppna/}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('#capsule-rarity')).toHaveText(/Sällsynt|Episk|Legendarisk/);await page.getByRole('button',{name:'Stäng'}).click();
  const progress=await readProgress(page);expect(progress.inventory.capsules.find((c:{id:string})=>c.id==='browser-capsule').openedAt).toBeTruthy();await page.reload();await expect(page.getByRole('button',{name:/Gyllene låda Öppna/})).toHaveCount(0);
});

test('shop is stable and a purchase deducts credits only once',async({page})=>{
  await page.goto('/palkinnot/');await expect(page.locator('.inventory-head')).toBeVisible();await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key)!==null,PROGRESS)).toBe(true);await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.inventory.credits=1000;localStorage.setItem(key,JSON.stringify(state));},PROGRESS);await page.reload();
  const labels=await page.locator('.offer strong').allTextContents(),button=page.locator('.offer button').first();const before=(await readProgress(page)).inventory.credits;await button.click();const after=(await readProgress(page)).inventory.credits;expect(after).toBeLessThan(before);await page.reload();expect(await page.locator('.offer strong').allTextContents()).toEqual(labels);await expect(page.locator('.offer button').first()).toBeDisabled();
});

test('season and league pages expose a free personal path without fake players',async({page})=>{
  await page.goto('/kausi/');await expect(page.locator('.tier')).toHaveCount(30);await expect(page.getByText('Brons',{exact:true})).toBeVisible();await expect(page.getByText('Ingen påhittad topplista och inga falska motståndare.')).toBeVisible();await expect(page.getByText(/premium|osta|pelaaja/i)).toHaveCount(0);
});

test('legacy V1 display strings are ignored without changing progress or replaying rewards',async({page})=>{
  await page.goto('/');const before=await readProgress(page);await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.lifetime.xp=340;state.inventory.credits=120;state.inventory.capsules.push({id:'legacy-box',kind:'standard',earnedAt:1});state.daily['2026-08-21']={uniqueItemIds:[],completedItems:0,activeStudyMs:0,xp:0,modes:[],sessionsStarted:0,sessionsCompleted:0,retriesMastered:0,goalTarget:10,goalClaimed:false,qualified:false,freezeUsed:false,quests:[{id:'2026-08-21:1:0',slot:1,kind:'items',label:'stale quest',target:10,xp:5,credits:10,seasonPoints:10,rerollIndex:0,claimed:true}],freeRerollUsed:false,allQuestsClaimed:false,sessionDropEligible:0,sessionDropAwarded:false};state.notifications=[{id:'old',message:'stale message'}];state.league.previousResult='stale result';state.sessionRewards={legacy:['+20 XP','stale reward']};localStorage.setItem(key,JSON.stringify(state));},PROGRESS);await page.reload();
  const after=await readProgress(page);expect(after.lifetime.xp).toBe(340);expect(after.inventory.credits).toBe(120);expect(after.inventory.capsules.filter((item:{id:string})=>item.id==='legacy-box')).toHaveLength(1);expect(after.processedEventIds).toEqual(before.processedEventIds);await expect(page.getByText('stale quest')).toHaveCount(0);await expect(page.getByText('stale message')).toHaveCount(0);await expect(page.getByText('stale result')).toHaveCount(0);
});

test('reward surfacing links directly and active exercises omit the full HUD',async({page})=>{
  await page.goto('/');await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.inventory.capsules.push({id:'home-box',kind:'standard',earnedAt:Date.now()});state.seasons.points=100;state.settings.calmMode=true;localStorage.setItem(key,JSON.stringify(state));},PROGRESS);await page.reload();
  await expect(page.getByRole('link',{name:'Öppna en överraskningslåda'})).toBeVisible();await expect(page.getByText('1 säsongsbelöning väntar')).toHaveCount(2);expect(await page.locator('.hud-boxes').evaluate(element=>getComputedStyle(element).animationName)).toBe('none');await page.getByRole('link',{name:'Öppna en överraskningslåda'}).click();expect(page.url()).toContain('/palkinnot/#unopened-boxes');
  await page.goto('/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=no-hud');await expect(page.locator('#metagame-hud')).toHaveCount(0);
});

test('export and reset leave active exercise session storage separate',async({page})=>{
  await openSpecificCard(page,{id:'anatomi-001',deckId:'anatomi'},'fi-sv');const session=await page.evaluate(()=>localStorage.getItem('medicinsk-svenska.flashcard-session.v1'));await page.goto('/edistyminen/');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Vie tiedot'}).click();expect((await download).suggestedFilename()).toMatch(/^medicinsk-svenska-progress-\d{4}-\d{2}-\d{2}\.json$/);
  page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Nollaa edistyminen'}).click();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('medicinsk-svenska.flashcard-session.v1'))).toBe(session);
});

test('new routes have no serious accessibility violations or horizontal overflow at 320px',async({page})=>{
  await page.setViewportSize({width:320,height:568});for(const route of ['/','/edistyminen/','/palkinnot/','/kausi/']){await page.goto(route);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),route).toBe(true);expect((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??'')),route).toEqual([]);}
});
