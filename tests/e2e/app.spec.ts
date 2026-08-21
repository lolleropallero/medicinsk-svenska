import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openSpecificCard } from './helpers';

test('landing page and core routes are accessible',async({page})=>{
  await page.goto('/'); await expect(page.getByRole('heading',{name:'Harjoittele lääketieteellistä ruotsia'})).toBeVisible();
  const landingText=await page.locator('body').innerText();
  for(const removed of ['Ruotsi osaksi','Kaksi tapaa harjoitella','Valitse tämän päivän tavoite','Lääketieteen opiskelijoille','Itsenäiseen opiskeluun']) expect(landingText).not.toContain(removed);
  expect((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
  await page.getByRole('link',{name:'Sanakortit'}).first().click(); await expect(page.getByRole('heading',{name:'Sanakortit'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Valitse pakka'})).toHaveCount(0);
});
test('selects session size and supports tap and keyboard grading in both directions',async({page})=>{
  await page.goto('/kortit');
  await expect(page.getByRole('group',{name:'Korttien määrä'}).getByLabel('25')).toBeChecked();
  await page.getByRole('group',{name:'Korttien määrä'}).locator('label').filter({hasText:'10'}).click();
  await page.getByRole('link',{name:'Aloita'}).first().click();
  await expect(page.locator('#progress')).toHaveText('0 / 10');
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
  await expect(page.getByRole('button',{name:'Osasin'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Seuraava/})).toHaveCount(0);
  await page.keyboard.press('1');
  await expect(page.locator('#progress')).toHaveText('1 / 10');
  await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeFocused();

  await page.goto('/kortit'); await page.getByLabel('Ruotsi → suomi').check();
  await page.getByRole('link',{name:'Aloita'}).first().click();
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(state.direction).toBe('sv-fi');
  await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('#answer-area')).toBeVisible();
});
test('persists an exact five-minute retry, waits, then completes after mastery',async({page})=>{
  await page.goto('/kortit/harjoitus?mode=deck&deck=avdelningar&direction=fi-sv&amount=10&session=retry-test');
  const beforeMiss=Date.now();
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await page.getByRole('button',{name:'En osannut'}).click();
  const afterMiss=Date.now();
  const missedState=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!));
  expect(missedState.pendingRetries).toHaveLength(1);
  expect(missedState.pendingRetries[0].dueAt).toBeGreaterThanOrEqual(beforeMiss+5*60*1000);
  expect(missedState.pendingRetries[0].dueAt).toBeLessThanOrEqual(afterMiss+5*60*1000);
  for(let i=0;i<2;i++){
    await page.getByRole('button',{name:'Näytä vastaus'}).click();
    await page.getByRole('button',{name:'En osannut'}).click();
  }
  for(let i=0;i<7;i++){
    await page.getByRole('button',{name:'Näytä vastaus'}).click();
    await page.getByRole('button',{name:'Osasin'}).click();
  }
  await expect(page.locator('#waiting-copy')).toHaveText('3 korttia odottaa kertausta');
  await expect(page.getByText(/Seuraava kertaus/)).toBeVisible();
  await expect(page.locator('#retry-countdown')).toHaveText(/04:5\d|05:00/);
  await expect(page.getByRole('heading',{name:'Harjoitus valmis'})).toBeHidden();
  await page.evaluate(()=>{
    const key='medicinsk-svenska.flashcard-session.v1';
    const state=JSON.parse(localStorage.getItem(key)!);
    state.pendingRetries.forEach((retry:{dueAt:number})=>{retry.dueAt=Date.now()-1});
    localStorage.setItem(key,JSON.stringify(state));
  });
  await page.reload();
  for(let i=0;i<3;i++){
    await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeVisible();
    await page.getByRole('button',{name:'Näytä vastaus'}).click();
    await page.getByRole('button',{name:'Osasin'}).click();
  }
  await expect(page.getByRole('heading',{name:'Harjoitus valmis'})).toBeVisible();
  await expect(page.locator('#summary-copy')).toHaveText('10 / 10 osattu');
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
  await expect(page.locator('#progress')).toHaveText('0 / 13');
});
test('description accepts correct and incorrect answers and can reveal',async({page})=>{
  await page.addInitScript(()=>{let calls=0;Math.random=()=>calls++<29?0:0.999});
  await page.goto('/kuvailu'); const data=await page.locator('#descriptions-data').textContent(); const firstText=await page.locator('#description-text').textContent();
  const items=JSON.parse(data!); const item=items.find((x:{descriptionSv:string})=>x.descriptionSv===firstText);
  expect(item.id).toBe('beskrivning-023');
  const interfaceText=await page.locator('body').innerText();
  for(const removed of ['Till startsidan','Beskrivningsövning','Vad beskrivs?','Ditt svar','Kontrollera','Visa svaret','Rätt svar','Nästa','Bra arbetat','Öva misstagen igen']) expect(interfaceText).not.toContain(removed);
  await expect(page.locator('#description-text')).toBeVisible(); await expect(page.locator('#description-text')).toHaveAttribute('lang','sv');
  await expect(page.getByLabel('Vastauksesi')).toHaveAttribute('lang','sv');
  await page.getByLabel('Vastauksesi').fill('HJÄRTAT.'); await page.getByRole('button',{name:'Tarkista'}).click(); await expect(page.getByText('Oikein',{exact:true})).toBeVisible();
  await expect(page.locator('#canonical-answer')).toHaveText('ett hjärta'); await expect(page.locator('#canonical-answer')).toHaveAttribute('lang','sv');
  await page.getByRole('button',{name:'Seuraava'}).click(); await page.getByLabel('Vastauksesi').fill('fel svar'); await page.getByRole('button',{name:'Tarkista'}).click(); await expect(page.getByText('Ei aivan')).toBeVisible();
  await page.getByRole('button',{name:'Seuraava'}).click(); await page.getByRole('button',{name:'Näytä vastaus'}).click(); await expect(page.getByText('Vastaus näytetty')).toBeVisible();
});
test('tablet and narrow mobile viewports have no overflow and direct routes load',async({page})=>{
  for(const width of [768,320]){
    await page.setViewportSize({width,height:700});
    for(const route of ['/','/kortit/','/kortit/harjoitus?mode=deck&deck=avdelningar&direction=sv-fi&amount=10&session=mobile-test','/kuvailu/']){
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
  await page.goto('/kuvailu');
  const descriptions=JSON.parse((await page.locator('#descriptions-data').textContent())!);
  const descriptionKeys=new Set(['id','descriptionSv','answerSv','acceptedInflections','article','inflection']);
  expect(descriptions.every((item:Record<string,unknown>)=>Object.keys(item).every(key=>descriptionKeys.has(key)))).toBe(true);
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
