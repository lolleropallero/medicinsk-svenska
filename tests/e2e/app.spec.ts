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
test('starts a deck in each direction and supports keyboard grading',async({page})=>{
  await page.goto('/kortit'); await page.getByRole('link',{name:'Aloita'}).first().click();
  await expect(page.locator('#side-label')).toHaveText('Suomeksi'); await page.keyboard.press('Space'); await expect(page.locator('#answer-area')).toBeVisible();
  await page.keyboard.press('1'); await page.keyboard.press('Enter'); await expect(page.locator('#progress')).toContainText('2 /');
  await page.goto('/kortit'); await page.getByLabel('Ruotsi → suomi').check(); await page.getByRole('link',{name:'Aloita'}).first().click(); await expect(page.locator('#side-label')).toHaveText('Ruotsiksi');
});
test('completes the shortest deck and retries missed cards',async({page})=>{
  await page.goto('/kortit/harjoitus?deck=avdelningar&direction=fi-sv');
  for(let i=0;i<13;i++){await page.getByRole('button',{name:/Näytä vastaus/}).click();await page.getByRole('button',{name:i===0?/En osannut/:/Osasin/}).click();await page.getByRole('button',{name:/Seuraava/}).click()}
  await expect(page.locator('#summary-copy')).toHaveText('12 / 13 oikein');
  await page.getByRole('button',{name:'Harjoittele virheet uudelleen'}).click(); await expect(page.locator('#progress')).toHaveText('1 / 1');
});
test('lucky session contains exactly 50 cards',async({page})=>{
  await page.goto('/kortit'); await page.getByRole('link',{name:/Kokeilen onneani/}).click(); await expect(page.locator('#progress')).toContainText('/ 50');
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
    for(const route of ['/','/kortit/','/kortit/harjoitus?deck=avdelningar&direction=sv-fi','/kuvailu/']){
      await page.goto(route); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    }
  }
  await expect(page.locator('#description-text')).toBeVisible();
});
