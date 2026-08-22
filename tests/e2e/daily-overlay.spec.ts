import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PROGRESS='medicinsk-svenska.progress.v1';
const UI='medicinsk-svenska.ui.v1';

type DayOptions={goalCount?:number;claimedSlots?:number[];quest?:{kind:string;mode?:string;target:number};modes?:string[];calm?:boolean;lastUsedMode?:string;freeRerollUsed?:boolean;rerollTokens?:number};

async function closeIfOpen(page:Page){const dialog=page.getByRole('dialog',{name:'Dagens uppdrag'});if(await dialog.isVisible()){await page.getByRole('button',{name:'Stäng dagens uppdrag'}).click();await expect(dialog).toBeHidden();expect(await page.evaluate(key=>localStorage.getItem(key),UI)).not.toBeNull();}}
async function openDaily(page:Page){const dialog=page.getByRole('dialog',{name:'Dagens uppdrag'});if(!await dialog.isVisible())await page.getByRole('button',{name:/Dagens uppdrag/}).click();await expect(dialog).toBeVisible();}

async function seedDay(page:Page,options:DayOptions={}){await page.evaluate(({progressKey,uiKey,options})=>{const state=JSON.parse(localStorage.getItem(progressKey)!);const date=new Date(),key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;const claimed=new Set(options.claimedSlots??[]);const questAt=(slot:number,kind:string,target:number,mode?:string)=>({id:`${key}:${slot}:0`,slot,kind,...(mode?{mode}:{}),target,xp:slot===1?5:slot===2?10:15,credits:slot===1?10:slot===2?15:20,seasonPoints:slot===1?10:slot===2?15:20,rerollIndex:0,claimed:claimed.has(slot)});const first=options.quest??{kind:'items',target:10};const uniqueItemIds=Array.from({length:options.goalCount??0},(_,i)=>`flashcards:test-${i}`);state.daily[key]={uniqueItemIds,completedItems:uniqueItemIds.length,activeStudyMs:0,xp:0,modes:options.modes??[],sessionsStarted:0,sessionsCompleted:0,retriesMastered:0,goalTarget:state.settings.dailyGoal,goalClaimed:uniqueItemIds.length>=state.settings.dailyGoal,qualified:uniqueItemIds.length>=state.settings.dailyGoal,freezeUsed:false,quests:[questAt(1,first.kind,first.target,first.mode),questAt(2,'mode',5,'phrases'),questAt(3,'active',300000)],freeRerollUsed:options.freeRerollUsed??false,allQuestsClaimed:claimed.size===3,sessionDropEligible:0,sessionDropAwarded:false};state.inventory.rerollTokens=options.rerollTokens??state.inventory.rerollTokens;if(options.calm!==undefined)state.settings.calmMode=options.calm;if(options.lastUsedMode)state.lastUsedMode=options.lastUsedMode;localStorage.setItem(progressKey,JSON.stringify(state));localStorage.removeItem(uiKey);},{progressKey:PROGRESS,uiKey:UI,options});}

test('daily overlay opens once per controlled local day and dismissal is presentation-only',async({page})=>{
  const testNow='medicinsk-svenska.test-now',firstDay=new Date(2026,7,21,12).getTime(),nextDay=new Date(2026,7,22,12).getTime();await page.addInitScript(({key,fallback})=>{const NativeDate=Date,readNow=()=>{try{return Number(localStorage.getItem(key))||fallback;}catch{return fallback;}};globalThis.Date=new Proxy(NativeDate,{construct(target,args,newTarget){return Reflect.construct(target,args.length?args:[readNow()],newTarget);},apply(target,thisArg,args){return Reflect.apply(target,thisArg,args.length?args:[readNow()]);},get(target,property,receiver){return property==='now'?readNow:Reflect.get(target,property,receiver);}}) as DateConstructor;},{key:testNow,fallback:firstDay});await page.goto('/');const dialog=page.getByRole('dialog',{name:'Dagens uppdrag'});await expect(dialog).toBeVisible();
  const before=await page.evaluate(key=>localStorage.getItem(key),PROGRESS);await page.getByRole('button',{name:'Stäng dagens uppdrag'}).click();await expect(dialog).toBeHidden();await expect(page.getByRole('button',{name:/Dagens uppdrag 0 \/ 3/})).toBeVisible();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),UI)).toEqual({schemaVersion:1,dailyOverlayDismissedDay:'2026-08-21'});expect(await page.evaluate(key=>localStorage.getItem(key),PROGRESS)).toBe(before);
  await page.reload();await expect(dialog).toBeHidden();await page.getByRole('button',{name:/Dagens uppdrag/}).click();await expect(dialog).toBeVisible();await page.getByRole('button',{name:'Stäng dagens uppdrag'}).click();await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).dailyOverlayDismissedDay,UI)).toBe('2026-08-21');
  await page.evaluate(({key,value})=>localStorage.setItem(key,String(value)),{key:testNow,value:nextDay});await page.reload();expect(await page.evaluate(()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;})).toBe('2026-08-22');expect(await page.evaluate(({progressKey,uiKey})=>({path:location.pathname,calm:JSON.parse(localStorage.getItem(progressKey)!).settings.calmMode,preferences:JSON.parse(localStorage.getItem(uiKey)!)}),{progressKey:PROGRESS,uiKey:UI})).toEqual({path:'/',calm:false,preferences:{schemaVersion:1,dailyOverlayDismissedDay:'2026-08-21'}});await expect(dialog).toBeVisible();
});

test('quest activation handles today before navigation, home stays quiet, and tomorrow auto-opens',async({page})=>{
  const testNow='medicinsk-svenska.test-now',firstDay=new Date(2026,7,21,12).getTime(),nextDay=new Date(2026,7,22,12).getTime();await page.addInitScript(({key,fallback})=>{const NativeDate=Date,readNow=()=>{try{return Number(localStorage.getItem(key))||fallback;}catch{return fallback;}};globalThis.Date=new Proxy(NativeDate,{construct(target,args,newTarget){return Reflect.construct(target,args.length?args:[readNow()],newTarget);},apply(target,thisArg,args){return Reflect.apply(target,thisArg,args.length?args:[readNow()]);},get(target,property,receiver){return property==='now'?readNow:Reflect.get(target,property,receiver);}}) as DateConstructor;},{key:testNow,fallback:firstDay});
  await page.goto('/');const dialog=page.getByRole('dialog',{name:'Dagens uppdrag'});await expect(dialog).toBeVisible();await page.locator('[data-quest-action="1"]').click();await expect(page).toHaveURL(/\/kortit\/harjoitus\?.*mode=lucky.*amount=10/);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),UI)).toEqual({schemaVersion:1,dailyOverlayDismissedDay:'2026-08-21'});
  await page.goto('/');await expect(dialog).toBeHidden();const launcher=page.getByRole('button',{name:/Dagens uppdrag/});await launcher.click();await expect(dialog).toBeVisible();await page.getByRole('button',{name:'Stäng dagens uppdrag'}).click();await expect(launcher).toBeFocused();
  await page.evaluate(({key,value})=>localStorage.setItem(key,String(value)),{key:testNow,value:nextDay});await page.reload();await expect(dialog).toBeVisible();
});

test('persistent homepage is only HUD, launcher, and three actions; daily detail exists only in the modal',async({page})=>{
  await page.setViewportSize({width:320,height:568});await page.goto('/');await expect(page.locator('.daily-overlay-quests .daily-quest-row')).toHaveCount(3);await closeIfOpen(page);
  await expect(page.locator('#home-daily,#home-reward-alerts,#home-next-action,#home-status,.home-status,.home-daily')).toHaveCount(0);await expect(page.locator('.home .daily-quest-row,.home .quest,.home .dashboard-card')).toHaveCount(0);await expect(page.locator('.home-actions a')).toHaveCount(3);await expect(page.locator('.home > :not(.sr-only)')).toHaveCount(2);
  await expect(page.getByText(/Säsong|Veckoliga/)).toHaveCount(0);await expect(page.locator('#metagame-hud')).toContainText('Krediter');await expect(page.locator('#metagame-hud')).toContainText('Lådor');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);expect((await page.locator('.home-actions').boundingBox())!.y).toBeLessThan(300);await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});

test('calm mode and completed dailies prevent automatic opening but keep manual access',async({page})=>{
  await page.goto('/');await closeIfOpen(page);await seedDay(page,{calm:true});await page.reload();await expect(page.getByRole('dialog',{name:'Dagens uppdrag'})).toBeHidden();await page.getByRole('button',{name:/Dagens uppdrag/}).click();await expect(page.getByRole('dialog',{name:'Dagens uppdrag'})).toBeVisible();await closeIfOpen(page);
  await seedDay(page,{goalCount:10,claimedSlots:[1,2,3],calm:false});await page.reload();await expect(page.getByRole('dialog',{name:'Dagens uppdrag'})).toBeHidden();await expect(page.getByRole('button',{name:/Dagens uppdrag 3 \/ 3 Dagens mål klart/})).toBeVisible();
});

for(const [label,mode,path,query] of [
  ['flashcards','flashcards','/kortit/harjoitus','mode=lucky'],
  ['phrases','phrases','/fraasit/harjoitus','mode=all'],
  ['descriptions','descriptions','/kuvailu/harjoitus','mode=all'],
] as const)test(`a ${label} daily quest starts that mode directly`,async({page})=>{
  await page.goto('/');await closeIfOpen(page);await seedDay(page,{quest:{kind:'mode',mode,target:mode==='flashcards'?10:5}});await page.reload();await openDaily(page);await page.locator('[data-quest-action="1"]').click();await expect.poll(()=>page.url()).toContain(path);expect(page.url()).toContain(query);
});

test('generic and variety quests resolve to a study session, and reroll remains separate',async({page})=>{
  await page.goto('/');await closeIfOpen(page);await seedDay(page,{quest:{kind:'items',target:10},lastUsedMode:'phrases'});await page.reload();await openDaily(page);const url=page.url(),action=page.locator('[data-quest-action="1"]'),reroll=page.locator('[data-quest-slot="1"] [data-reroll]');expect(await action.evaluate(element=>element.tagName)).toBe('BUTTON');await expect(action).toContainText('Starta');expect(await action.locator('.daily-quest-start').evaluate(element=>getComputedStyle(element).backgroundColor)).toBe('rgb(29, 96, 79)');expect(await reroll.evaluate(element=>getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');await reroll.click();await expect(page).toHaveURL(url);await expect(page.getByRole('dialog',{name:'Dagens uppdrag'})).toBeVisible();expect(await page.evaluate(key=>localStorage.getItem(key),UI)).toBeNull();
  await page.locator('[data-quest-action="1"]').click();await expect(page).toHaveURL(/\/kortit\/harjoitus\?.*mode=lucky.*amount=10/);
  await page.goto('/');await closeIfOpen(page);await seedDay(page,{quest:{kind:'variety',target:2},modes:['flashcards']});await page.reload();await openDaily(page);await page.locator('[data-quest-action="1"]').click();await expect(page).toHaveURL(/\/fraasit\/harjoitus\?.*mode=all/);
});

test('reroll availability is consistent in the overlay and Framsteg',async({page})=>{
  await page.goto('/');await closeIfOpen(page);await seedDay(page,{freeRerollUsed:true,rerollTokens:0});await page.reload();await openDaily(page);
  await expect(page.locator('.daily-overlay-quests [data-reroll]')).toHaveCount(0);await expect(page.locator('[data-quest-action]')).toHaveCount(3);
  await page.getByRole('button',{name:'Stäng dagens uppdrag'}).click();await page.goto('/edistyminen/');await expect(page.locator('.quest [data-reroll]')).toHaveCount(0);

  await page.goto('/');await closeIfOpen(page);await seedDay(page,{freeRerollUsed:true,rerollTokens:1});await page.reload();await openDaily(page);const reroll=page.locator('[data-quest-slot="2"] [data-reroll]');await expect(reroll).toBeVisible();await reroll.click();
  await expect(page.locator('.daily-overlay-quests [data-reroll]')).toHaveCount(0);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).inventory.rerollTokens,PROGRESS)).toBe(0);

  await page.getByRole('button',{name:'Stäng dagens uppdrag'}).click();await seedDay(page,{claimedSlots:[1],freeRerollUsed:false,rerollTokens:1});await page.reload();await openDaily(page);await expect(page.locator('[data-quest-slot="1"] [data-reroll]')).toHaveCount(0);await expect(page.locator('[data-quest-slot="2"] [data-reroll]')).toBeVisible();
});

test('a valid existing phrase session is resumed',async({page})=>{
  await page.goto('/');await closeIfOpen(page);await seedDay(page,{quest:{kind:'mode',mode:'phrases',target:5}});await page.evaluate(()=>localStorage.setItem('medicinsk-svenska.phrase-session.v1',JSON.stringify({schemaVersion:1,sessionId:'daily-resume-phrase',mode:'category',sourceCategoryId:'oireet-vointi',requestedAmount:10,selectedPhraseIds:['fraasi-oireet-vointi-gora-ont'],unseenPhraseQueue:[],currentPhraseId:'fraasi-oireet-vointi-gora-ont',revealed:false,masteredPhraseIds:[],pendingRetries:[],attemptCountByPhrase:{},firstAttemptCorrectByPhrase:{},totalMissedCount:0,startedAt:Date.now()})));await page.reload();await openDaily(page);await page.locator('[data-quest-action="1"]').click();await expect(page).toHaveURL(/\/fraasit\/harjoitus\?.*session=daily-resume-phrase/);await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeVisible();
});

test('closed overlay stays closed while synchronized progress updates launcher and HUD',async({page})=>{
  await page.goto('/');await closeIfOpen(page);await seedDay(page);await page.reload();await closeIfOpen(page);await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);const day=Object.keys(state.daily).sort().at(-1);if(!day)throw new Error('missing seeded day');state.daily[day].quests[0].claimed=true;state.daily[day].uniqueItemIds=Array.from({length:7},(_,i)=>`flashcards:sync-${i}`);state.inventory.credits=321;state.inventory.capsules.push({id:'sync-box',kind:'standard',earnedAt:Date.now()});localStorage.setItem(key,JSON.stringify(state));window.dispatchEvent(new CustomEvent('progress-updated'));},PROGRESS);
  await expect(page.getByRole('dialog',{name:'Dagens uppdrag'})).toBeHidden();await expect(page.getByRole('button',{name:/Dagens uppdrag 1 \/ 3 Dagens mål 7 \/ 10/})).toBeVisible();await expect(page.locator('#metagame-hud')).toContainText('321');await expect(page.locator('.hud-boxes')).toContainText('Öppna');await page.locator('.hud-boxes').click();await expect(page).toHaveURL(/\/palkinnot\/#unopened-boxes$/);
});

test('dialog restores focus, closes with Escape, contains focus, fits phones, and passes axe',async({page})=>{
  await page.setViewportSize({width:320,height:568});await page.goto('/');await closeIfOpen(page);const launcher=page.getByRole('button',{name:/Dagens uppdrag/});await launcher.focus();await launcher.press('Enter');const dialog=page.getByRole('dialog',{name:'Dagens uppdrag'}),close=page.getByRole('button',{name:'Stäng dagens uppdrag'});await expect(dialog).toBeVisible();await expect(close).toHaveText('×');expect(await page.evaluate(()=>document.querySelector('#daily-overlay')?.contains(document.activeElement))).toBe(true);
  const closeBox=await close.boundingBox();expect(Math.round(closeBox!.width)).toBeGreaterThanOrEqual(44);expect(Math.round(closeBox!.height)).toBeGreaterThanOrEqual(44);for(let index=0;index<10;index++)await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.querySelector('#daily-overlay')?.contains(document.activeElement))).toBe(true);const box=await dialog.boundingBox();expect(box!.width).toBeLessThanOrEqual(320);expect(box!.height).toBeLessThanOrEqual(568*.89);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);expect((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);const wideBox=await dialog.boundingBox();expect(wideBox!.width).toBeLessThanOrEqual(390);expect(wideBox!.height).toBeLessThanOrEqual(844*.89);
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(launcher).toBeFocused();expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),UI)).toMatchObject({schemaVersion:1,dailyOverlayDismissedDay:expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)});
  await launcher.click();await expect(dialog).toBeVisible();const backdropBox=await dialog.boundingBox();await page.mouse.click(10,Math.max(1,backdropBox!.y-10));await expect(dialog).toBeHidden();await expect(launcher).toBeFocused();expect(await page.evaluate(key=>localStorage.getItem(key),UI)).not.toBeNull();await page.reload();await expect(dialog).toBeHidden();
});

test('active exercise routes contain neither the daily overlay nor the HUD',async({page})=>{
  for(const route of ['/kortit/harjoitus?mode=lucky&direction=fi-sv&amount=10&session=active-cards','/fraasit/harjoitus?mode=all&amount=10&session=active-phrases','/kuvailu/harjoitus?mode=all&amount=10&session=active-descriptions']){await page.goto(route);await expect(page.locator('#daily-overlay,#metagame-hud')).toHaveCount(0);}
});
