import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
  for(let i=0;i<9;i++){
    await page.getByRole('button',{name:'Näytä vastaus'}).click();
    await page.getByRole('button',{name:'Osasin'}).click();
  }
  await expect(page.getByRole('heading',{name:'Kertaus odottaa'})).toBeVisible();
  await expect(page.locator('#retry-countdown')).toHaveText(/4:5\d|5:00/);
  await expect(page.getByRole('heading',{name:'Harjoitus valmis'})).toBeHidden();
  await page.evaluate(()=>{
    const key='medicinsk-svenska.flashcard-session.v1';
    const state=JSON.parse(localStorage.getItem(key)!);
    state.pendingRetries[0].dueAt=Date.now()-1;
    localStorage.setItem(key,JSON.stringify(state));
  });
  await page.reload();
  await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeVisible();
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await page.getByRole('button',{name:'Osasin'}).click();
  await expect(page.getByRole('heading',{name:'Harjoitus valmis'})).toBeVisible();
  await expect(page.locator('#summary-copy')).toHaveText('10 / 10 osattu');
});
test('lucky mode respects 10, 50, and Kaikki without duplicates',async({page})=>{
  for(const [label,expected] of [['10',10],['50',50]] as const){
    await page.goto('/kortit'); await page.getByRole('group',{name:'Korttien määrä'}).locator('label').filter({hasText:label}).click();
    await page.getByRole('link',{name:/Kokeilen onneani/}).click();
    const ids=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!).selectedCardIds as string[]);
    expect(ids).toHaveLength(expected); expect(new Set(ids).size).toBe(expected);
  }
  await page.goto('/kortit'); await page.getByRole('group',{name:'Korttien määrä'}).locator('label').filter({hasText:'Kaikki'}).click();
  await page.getByRole('link',{name:/Kokeilen onneani/}).click();
  const all=await page.evaluate(()=>JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!).selectedCardIds as string[]);
  const available=await page.locator('#cards-data').evaluate(node=>JSON.parse(node.textContent??'[]').length);
  expect(new Set(all).size).toBe(all.length); expect(all).toHaveLength(available);
  await page.goto('/kortit/harjoitus?mode=deck&deck=avdelningar&direction=fi-sv&amount=50&session=small-pool');
  await expect(page.locator('#progress')).toHaveText('0 / 13');
});
test('description accepts correct and incorrect answers and can reveal',async({page})=>{
  await page.goto('/kuvailu'); const data=await page.locator('#descriptions-data').textContent(); const firstText=await page.locator('#description-text').textContent();
  const items=JSON.parse(data!); const item=items.find((x:{descriptionSv:string})=>x.descriptionSv===firstText);
  const interfaceText=await page.locator('body').innerText();
  for(const removed of ['Till startsidan','Beskrivningsövning','Vad beskrivs?','Ditt svar','Kontrollera','Visa svaret','Rätt svar','Nästa','Bra arbetat','Öva misstagen igen']) expect(interfaceText).not.toContain(removed);
  await expect(page.locator('#description-text')).toBeVisible(); await expect(page.locator('#description-text')).toHaveAttribute('lang','sv');
  await expect(page.getByLabel('Vastauksesi')).toHaveAttribute('lang','sv');
  await page.getByLabel('Vastauksesi').fill(item.answerSv.toUpperCase()+'.'); await page.getByRole('button',{name:'Tarkista'}).click(); await expect(page.getByText('Oikein',{exact:true})).toBeVisible();
  await expect(page.locator('#canonical-answer')).toHaveText(item.answerSv); await expect(page.locator('#canonical-answer')).toHaveAttribute('lang','sv');
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
