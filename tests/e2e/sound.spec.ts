import AxeBuilder from '@axe-core/playwright';
import { expect,test,type Page } from '@playwright/test';
import { answerCurrentClinicalStep, openSpecificCard, seedClinicalSession } from './helpers';

const UI='medicinsk-svenska.ui.v1';
async function probe(page:Page){await page.addInitScript(()=>{(window as unknown as {soundEvents:{effect:string;audible:boolean}[]}).soundEvents=[];window.addEventListener('sound-effect-requested',(event)=>{(window as unknown as {soundEvents:{effect:string;audible:boolean}[]}).soundEvents.push((event as CustomEvent).detail);});});}
const events=(page:Page)=>page.evaluate(()=>(window as unknown as {soundEvents:{effect:string;audible:boolean}[]}).soundEvents);
const currentCardAnswer=(page:Page)=>page.evaluate(()=>{
  const state=JSON.parse(localStorage.getItem('medicinsk-svenska.flashcard-session.v1')!);
  const cards=JSON.parse(document.getElementById('cards-data')!.textContent!) as {id:string;fi:string;sv:string;article?:string}[];
  const card=cards.find(item=>item.id===state.currentCardId)!;
  return state.direction==='fi-sv'?`${card.article?`${card.article} `:''}${card.sv}`:card.fi;
});

test('exercise actions request only their semantic learning sounds',async({page})=>{
  await probe(page);
  await openSpecificCard(page,{id:'anatomi-004',deckId:'anatomi'},'fi-sv');
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await page.getByRole('button',{name:'Osasin'}).click();
  expect((await events(page)).map(item=>item.effect).slice(0,2)).toEqual(['reveal','correct']);

  await page.goto('/kortit/harjoitus?mode=deck&answer=choice&deck=anatomi&direction=sv-fi&amount=10&session=sound-choice');
  const choiceAnswer=await currentCardAnswer(page),labels=await page.locator('#choice-options .choice-label').allTextContents();
  await page.locator('#choice-options button').nth(labels.findIndex(label=>label===choiceAnswer)).click();
  expect((await events(page)).map(item=>item.effect)).toContain('correct');

  await page.goto('/kortit/harjoitus?mode=deck&answer=written&deck=anatomi&direction=fi-sv&amount=10&session=sound-written');
  await page.getByLabel('Vastauksesi').fill('väärä vastaus');
  await page.getByRole('button',{name:'Tarkista'}).click();
  expect((await events(page)).map(item=>item.effect)).toContain('incorrect');

  await page.goto('/fraasit/harjoitus?mode=all&amount=10&session=sound-phrase');
  await page.getByRole('button',{name:'Näytä vastaus'}).click();
  await page.getByRole('button',{name:'En osannut'}).click();
  expect((await events(page)).map(item=>item.effect).slice(-2)).toEqual(['reveal','incorrect']);

  await page.goto('/kuvailu/harjoitus?mode=all&amount=10&session=sound-description&round=initial');
  const answer=await page.locator('#descriptions-data').evaluate(node=>{const items=JSON.parse(node.textContent??'[]') as {id:string;answerSv:string}[];const session=JSON.parse(localStorage.getItem('medicinsk-svenska.description-session.v1')!);return items.find(item=>item.id===session.selectedExerciseIds[session.currentIndex])!.answerSv;});
  await page.getByLabel('Vastauksesi').fill(answer);
  await page.getByRole('button',{name:'Tarkista'}).click();
  expect((await events(page)).map(item=>item.effect)).toContain('correct');

  await seedClinicalSession(page,['tilanne-infektio-virtsatietulehdus'],{sessionId:'sound-clinical'});
  await answerCurrentClinicalStep(page,false);
  expect((await events(page)).map(item=>item.effect)).toContain('incorrect');
});

test('daily overlay sounds only on actual open and close interactions after unlock',async({page})=>{
  await probe(page);await page.goto('/');const dialog=page.getByRole('dialog',{name:'Dagens uppdrag'});
  if(await dialog.isVisible())await page.getByRole('button',{name:'Stäng dagens uppdrag'}).click();
  await page.getByRole('button',{name:/Dagens uppdrag/}).click();
  await page.getByRole('button',{name:'Stäng dagens uppdrag'}).click();
  const audible=(await events(page)).filter(item=>item.audible).map(item=>item.effect);
  expect(audible.slice(-2)).toEqual(['overlay-open','overlay-close']);
});

test('sound settings persist, mute playback, fit 320px, and remain accessible',async({page})=>{
  await probe(page);await page.setViewportSize({width:320,height:568});await page.goto('/edistyminen/');
  const enabled=page.getByLabel('Ääniefektit'),volume=page.getByLabel('Äänenvoimakkuus');
  await expect(enabled).toBeChecked();await expect(volume).toHaveValue('65');
  await volume.fill('37');await volume.dispatchEvent('change');await enabled.uncheck();await page.reload();
  await expect(enabled).not.toBeChecked();await expect(volume).toHaveValue('37');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),UI)).toMatchObject({soundEnabled:false,soundVolume:.37});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({page}).analyze()).violations.filter(item=>['serious','critical'].includes(item.impact??''))).toEqual([]);
});

test('opening a pending reward requests one reward reveal and reload does not replay it',async({page})=>{
  await probe(page);await page.goto('/palkinnot/');
  await page.evaluate(()=>{const key='medicinsk-svenska.progress.v1',state=JSON.parse(localStorage.getItem(key)!);state.inventory.capsules.push({id:'sound-reward',kind:'standard',earnedAt:Date.now()});localStorage.setItem(key,JSON.stringify(state));});
  await page.reload();await page.getByRole('button',{name:/Vanlig belöning Öppna/}).click();
  expect((await events(page)).filter(item=>item.effect==='reward-reveal')).toHaveLength(1);
  await page.reload();expect((await events(page)).filter(item=>item.effect==='reward-reveal')).toHaveLength(0);
});
