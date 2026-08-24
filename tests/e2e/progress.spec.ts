import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSpecificCard } from './helpers';

const PROGRESS='medicinsk-svenska.progress.v1';
const readProgress=(page:import('@playwright/test').Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),PROGRESS);

test('fresh home is a compact launcher with HUD and an automatic daily overlay',async({page})=>{
  await page.goto('/');await expect(page.getByRole('dialog',{name:'Dagens uppdrag'})).toBeVisible();await expect(page.getByRole('heading',{name:'Dagens mål'})).toBeVisible();await expect(page.locator('.overlay-goal')).toContainText('0 / 10');await expect(page.getByText('Vanlig belöning · 10 krediter · 20 säsongspoäng')).toBeVisible();
  await expect(page.locator('#metagame-hud')).toContainText('Nivå');await expect(page.locator('#metagame-hud')).toContainText('Svit');await expect(page.locator('#metagame-hud')).toContainText('Krediter');await expect(page.locator('#metagame-hud')).toContainText('Belöningar');
  await expect(page.locator('.daily-overlay-quests .daily-quest-row')).toHaveCount(3);await expect(page.getByText('Gör 10 olika uppgifter')).toBeVisible();await expect(page.getByText('Suorita 10 eri tehtävää')).toBeVisible();await expect(page.getByText('Slutför alla tre och få en gyllene belöning')).toBeVisible();
  await page.getByRole('button',{name:'Stäng dagens uppdrag'}).click();await expect(page.getByRole('button',{name:/Dagens uppdrag 0 \/ 3/})).toBeVisible();await expect(page.locator('.home .quest,.home .daily-quest-row')).toHaveCount(0);
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
  await page.getByRole('button',{name:/Gyllene belöning Öppna/}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('#capsule-rarity')).toHaveText(/Sällsynt|Episk|Legendarisk/);await page.getByRole('button',{name:'Stäng'}).click();
  const progress=await readProgress(page);expect(progress.inventory.capsules.find((c:{id:string})=>c.id==='browser-capsule').openedAt).toBeTruthy();await page.reload();await expect(page.getByRole('button',{name:/Gyllene belöning Öppna/})).toHaveCount(0);
});

test('rewards information architecture keeps the shop near the top and collection compact',async({page})=>{
  await page.setViewportSize({width:320,height:568});await page.goto('/palkinnot/');await expect(page.locator('.inventory-head')).toBeVisible();
  const shop=page.getByRole('heading',{name:'Dagens butik'}),collection=page.getByRole('heading',{name:/Samling/});await expect(shop).toBeVisible();await expect(collection).toBeVisible();
  expect(await page.evaluate(()=>{const shop=document.querySelector('#daily-shop'),collection=document.querySelector('#collection');return Boolean(shop&&collection&&(shop.compareDocumentPosition(collection)&Node.DOCUMENT_POSITION_FOLLOWING));})).toBe(true);
  expect((await shop.boundingBox())!.y).toBeLessThan(568*1.5);await expect(page.getByRole('heading',{name:'Utseende'})).toBeVisible();await expect(page.getByRole('heading',{name:'Utrustning'})).toHaveCount(0);await expect(page.getByRole('button',{name:/Lös in för \d+ krediter/}).first()).toBeVisible();
  await expect(page.locator('#daily-shop .offer[data-offer-type="cosmetic"] .cosmetic-preview')).toHaveCount(2);await expect(page.locator('#daily-shop .offer[data-offer-type="cosmetic"] .rarity-frame')).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});expect((await shop.boundingBox())!.y).toBeLessThan(844);await expect(page.locator('#collection .collectible')).toHaveCount(4);await expect(page.locator('#collection')).toContainText('Bassamling 0 / 36');await expect(page.locator('#collection')).toContainText('Säsong 0 / 4');await page.getByRole('button',{name:'Visa alla'}).click();await expect(page.locator('#collection .collectible')).toHaveCount(44);await expect(page.locator('#collection .cosmetic-preview')).toHaveCount(44);await expect(page.locator('#collection .cosmetic-swatch .app-icon,#collection .rarity-frame')).toHaveCount(0);await expect(page.locator('#collection-filter')).toHaveValue('all');
});

test('equipped cosmetics apply to real study cards, passport frames, and previews',async({page})=>{
  await page.goto('/palkinnot/');await expect(page.locator('.inventory-head')).toBeVisible();await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);for(const id of ['theme-3','cardStyle-8','progressFrame-8','title-9'])if(!state.inventory.ownedCosmeticIds.includes(id))state.inventory.ownedCosmeticIds.push(id);state.inventory.equipped={theme:'theme-3',cardStyle:'cardStyle-8',progressFrame:'progressFrame-8',title:'title-9'};localStorage.setItem(key,JSON.stringify(state));},PROGRESS);await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','theme-3');await expect(page.locator('html')).toHaveAttribute('data-card-style','cardStyle-8');await expect(page.locator('html')).toHaveAttribute('data-progress-frame','progressFrame-8');await expect(page.locator('html')).toHaveAttribute('data-title','title-9');await expect(page.locator('#appearance .cosmetic-preview.equipped')).toHaveCount(3);
  await openSpecificCard(page,{id:'anatomi-001',deckId:'anatomi'},'fi-sv');await expect(page.locator('html')).toHaveAttribute('data-card-style','cardStyle-8');expect(await page.locator('#flashcard').evaluate(node=>getComputedStyle(node).borderTopWidth)).toBe('3px');expect(await page.locator('#flashcard').evaluate(node=>getComputedStyle(node).borderTopColor)).not.toBe('rgb(191, 212, 227)');
  await page.goto('/edistyminen/');await expect(page.locator('.passport-card')).toHaveAttribute('data-progress-frame-id','progressFrame-8');await expect(page.locator('.passport-card')).toHaveAttribute('data-title-id','title-9');expect(await page.locator('.passport-card').evaluate(node=>getComputedStyle(node).boxShadow)).toContain('rgb');
});

test('seasonal cosmetics remain visible, filterable, locked when unowned, and never award display-only ownership',async({page})=>{
  await page.goto('/palkinnot/');await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key)!==null,PROGRESS)).toBe(true);const before=await readProgress(page);
  await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.inventory.ownedCosmeticIds.push('season-rare');localStorage.setItem(key,JSON.stringify(state));},PROGRESS);await page.reload();
  const seasonal=page.locator('[data-cosmetic-id="season-rare"]');await expect(seasonal).toBeVisible();await expect(seasonal).toContainText('Säsong');await expect(page.locator('#collection')).toContainText('Bassamling 0 / 36');await expect(page.locator('#collection')).toContainText('Säsong 1 / 4');
  await page.locator('#collection-filter').selectOption('title');await expect(seasonal).toBeVisible();await page.getByRole('button',{name:'Visa alla'}).click();
  for(const id of ['season-rare','season-epic-1','season-epic-2','season-legendary'])await expect(page.locator(`[data-cosmetic-id="${id}"]`)).toHaveCount(1);
  await expect(page.locator('[data-cosmetic-id="season-epic-1"]')).toHaveClass(/locked/);const after=await readProgress(page);
  expect(after.inventory.ownedCosmeticIds).toEqual([...before.inventory.ownedCosmeticIds,'season-rare']);expect(after.inventory.credits).toBe(before.inventory.credits);
});

test('shop is stable and a purchase deducts credits only once',async({page})=>{
  await page.goto('/palkinnot/');await expect(page.locator('.inventory-head')).toBeVisible();await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key)!==null,PROGRESS)).toBe(true);await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.inventory.credits=1000;localStorage.setItem(key,JSON.stringify(state));},PROGRESS);await page.reload();
  const labels=await page.locator('.offer strong').allTextContents(),button=page.locator('.offer button').first();const before=(await readProgress(page)).inventory.credits;await button.click();const after=(await readProgress(page)).inventory.credits;expect(after).toBeLessThan(before);await page.reload();expect(await page.locator('.offer strong').allTextContents()).toEqual(labels);await expect(page.locator('.offer button').first()).toBeDisabled();
});

test('season and league use compact portrait navigation with complete personal detail',async({page})=>{
  await page.setViewportSize({width:320,height:568});await page.goto('/kausi/');await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.seasons.points=450;state.seasons.claimedTiers=[1,2,4];state.league.tier='Hopea';state.league.weeklyXp=200;state.league.result={kind:'promoted',tier:'Hopea'};localStorage.setItem(key,JSON.stringify(state));},PROGRESS);await page.reload();
  await expect(page.locator('.season-summary')).toContainText('Steg 4 av 30');await expect(page.locator('.league-summary')).toContainText('Silver');await expect(page.locator('.league-summary')).toContainText('50 XP kvar');
  const rewardsTab=page.getByRole('tab',{name:'Belöningsspår'}),leagueTab=page.getByRole('tab',{name:'Veckoliga'});await expect(rewardsTab).toHaveAttribute('aria-selected','true');await expect(page.locator('#reward-track')).toBeVisible();await expect(page.locator('#league')).toBeHidden();await expect(page.locator('.tier')).toHaveCount(5);expect(await page.locator('.tier').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-tier')))).toEqual(['3','4','5','6','7']);
  await leagueTab.click();await expect(leagueTab).toHaveAttribute('aria-selected','true');await expect(page.locator('#reward-track')).toBeHidden();await expect(page.locator('#league')).toBeVisible();await expect(page.locator('#league')).toContainText('Veckans XP200 XP');await expect(page.locator('#league')).toContainText('Till Guld: 250 XP');await expect(page.locator('#league')).toContainText('50 XP');await expect(page.locator('#league [role="progressbar"]')).toHaveAttribute('aria-valuenow','200');await expect(page.locator('#league')).toContainText('Förra resultatet: Du steg till Silver');await expect(page.getByText('Ingen påhittad topplista och inga falska motståndare.')).toBeVisible();
  await rewardsTab.click();await page.getByRole('button',{name:'Visa alla 30 steg'}).click();await expect(page.locator('.tier')).toHaveCount(30);await expect(page.getByText(/premium|osta|pelaaja/i)).toHaveCount(0);
});

test('league UI follows the immediate retention, promotion, secured, and top-tier targets',async({page})=>{
  await page.setViewportSize({width:320,height:568});await page.goto('/kausi/');
  const verify=async(tier:string,xp:number,copy:string,target:number,remaining:number)=>{await page.evaluate(({key,tier,xp})=>{const state=JSON.parse(localStorage.getItem(key)!);state.league.tier=tier;state.league.weeklyXp=xp;localStorage.setItem(key,JSON.stringify(state));},{key:PROGRESS,tier,xp});await page.reload();await page.getByRole('tab',{name:'Veckoliga'}).click();const detail=page.locator('#league'),bar=detail.getByRole('progressbar');await expect(detail).toContainText(`${copy}: ${target} XP`);await expect(detail).toContainText(`${remaining} XP`);await expect(bar).toHaveAttribute('aria-valuemin','0');await expect(bar).toHaveAttribute('aria-valuemax',String(target));await expect(bar).toHaveAttribute('aria-valuenow',String(Math.min(xp,target)));await expect(bar).toHaveAttribute('aria-label',`${copy}: ${Math.min(xp,target)} av ${target} XP`);};
  await verify('Hopea',50,'Behåll Silver',75,25);await verify('Hopea',75,'Till Guld',250,175);await verify('Hopea',250,'Befordran till Guld säkrad',250,0);await verify('Konsultti',475,'Behåll Mästare',500,25);
});

test('weekly quests show bilingual live progress, accessible bars, and compact rewards',async({page})=>{
  await page.goto('/edistyminen/');await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);const date=new Date(),today=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;state.daily[today]={uniqueItemIds:Array.from({length:40},(_,item)=>`flashcards:weekly-${item}`),completedItems:40,activeStudyMs:0,xp:0,modes:['flashcards','phrases','descriptions'],sessionsStarted:0,sessionsCompleted:0,retriesMastered:0,goalTarget:10,goalClaimed:false,qualified:false,freezeUsed:false,quests:[],freeRerollUsed:false,allQuestsClaimed:false,sessionDropEligible:0,sessionDropAwarded:false};localStorage.setItem(key,JSON.stringify(state));},PROGRESS);await page.reload();
  const quests=page.locator('.weekly-quest');await expect(quests).toHaveCount(3);await expect(quests.nth(0)).toContainText('Studera under 5 dagar');await expect(quests.nth(0)).toContainText('Opiskele viitenä päivänä');await expect(quests.nth(0)).toContainText('1 / 5');await expect(quests.nth(1)).toContainText('40 / 100');await expect(quests.nth(2)).toContainText('Klart');for(let index=0;index<3;index++){await expect(quests.nth(index).locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow',index===0?'1':index===1?'40':'3');await expect(quests.nth(index)).toContainText('+25 XP · +30 krediter · +30 säsongspoäng');}
});

test('legacy V1 display strings are ignored without changing progress or replaying rewards',async({page})=>{
  await page.goto('/');const before=await readProgress(page);await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.lifetime.xp=340;state.inventory.credits=120;state.inventory.capsules.push({id:'legacy-box',kind:'standard',earnedAt:1});state.daily['2026-08-21']={uniqueItemIds:[],completedItems:0,activeStudyMs:0,xp:0,modes:[],sessionsStarted:0,sessionsCompleted:0,retriesMastered:0,goalTarget:10,goalClaimed:false,qualified:false,freezeUsed:false,quests:[{id:'2026-08-21:1:0',slot:1,kind:'items',label:'stale quest',target:10,xp:5,credits:10,seasonPoints:10,rerollIndex:0,claimed:true}],freeRerollUsed:false,allQuestsClaimed:false,sessionDropEligible:0,sessionDropAwarded:false};state.notifications=[{id:'old',message:'stale message'}];state.league.previousResult='stale result';state.sessionRewards={legacy:['+20 XP','stale reward']};localStorage.setItem(key,JSON.stringify(state));},PROGRESS);await page.reload();
  const after=await readProgress(page);expect(after.lifetime.xp).toBe(340);expect(after.inventory.credits).toBe(120);expect(after.inventory.capsules.filter((item:{id:string})=>item.id==='legacy-box')).toHaveLength(1);expect(after.processedEventIds).toEqual(before.processedEventIds);await expect(page.getByText('stale quest')).toHaveCount(0);await expect(page.getByText('stale message')).toHaveCount(0);await expect(page.getByText('stale result')).toHaveCount(0);
});

test('reward surfacing links directly and active exercises omit the full HUD',async({page})=>{
  await page.goto('/');await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key)!);state.inventory.capsules.push({id:'home-box',kind:'standard',earnedAt:Date.now()});state.seasons.points=100;state.settings.calmMode=true;localStorage.setItem(key,JSON.stringify(state));},PROGRESS);await page.reload();
  await expect(page.locator('.hud-boxes')).toContainText('1');await expect(page.locator('.hud-boxes')).toContainText('Öppna');await expect(page.getByText(/säsongsbelöning väntar/)).toHaveCount(0);expect(await page.locator('.hud-boxes').evaluate(element=>getComputedStyle(element).animationName)).toBe('none');await page.locator('.hud-boxes').click();await expect(page).toHaveURL(/\/palkinnot\/#unopened-boxes$/);
  await page.goto('/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=no-hud');await expect(page.locator('#metagame-hud')).toHaveCount(0);
});

test('export and reset leave active exercise session storage separate',async({page})=>{
  await openSpecificCard(page,{id:'anatomi-001',deckId:'anatomi'},'fi-sv');const session=await page.evaluate(()=>localStorage.getItem('medicinsk-svenska.flashcard-session.v1'));await page.goto('/edistyminen/');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Vie tiedot'}).click();expect((await download).suggestedFilename()).toMatch(/^medicinsk-svenska-progress-\d{4}-\d{2}-\d{2}\.json$/);
  page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Nollaa edistyminen'}).click();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('medicinsk-svenska.flashcard-session.v1'))).toBe(session);
});

test('new routes have no serious accessibility violations or portrait overflow',async({page})=>{
  for(const viewport of [{width:320,height:568},{width:390,height:844}]){await page.setViewportSize(viewport);for(const route of ['/','/edistyminen/','/palkinnot/','/kausi/']){await page.goto(route);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),`${route} at ${viewport.width}`).toBe(true);expect((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??'')),route).toEqual([]);}}
});
