import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing page and core routes are accessible',async({page})=>{
  await page.goto('/'); await expect(page.getByRole('heading',{name:/Ruotsi osaksi/})).toBeVisible();
  expect((await new AxeBuilder({page}).analyze()).violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([]);
  await page.getByRole('link',{name:'Sanakortit'}).first().click(); await expect(page.getByRole('heading',{name:'Valitse pakka'})).toBeVisible();
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
  await expect(page.getByText('Harjoitus valmis')).toBeVisible(); await expect(page.locator('#summary-copy')).toContainText('12 / 13');
  await page.getByRole('button',{name:'Harjoittele virheet uudelleen'}).click(); await expect(page.locator('#progress')).toHaveText('1 / 1');
});
test('lucky session contains exactly 50 cards',async({page})=>{
  await page.goto('/kortit'); await page.getByRole('link',{name:/Kokeilen onneani/}).click(); await expect(page.locator('#progress')).toContainText('/ 50');
});
test('description accepts correct and incorrect answers and can reveal',async({page})=>{
  await page.goto('/kuvailu'); const data=await page.locator('#descriptions-data').textContent(); const firstText=await page.locator('#description-text').textContent();
  const items=JSON.parse(data!); const item=items.find((x:{descriptionSv:string})=>x.descriptionSv===firstText);
  await page.getByLabel('Ditt svar').fill(item.answerSv.toUpperCase()+'.'); await page.getByRole('button',{name:'Kontrollera'}).click(); await expect(page.getByText('Rätt!')).toBeVisible();
  await page.getByRole('button',{name:'Nästa'}).click(); await page.getByLabel('Ditt svar').fill('fel svar'); await page.getByRole('button',{name:'Kontrollera'}).click(); await expect(page.getByText('Inte än.')).toBeVisible();
  await page.getByRole('button',{name:'Nästa'}).click(); await page.getByRole('button',{name:'Visa svaret'}).click(); await expect(page.getByText('Svaret visas.')).toBeVisible();
});
test('narrow mobile viewport has no horizontal overflow and direct routes load',async({page})=>{
  await page.setViewportSize({width:320,height:700}); await page.goto('/kortit/harjoitus?deck=avdelningar&direction=sv-fi');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true); await expect(page.locator('.flashcard')).toBeVisible();
  await page.goto('/kuvailu'); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
