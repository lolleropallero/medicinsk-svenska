import AxeBuilder from '@axe-core/playwright';
import { expect,test,type Page } from '@playwright/test';

const UI='medicinsk-svenska.ui.v1';
type Snapshot={installed:boolean;unlocked:boolean;playing:boolean;crossfading:boolean;suspendedForVisibility:boolean;currentTrack?:string;bag?:string[];position?:number;failed?:string[];gains:number[];times:number[];paused:boolean[];sources:string[];calm:boolean;ducked:boolean};
const snapshot=(page:Page)=>page.evaluate(()=>window.__musicTest!.snapshot() as Snapshot);
async function dismissOverlay(page:Page){const close=page.getByRole('button',{name:'Stäng dagens uppdrag'});if(await close.isVisible())await close.click();}
async function unlock(page:Page){await page.locator('body').click({position:{x:5,y:5}});await expect.poll(async()=>(await snapshot(page)).playing,{timeout:10000}).toBe(true);}

test('music preferences default independently, persist, fit mobile, and remain accessible',async({page})=>{
  await page.setViewportSize({width:320,height:568});await page.goto('/edistyminen/');
  const music=page.getByLabel('Musiikki'),musicVolume=page.getByLabel('Musiikin voimakkuus'),sound=page.getByLabel('Ääniefektit');
  await expect(music).toBeChecked();await expect(musicVolume).toHaveValue('20');await expect(sound).toBeChecked();
  await musicVolume.fill('31');await music.uncheck();await sound.uncheck();await sound.check();await page.reload();
  await expect(music).not.toBeChecked();await expect(musicVolume).toHaveValue('31');await expect(sound).toBeChecked();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),UI)).toMatchObject({musicEnabled:false,musicVolume:.31,soundEnabled:true,soundVolume:.65});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  expect((await new AxeBuilder({page}).analyze()).violations.filter(item=>['serious','critical'].includes(item.impact??''))).toEqual([]);
});

test('front-page playback starts on a gesture and the same player continues through internal navigation',async({page})=>{
  const musicRequests:string[]=[];page.on('request',request=>{if(request.resourceType()==='media')musicRequests.push(request.url());});
  await page.goto('/');expect(musicRequests).toHaveLength(0);await dismissOverlay(page);await unlock(page);
  await page.waitForTimeout(500);
  const before=await snapshot(page);expect(before.bag).toHaveLength(5);expect(new Set(before.bag).size).toBe(5);expect(before.currentTrack).not.toBeUndefined();expect(await page.locator('[data-music-channel]').count()).toBe(2);
  await page.evaluate(()=>{(window as typeof window & {__persistentMusicNode?:Element}).__persistentMusicNode=document.querySelector('[data-music-channel]')!;});
  await page.getByRole('link',{name:/Sanakortit/}).first().click();await expect(page).toHaveURL(/\/kortit\/$/);
  await page.waitForFunction(()=>Boolean(window.__musicTest));
  await page.waitForTimeout(500);
  await expect.poll(async()=>(await snapshot(page)).currentTrack).toBe(before.currentTrack);const after=await snapshot(page);expect(after.playing).toBe(true);expect(after.bag).toEqual(before.bag);expect(await page.locator('[data-music-channel]').count()).toBe(2);expect(await page.evaluate(()=>(window as typeof window & {__persistentMusicNode?:Element}).__persistentMusicNode===document.querySelector('[data-music-channel]'))).toBe(true);expect(Math.max(...after.times)).toBeGreaterThan(Math.max(...before.times));
  await page.locator('.deck-row').filter({hasText:'Anatomia'}).click();await expect(page.locator('#progress')).toHaveText('0 / 25');await expect(page.getByRole('button',{name:'Näytä vastaus'})).toBeFocused();expect(await page.evaluate(()=>(window as typeof window & {__persistentMusicNode?:Element}).__persistentMusicNode===document.querySelector('[data-music-channel]'))).toBe(true);expect((await snapshot(page)).playing).toBe(true);
  expect(new Set(musicRequests.map(url=>new URL(url).pathname).filter(path=>/music-\d{2}/.test(path))).size).toBeLessThan(5);
});

test('crossfade seam advances once, calm mode attenuates without restart, and semantic ducking is selective',async({page})=>{
  await page.goto('/');await dismissOverlay(page);await unlock(page);const first=await snapshot(page);
  await page.evaluate(()=>window.__musicTest!.forceNext());await expect.poll(async()=>(await snapshot(page)).currentTrack).not.toBe(first.currentTrack);const advanced=await snapshot(page);expect(advanced.position).toBe(1);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('sound-effect-requested',{detail:{effect:'correct',audible:true}})));expect((await snapshot(page)).ducked).toBe(false);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('sound-effect-requested',{detail:{effect:'level-up',audible:true}})));expect((await snapshot(page)).ducked).toBe(true);await expect.poll(async()=>(await snapshot(page)).ducked,{timeout:2000}).toBe(false);
  const beforeCalm=await snapshot(page);await page.evaluate(()=>document.documentElement.dataset.calm='true');await expect.poll(async()=>(await snapshot(page)).calm).toBe(true);const afterCalm=await snapshot(page);expect(afterCalm.currentTrack).toBe(beforeCalm.currentTrack);expect(afterCalm.bag).toEqual(beforeCalm.bag);
});

test('same-page playback adopts every new shuffle bag instead of looping an old subset',async({page})=>{
  await page.goto('/');await dismissOverlay(page);await unlock(page);
  for(let cycle=0;cycle<3;cycle++){
    for(let step=1;step<=5;step++){
      const before=await snapshot(page);await page.evaluate(()=>window.__musicTest!.forceNext());await expect.poll(async()=>(await snapshot(page)).currentTrack).not.toBe(before.currentTrack);await expect.poll(async()=>(await snapshot(page)).crossfading).toBe(false);const after=await snapshot(page);expect(after.position).toBe(step===5?0:step);
    }
  }
});

test('a naturally ending track advances on the same page without media errors',async({page})=>{
  const errors:Error[]=[];page.on('pageerror',error=>errors.push(error));await page.goto('/');await dismissOverlay(page);await unlock(page);const before=await snapshot(page);
  await page.evaluate(currentTrack=>{const audio=[...document.querySelectorAll<HTMLAudioElement>('[data-music-channel]')].find(channel=>channel.dataset.trackId===currentTrack)!;audio.currentTime=audio.duration-2;},before.currentTrack);
  await expect.poll(async()=>(await snapshot(page)).currentTrack,{timeout:10000}).not.toBe(before.currentTrack);await expect.poll(async()=>(await snapshot(page)).crossfading).toBe(false);expect((await snapshot(page)).playing).toBe(true);expect(errors).toEqual([]);
});

test('tab switches and phone locking suspend playback until the page is visible again',async({page})=>{
  await page.goto('/');await dismissOverlay(page);await unlock(page);const before=await snapshot(page);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(async()=>(await snapshot(page)).playing).toBe(false);const hidden=await snapshot(page);expect(hidden.suspendedForVisibility).toBe(true);expect(hidden.paused.every(Boolean)).toBe(true);await page.waitForTimeout(400);expect(Math.max(...(await snapshot(page)).times)).toBeCloseTo(Math.max(...hidden.times),1);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await expect.poll(async()=>(await snapshot(page)).playing,{timeout:10000}).toBe(true);const resumed=await snapshot(page);expect(resumed.suspendedForVisibility).toBe(false);expect(resumed.currentTrack).toBe(before.currentTrack);await page.waitForTimeout(400);expect(Math.max(...(await snapshot(page)).times)).toBeGreaterThan(Math.max(...resumed.times));
});

test('all five local assets return usable audio and a failed current track is skipped',async({page,request})=>{
  await page.goto('/');await dismissOverlay(page);await unlock(page);const before=await snapshot(page);expect(before.sources).toHaveLength(5);
  for(const source of before.sources){const response=await request.get(source);expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('audio/mpeg');}
  await page.evaluate(id=>window.__musicTest!.fail(id as never),before.currentTrack!);await expect.poll(async()=>(await snapshot(page)).currentTrack,{timeout:5000}).not.toBe(before.currentTrack);
  expect((await snapshot(page)).failed).toContain(before.currentTrack);
});

test('a gesture retries playback when session resume was blocked by autoplay policy',async({page})=>{
  await page.addInitScript(()=>{sessionStorage.setItem('medicinsk-svenska.music-unlocked.v1','true');let calls=0;HTMLMediaElement.prototype.play=function(){calls++;return calls===1?Promise.reject(new DOMException('blocked','NotAllowedError')):Promise.resolve();};});
  await page.goto('/');await expect.poll(async()=>(await snapshot(page)).playing).toBe(false);await page.locator('body').click({position:{x:5,y:5}});await expect.poll(async()=>(await snapshot(page)).playing).toBe(true);
});
