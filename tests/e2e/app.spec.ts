import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { continuePastMilestone, openSpecificCard } from './helpers';

test('landing page and core routes are accessible',async({page})=>{
  await page.goto('/'); await expect(page.getByRole('heading',{name:'Dagens mål'})).toBeVisible();
  const landingText=await page.locator('body').innerText();
  for(const removed of ['Ruotsi osaksi','Kaksi tapaa harjoitella','Valitse tämän päivän tavoite','Lääketieteen opiskelijoille','Itsenäiseen opiskeluun']) expect(landingText).not.toContain(removed);
  expect((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
  await page.getByRole('button',{name:'Stäng dagens uppdrag'}).click();
  await page.getByRole('link',{name:'Sanakortit'}).first().click(); await expect(page.getByRole('heading',{name:'Sanakortit'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Valitse pakka'})).toHaveCount(0);
});
test('selects session size and supports tap and keyboard grading in both directions',async({page})=>{
  await page.goto('/kortit');
  await expect(page.getByRole('group',{name:'Korttien määrä'}).getByLabel('25')).toBeChecked();
  await page.getByRole('group',{name:'Korttien määrä'}).locator('label').filter({hasText:'10'}).click();
  const anatomyRow=page.locator('.deck-row').filter({hasText:'Anatomia'});
  expect(await anatomyRow.evaluate(element=>element.tagName)).toBe('A');
  await expect(anatomyRow.locator('a,button')).toHaveCount(0);
  await anatomyRow.getByRole('heading',{name:'Anatomia'}).click();
  await expect(page).toHaveURL(/mode=deck.*deck=anatomi|deck=anatomi.*mode=deck/);
  await expect(page.locator('#progress')).toHaveText('0 / 10');
  await expect(page.locator('#elapsed-time')).toHaveText('00:00');
  await expect(page.locator('#elapsed-time')).toHaveAttribute('aria-label','Kulunut aika 00:00');
  const persistedBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  await page.reload();
  const persistedAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(persistedAfter.selectedCardIds).toEqual(persistedBefore.selectedCardIds);
  expect(persistedAfter.startedAt).toBe(persistedBefore.startedAt);
  await expect(page.getByText('Suomeksi',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Ruotsiksi',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#answer-area')).toBeVisible();
  await expect(page.getByRole('button',{name:'En osannut'})).toBeVisible();
  await expect(page.getByRole('button',{name:'En osannut'})).toBeFocused();
  await expect(page.getByRole('button',{name:'Osasin'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Seuraava/})).toHaveCount(0);
  await page.keyboard.press('1');
  await continuePastMilestone(page);
  await expect(page.locator('#progress')).toHaveText('1 / 10');
  await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeFocused();

  await page.goto('/kortit'); await page.getByLabel('Ruotsi → suomi').check();
  await page.locator('.deck-row').filter({hasText:'Anatomia'}).click();
  await expect.poll(()=>page.evaluate(()=>{
    const stored=localStorage.getItem('medicinsk-svenska.flashcard-session.v1');
    return stored?JSON.parse(stored).direction:null;
  })).toBe('sv-fi');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(state.direction).toBe('sv-fi');
  await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('#answer-area')).toBeVisible();
});

test('the deck count area activates the same single semantic row link',async({page})=>{
  await page.goto('/kortit');
  const departments=page.locator('.deck-row').filter({hasText:'Osastot'});
  await departments.locator('.deck-count').click();
  await expect(page).toHaveURL(/deck=avdelningar/);
  await expect(page.locator('#session-label')).toHaveText('Osastot');
  const firstSession=new URL(page.url()).searchParams.get('session');
  await page.goto('/kortit');
  await page.locator('.deck-row').filter({hasText:'Osastot'}).focus();
  await page.keyboard.press('Enter');
  const keyboardSession=new URL(page.url()).searchParams.get('session');
  expect(keyboardSession).not.toBe(firstSession);
});

test('uses an absolute controlled clock for exact delayed retries and automatic focus',async({page})=>{
  const start = new Date('2026-01-01T10:00:00.000Z');
  await page.clock.install({time:start});
  await page.goto('/kortit/harjoitus?mode=deck&deck=avdelningar&direction=fi-sv&amount=10&session=retry-test');
  const missedAt=start.getTime()+1_000;
  await page.clock.pauseAt(missedAt);
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await expect(page.getByRole('button',{name:'En osannut'})).toBeFocused();
  await page.getByRole('button',{name:'En osannut'}).click();
  const missedState=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(missedState.pendingRetries).toHaveLength(1);
  expect(missedState.pendingRetries[0].dueAt).toBe(missedAt+5*60*1000);
  const retryCardId=missedState.pendingRetries[0].cardId;
  for(let i=0;i<9;i++){
    await page.getByRole('button',{name:'Näytä vastaus'}).click();
    await page.getByRole('button',{name:'Osasin'}).click();
    await continuePastMilestone(page);
  }
  await expect(page.locator('#waiting-copy')).toHaveText('1 kortti odottaa kertausta');
  await expect(page.locator('#waiting-copy')).toBeFocused();
  await expect(page.getByText(/Seuraava kertaus/)).toBeVisible();
  await expect(page.locator('#retry-countdown')).toHaveText('05:00');
  await expect(page.getByRole('link',{name:'Takaisin pakkoihin'})).toBeVisible();
  const waitingUrl=page.url();
  await page.getByRole('link',{name:'Takaisin pakkoihin'}).click();
  await expect(page.getByRole('heading',{name:'Sanakortit'})).toBeVisible();
  await page.goto(waitingUrl);
  const resumed=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(resumed.pendingRetries[0].cardId).toBe(retryCardId);
  await expect(page.locator('#waiting-copy')).toBeFocused();
  await page.clock.fastForward(299_999);
  const justBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(justBefore.currentCardId).toBeNull();
  expect(justBefore.pendingRetries[0].cardId).toBe(retryCardId);
  await expect(page.locator('#retry-countdown')).toHaveText('00:01');
  await page.reload();
  await expect(page.locator('#retry-countdown')).toHaveText('00:01');
  await page.clock.fastForward(1);
  await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeFocused();
  const dueState=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(dueState.currentCardId).toBe(retryCardId);
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await page.getByRole('button',{name:'En osannut'}).click();
  const failedAgain=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(failedAgain.pendingRetries).toEqual([{cardId:retryCardId,dueAt:missedAt+10*60*1000}]);
});
test('lucky mode respects 10, 50, and Kaikki without duplicates',async({page})=>{
  for(const [label,expected] of [['10',10],['50',50]] as const){
    await page.goto('/kortit'); await page.getByRole('group',{name:'Korttien määrä'}).locator('label').filter({hasText:label}).click();
    await page.getByRole('link',{name:/Kokeilen onneani/}).click();
    await expect.poll(()=>page.evaluate(()=>{
      const stored=localStorage.getItem('medicinsk-svenska.flashcard-session.v1');
      return stored?JSON.parse(stored).selectedCardIds.length:0;
    })).toBe(expected);
    const ids=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!).selectedCardIds as string[]);
    expect(ids).toHaveLength(expected); expect(new Set(ids).size).toBe(expected);
  }
  await page.goto('/kortit'); await page.getByRole('group',{name:'Korttien määrä'}).locator('label').filter({hasText:'Kaikki'}).click();
  await page.getByRole('link',{name:/Kokeilen onneani/}).click();
  const available=await page.locator('#cards-data').evaluate(node=>JSON.parse(node.textContent??'[]').length);
  await expect.poll(()=>page.evaluate(()=>{
    const stored=localStorage.getItem('medicinsk-svenska.flashcard-session.v1');
    return stored?JSON.parse(stored).selectedCardIds.length:0;
  })).toBe(available);
  const all=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!).selectedCardIds as string[]);
  expect(new Set(all).size).toBe(all.length); expect(all).toHaveLength(available);
  await page.goto('/kortit/harjoitus?mode=deck&deck=avdelningar&direction=fi-sv&amount=50&session=small-pool');
  await expect(page.locator('#progress')).toHaveText('0 / 18');
});
test('description route is a setup page with seven compact category links',async({page})=>{
  await page.goto('/kuvailu');
  await expect(page.getByRole('heading',{name:'Kuvailutehtävät'})).toBeVisible();
  await expect(page.locator('#description-text')).toHaveCount(0);
  await expect(page.locator('.category-row')).toHaveCount(7);
  await expect(page.getByRole('group',{name:'Tehtävien määrä'}).getByLabel('10')).toBeChecked();
});
test('portrait flashcard setup uses a compact semantic direction segment and touch-sized navigation',async({page})=>{
  await page.setViewportSize({width:320,height:568});await page.goto('/kortit/');
  const direction=page.getByRole('group',{name:'Harjoittelusuunta'}),finnish=direction.getByRole('radio',{name:'Suomi → ruotsi'}),swedish=direction.getByRole('radio',{name:'Ruotsi → suomi'});await expect(finnish).toBeChecked();await swedish.check();await expect(swedish).toBeChecked();await expect(finnish).not.toBeChecked();await expect(page.getByRole('group',{name:'Korttien määrä'})).toBeVisible();await expect(page.getByRole('link',{name:/Kokeilen onneani/})).toHaveAttribute('href',/direction=sv-fi/);
  const firstDeck=await page.locator('.deck-row').first().boundingBox();expect(firstDeck&&firstDeck.y).toBeLessThanOrEqual(568);
  for(const link of await page.locator('.site-header nav a').all()){const box=await link.boundingBox();expect(box?.height).toBeGreaterThanOrEqual(40);expect(box?.height).toBeLessThanOrEqual(44);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
test('tablet and narrow mobile viewports have no overflow and direct routes load',async({page})=>{
  for(const {width,height} of [{width:320,height:568},{width:390,height:844},{width:768,height:700}]){
    await page.setViewportSize({width,height});
    for(const route of ['/','/kortit/','/kortit/harjoitus?mode=deck&deck=avdelningar&direction=sv-fi&amount=10&session=mobile-test','/kuvailu/','/kuvailu/harjoitus?mode=all&amount=10&session=description-mobile']){
      await page.goto(route); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),`${route} at ${width}px`).toBe(true);
    }
  }
  await expect(page.locator('#description-text')).toBeVisible();
});

test('mobile grading controls are thumb-sized and the timer is visible',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/kortit/harjoitus?mode=deck&deck=avdelningar&direction=fi-sv&amount=10&session=mobile-controls');
  await expect(page.locator('#elapsed-time')).toBeVisible();
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  for(const name of ['En osannut','Osasin']){
    const box=await page.getByRole('button',{name}).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(52);
  }
  expect((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
});

test('corrected anatomy card works deterministically in both directions',async({page})=>{
  const card={id:'anatomi-004',deckId:'anatomi'};
  await openSpecificCard(page,card,'fi-sv');
  await expect(page.locator('#front-term')).toHaveText('munanjohdin');
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await expect(page.locator('#back-term')).toHaveText('en äggledare');
  await openSpecificCard(page,card,'sv-fi');
  await expect(page.locator('#front-term')).toHaveText('en äggledare');
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await expect(page.locator('#back-term')).toHaveText('munanjohdin');
});

test('grammar is hidden before reveal and uses Finnish labels after reveal',async({page})=>{
  await openSpecificCard(page,{id:'anatomi-024',deckId:'anatomi'},'fi-sv');
  await expect(page.locator('#grammar')).toBeHidden();
  await expect(page.getByText('fötter, fötterna',{exact:false})).toBeHidden();
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await expect(page.locator('#back-term')).toHaveText('en fot');
  await expect(page.locator('#grammar')).toHaveText('substantiivi · fötter, fötterna');
  await expect(page.getByText('noun',{exact:true})).toHaveCount(0);

  await page.setViewportSize({width:390,height:844});
  await openSpecificCard(page,{id:'mediciner-095',deckId:'mediciner'},'fi-sv');
  expect(await page.locator('#front-term').evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await expect(page.locator('#grammar')).toHaveText('adjektiivi');
  await expect(page.locator('#grammar')).not.toContainText('·');
  await expect(page.getByText('adjective',{exact:true})).toHaveCount(0);
});

test('rendered payloads contain only explicit client fields',async({page})=>{
  await page.goto('/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=payload-test');
  const cards=JSON.parse((await page.locator('#cards-data').textContent())!);
  const decks=JSON.parse((await page.locator('#decks-data').textContent())!);
  const cardKeys=new Set(['id','deckId','fi','sv','article','partOfSpeech','inflection']);
  expect(cards.every((card:Record<string,unknown>)=>Object.keys(card).every(key=>cardKeys.has(key)))).toBe(true);
  expect(decks.every((deck:Record<string,unknown>)=>Object.keys(deck).every(key=>['id','nameFi'].includes(key)))).toBe(true);
  expect(await page.locator('html').innerText()).not.toContain('published');
  await page.goto('/kuvailu/harjoitus?mode=all&amount=10&session=description-payload');
  const descriptions=JSON.parse((await page.locator('#descriptions-data').textContent())!);
  const descriptionKeys=new Set(['id','categoryId','descriptionSv','answerSv','acceptedInflections','article','inflection']);
  expect(descriptions.every((item:Record<string,unknown>)=>Object.keys(item).every(key=>descriptionKeys.has(key)))).toBe(true);
  const categories=JSON.parse((await page.locator('#description-categories-data').textContent())!);
  expect(categories.every((item:Record<string,unknown>)=>Object.keys(item).every(key=>['id','nameFi'].includes(key)))).toBe(true);
});

test('removed card IDs in stored sessions fail safely',async({page})=>{
  const sessionId='removed-card-test';
  await page.goto(`/kortit/harjoitus?mode=deck&deck=sjukdomar&direction=fi-sv&amount=10&session=${sessionId}`);
  await page.evaluate(({key,id,currentSessionId})=>{
    localStorage.setItem(key,JSON.stringify({schemaVersion:1,sessionId:currentSessionId,mode:'deck',sourceDeckId:'sjukdomar',direction:'fi-sv',requestedAmount:10,selectedCardIds:[id],unseenCardQueue:[],currentCardId:id,masteredCardIds:[],pendingRetries:[],attemptCountByCard:{},firstAttemptCorrectByCard:{},totalMissedCount:0,startedAt:Date.now(),revealed:false}));
  },{key:'medicinsk-svenska.flashcard-session.v1',id:'sjukdomar-117',currentSessionId:sessionId});
  await page.reload();
  await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeVisible();
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(state.selectedCardIds).not.toContain('sjukdomar-117');
  expect(state.selectedCardIds).toHaveLength(10);
});

test('long medical compounds wrap at 320 by 568 without accessibility violations',async({page})=>{
  await page.setViewportSize({width:320,height:568});
  await openSpecificCard(page,{id:'sjukdomar-091',deckId:'sjukdomar'},'sv-fi');
  await expect(page.locator('#front-term')).toHaveText('kolmonoxidförgiftning');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  expect(await page.locator('#front-term').evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
  expect((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
});

test('elapsed timer uses absolute time across controlled advances and reload',async({page})=>{
  const start=new Date('2026-02-01T12:00:00.000Z');
  await page.clock.install({time:start});
  await page.goto('/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=elapsed-clock');
  await page.clock.pauseAt(start.getTime()+1_000);
  await expect(page.locator('#elapsed-time')).toHaveText('00:00');
  const initialBox=await page.locator('#elapsed-time').boundingBox();
  await page.clock.fastForward(5_000);
  await expect(page.locator('#elapsed-time')).toHaveText('00:05');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  await page.reload();
  await expect(page.locator('#elapsed-time')).toHaveText('00:05');
  await page.clock.pauseAt(stored.startedAt+3_600_000);
  await expect(page.locator('#elapsed-time')).toHaveText('1:00:00');
  const hourBox=await page.locator('#elapsed-time').boundingBox();
  expect(hourBox?.width).toBe(initialBox?.width);
  await expect(page.locator('#elapsed-time')).toHaveAttribute('aria-label','Kulunut aika 1:00:00');
});

test('restored revealed state focuses the first grading action',async({page})=>{
  await openSpecificCard(page,{id:'anatomi-024',deckId:'anatomi'},'fi-sv');
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await expect(page.getByRole('button',{name:'En osannut'})).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button',{name:'En osannut'})).toBeFocused();
  await expect(page.locator('#flashcard')).toBeDisabled();
});

test('completion summary and Uusi kierros create fresh retained state',async({page})=>{
  await page.addInitScript(()=>{let value=0;Math.random=()=>{value=(value+0.137)%1;return value;}});
  const start=new Date('2026-03-01T09:00:00.000Z');
  await page.clock.install({time:start});
  await page.clock.pauseAt(start);
  await page.goto('/kortit/harjoitus?mode=deck&deck=avdelningar&direction=sv-fi&amount=10&session=summary-round');
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await page.getByRole('button',{name:'En osannut'}).click();
  for(let index=0;index<9;index+=1){
    await page.getByRole('button',{name:'Näytä vastaus'}).click();
    await page.getByRole('button',{name:'Osasin'}).click();
    await continuePastMilestone(page);
  }
  await page.clock.fastForward(5*60*1000);
  await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeFocused();
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await page.getByRole('button',{name:'Osasin'}).click();
  await continuePastMilestone(page);
  await expect(page.getByRole('heading',{name:'Valmis',exact:true})).toBeFocused();
  await expect(page.getByText('Ensimmäisellä')).toBeVisible();
  await expect(page.locator('#summary-first')).toHaveText('9 / 10');
  await expect(page.locator('#summary-missed')).toHaveText('1');
  await expect(page.locator('#summary-time')).toHaveText('05:00');
  await expect(page.getByText(/osattu|prosent/i)).toHaveCount(0);
  await page.clock.resume();
  expect((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);

  const oldState=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  await page.clock.fastForward(1_000);
  await page.getByRole('button',{name:'Uusi kierros'}).click();
  const newState=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(newState.sessionId).not.toBe(oldState.sessionId);
  expect(newState.startedAt).toBeGreaterThan(oldState.startedAt);
  expect(newState).toMatchObject({mode:'deck',sourceDeckId:'avdelningar',direction:'sv-fi',requestedAmount:10,totalMissedCount:0,revealed:false});
  expect(newState.selectedCardIds).not.toEqual(oldState.selectedCardIds);
  expect(newState.masteredCardIds).toEqual([]);
  expect(newState.pendingRetries).toEqual([]);
  expect(newState.attemptCountByCard).toEqual({});
  expect(newState.firstAttemptCorrectByCard).toEqual({});
  expect(new URL(page.url()).searchParams.get('session')).toBe(newState.sessionId);
  await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeFocused();
});

test('invalid deck URLs fail closed without persisting a zero-card session',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.clear());
  await page.goto('/kortit/harjoitus?mode=deck&deck=missing&direction=fi-sv&amount=10&session=invalid-deck');
  await expect(page.getByRole('heading',{name:'Pakkaa ei löytynyt'})).toBeFocused();
  await expect(page.getByRole('link',{name:'Takaisin pakkoihin'})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('medicinsk-svenska.flashcard-session.v1'))).toBeNull();
  expect((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
});

test('deck-mode stored cards from another deck are rejected and resampled safely',async({page})=>{
  const url='/kortit/harjoitus?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=wrong-deck-state';
  await page.goto(url);
  await page.evaluate(()=>{
    const key='medicinsk-svenska.flashcard-session.v1';
    const state=JSON.parse(localStorage.getItem(key)!);
    const oldCurrent=state.currentCardId;
    state.selectedCardIds=state.selectedCardIds.map((id:string)=>id===oldCurrent?'avdelningar-001':id);
    state.currentCardId='avdelningar-001';
    localStorage.setItem(key,JSON.stringify(state));
  });
  await page.reload();
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  const cards=JSON.parse((await page.locator('#cards-data').textContent())!);
  const byId=new Map(cards.map((card:{id:string;deckId:string})=>[card.id,card.deckId]));
  expect(state.selectedCardIds.every((id:string)=>byId.get(id)==='anatomi')).toBe(true);
  expect(state.selectedCardIds).not.toContain('avdelningar-001');
});

test('a valid URL without session ID receives a fresh recoverable identifier',async({page})=>{
  await page.goto('/kortit/harjoitus?mode=lucky&direction=fi-sv&amount=10');
  const sessionId=new URL(page.url()).searchParams.get('session');
  expect(sessionId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._~-]+$/);
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(state.sessionId).toBe(sessionId);
  expect(state.mode).toBe('lucky');
});
