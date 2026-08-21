import { describe, expect, it } from 'vitest';
import { addLocalDays, dateFromDayKey, daysBetween, localDayKey, localMidnight, localWeekKey, msUntilLocalMidnight, seasonInfo } from '../../src/lib/progress/calendar';
import { EARNABLE_COSMETICS } from '../../src/lib/progress/catalog';
import { buyShopOffer, claimSeason, createProgressState, dailyShop, generateDailyQuests, levelFromXp, levelProgress, levelThreshold, nextAction, openCapsule, rarityForRoll, reconcileProgress, reduceProgress, rerollQuest, setDailyGoal } from '../../src/lib/progress/core';
import { exportEnvelope, isProgressState, parseImport } from '../../src/lib/progress/storage';
import type { ItemCompletedEvent, ProgressStateV1 } from '../../src/lib/progress/types';

const at=(key:string,hour=12)=>{const date=dateFromDayKey(key)!;date.setHours(hour);return date.getTime();};
const item=(day:string,id='a',mode:ItemCompletedEvent['mode']='flashcards',session='s'):ItemCompletedEvent=>({type:'item-completed',eventId:`${mode}:${session}:item:${id}`,sessionId:session,mode,itemId:id,sourceId:'source',occurredAt:at(day),firstAttemptCorrect:true,hadMisses:false,resolution:mode==='descriptions'?'correct':'mastered'});
const applyItems=(state:ProgressStateV1,day:string,count:number,mode:ItemCompletedEvent['mode']='flashcards')=>{let next=state;for(let index=0;index<count;index++)next=reduceProgress(next,item(day,String(index),mode,`${day}-${index}`)).state;return next;};

describe('local calendar',()=>{
  it('uses local YYYY-MM-DD keys',()=>expect(localDayKey(new Date(2026,7,21,23,30))).toBe('2026-08-21'));
  it('rejects malformed and impossible dates',()=>{expect(dateFromDayKey('2026-02-30')).toBeNull();expect(dateFromDayKey('bad')).toBeNull();});
  it('adds dates across month boundaries',()=>expect(addLocalDays('2026-08-31',1)).toBe('2026-09-01'));
  it('computes date distances',()=>expect(daysBetween('2026-08-20','2026-08-24')).toBe(4));
  it('uses Monday week keys',()=>expect(localWeekKey(new Date(2026,7,23))).toBe('2026-08-17'));
  it('finds local midnight',()=>expect(new Date(localMidnight(new Date(2026,7,21,14))).getHours()).toBe(0));
  it('counts down to midnight',()=>expect(msUntilLocalMidnight(new Date(2026,7,21,23,0).getTime())).toBe(3_600_000));
  it('derives 28-day seasons from fixed epoch',()=>{expect(seasonInfo(at('2026-08-17')).index).toBe(0);expect(seasonInfo(at('2026-09-14')).index).toBe(1);});
});

describe('XP, levels, and events',()=>{
  it.each([[1,0],[2,20],[3,60],[4,120],[5,200],[6,300],[10,900],[20,3800]])('has exact level %i threshold', (level,xp)=>expect(levelThreshold(level)).toBe(xp));
  it('derives level progress',()=>{expect(levelFromXp(340)).toBe(6);expect(levelProgress(340)).toMatchObject({level:6,currentThreshold:300,nextThreshold:420,within:40,remaining:80});});
  it('awards 2 XP to the first unique item today',()=>{const state=createProgressState(at('2026-08-21'),'install');expect(reduceProgress(state,item('2026-08-21')).state.lifetime.xp).toBe(2);});
  it('does not duplicate an event',()=>{const state=createProgressState(at('2026-08-21'),'install'),first=reduceProgress(state,item('2026-08-21'));const second=reduceProgress(first.state,item('2026-08-21'));expect(second.applied).toBe(false);expect(second.state.lifetime.completedItems).toBe(1);});
  it('counts repeated item completion but not same-day item XP',()=>{let state=createProgressState(at('2026-08-21'),'install');state=reduceProgress(state,item('2026-08-21','a','flashcards','one')).state;state=reduceProgress(state,item('2026-08-21','a','flashcards','two')).state;expect(state.lifetime.completedItems).toBe(2);expect(state.lifetime.xp).toBe(2);});
  it('awards item XP again on another date',()=>{let state=createProgressState(at('2026-08-21'),'install');state=reduceProgress(state,item('2026-08-21','a','flashcards','one')).state;state=reduceProgress(state,item('2026-08-22','a','flashcards','two')).state;expect(state.lifetime.xp).toBe(4);});
  it('clamps active-time events',()=>{const state=createProgressState(at('2026-08-21'),'install'),result=reduceProgress(state,{type:'active-study',eventId:'active:1',sessionId:'s',mode:'flashcards',durationMs:99_000,occurredAt:at('2026-08-21')}).state;expect(result.lifetime.activeStudyMs).toBe(30_000);});
  it('bounds processed event ids',()=>{const state=createProgressState(at('2026-08-21'),'install');state.processedEventIds=Array.from({length:10_000},(_,i)=>`old:${i}`);const result=reduceProgress(state,item('2026-08-21')).state;expect(result.processedEventIds).toHaveLength(10_000);expect(result.processedEventIds.at(-1)).toContain(':item:');});
});

describe('goals, quests, and streaks',()=>{
  it('generates stable three-slot daily quests',()=>{const a=generateDailyQuests('install','2026-08-21'),b=generateDailyQuests('install','2026-08-21');expect(a).toEqual(b);expect(a.map(q=>q.slot)).toEqual([1,2,3]);});
  it('claims the basic daily quest once',()=>{const state=applyItems(createProgressState(at('2026-08-21'),'install'),'2026-08-21',10);expect(state.daily['2026-08-21']!.quests[0]!.claimed).toBe(true);expect(state.lifetime.xp).toBeGreaterThanOrEqual(25);});
  it('uses one free reroll persistently',()=>{let state=createProgressState(at('2026-08-21'),'install');state=reconcileProgress(state,at('2026-08-21'));const next=rerollQuest(state,2,at('2026-08-21'))!;expect(next.daily['2026-08-21']!.freeRerollUsed).toBe(true);expect(rerollQuest(next,2,at('2026-08-21'))).toBeNull();});
  it.each([5,10,20,30] as const)('supports daily goal %i',goal=>{let state=createProgressState(at('2026-08-21'),'install');state=setDailyGoal(state,goal,at('2026-08-21'));state=applyItems(state,'2026-08-21',goal);expect(state.daily['2026-08-21']!.qualified).toBe(true);});
  it('lowering a goal completes it without duplicate reward',()=>{let state=applyItems(createProgressState(at('2026-08-21'),'install'),'2026-08-21',5);state=setDailyGoal(state,5,at('2026-08-21'));const credits=state.inventory.credits;state=setDailyGoal(state,5,at('2026-08-21'));expect(state.inventory.credits).toBe(credits);});
  it('starts and extends a qualified streak',()=>{let state=applyItems(createProgressState(at('2026-08-21'),'install'),'2026-08-21',10);state=reconcileProgress(state,at('2026-08-22'));state=applyItems(state,'2026-08-22',10);expect(state.streak.current).toBe(2);});
  it('consumes one freeze for one missed day',()=>{let state=applyItems(createProgressState(at('2026-08-21'),'install'),'2026-08-21',10);state.inventory.streakFreezes=1;state=reconcileProgress(state,at('2026-08-23'));expect(state.inventory.streakFreezes).toBe(0);expect(state.streak.current).toBe(1);expect(state.daily['2026-08-22']!.freezeUsed).toBe(true);});
  it('offers rescue after exactly one unprotected miss',()=>{let state=applyItems(createProgressState(at('2026-08-21'),'install'),'2026-08-21',10);state=reconcileProgress(state,at('2026-08-23'));expect(state.streak.rescue).toMatchObject({day:'2026-08-23',previousStreak:1});});
});

describe('capsules, shop, season and state IO',()=>{
  it.each([[.1,'common'],[.7,'rare'],[.95,'epic'],[.999,'legendary']] as const)('maps roll %s to %s',(roll,rarity)=>expect(rarityForRoll(roll)).toBe(rarity));
  it('guarantees rare from a golden capsule',()=>{const state=createProgressState(at('2026-08-21'),'install');state.inventory.capsules.push({id:'gold',kind:'golden',earnedAt:at('2026-08-21')});const values=[.1,.9,.1];const result=openCapsule(state,'gold',at('2026-08-21'),()=>values.shift()??0)!;expect(result.capsule.rarity).toBe('rare');});
  it('prefers an unowned cosmetic of the rolled rarity before a higher rarity',()=>{const state=createProgressState(at('2026-08-21'),'install');state.inventory.capsules.push({id:'rare',kind:'standard',earnedAt:at('2026-08-21')});const values=[.7,.1,.999];const result=openCapsule(state,'rare',at('2026-08-21'),()=>values.shift()??0)!,reward=result.capsule.reward;expect(reward?.type).toBe('cosmetic');if(reward?.type==='cosmetic')expect(EARNABLE_COSMETICS.find(item=>item.id===reward.cosmeticId)?.rarity).toBe('rare');});
  it('enforces legendary pity',()=>{const state=createProgressState(at('2026-08-21'),'install');state.loot.sinceLegendary=39;state.inventory.capsules.push({id:'pity',kind:'standard',earnedAt:at('2026-08-21')});expect(openCapsule(state,'pity',at('2026-08-21'),()=>.1)!.capsule.rarity).toBe('legendary');});
  it('cannot open one capsule twice',()=>{const state=createProgressState(at('2026-08-21'),'install');state.inventory.capsules.push({id:'one',kind:'standard',earnedAt:at('2026-08-21')});const opened=openCapsule(state,'one',at('2026-08-21'),()=>.8)!;expect(openCapsule(opened.state,'one',at('2026-08-21'),()=>.8)).toBeNull();});
  it('has exactly 36 earnable cosmetics with required rarity distribution',()=>{expect(EARNABLE_COSMETICS).toHaveLength(36);expect(Object.fromEntries(['common','rare','epic','legendary'].map(r=>[r,EARNABLE_COSMETICS.filter(c=>c.rarity===r).length]))).toEqual({common:16,rare:10,epic:7,legendary:3});});
  it('keeps four deterministic daily shop offers',()=>{const state=createProgressState(at('2026-08-21'),'install');expect(dailyShop(state,at('2026-08-21'))).toEqual(dailyShop(state,at('2026-08-21')));expect(dailyShop(state,at('2026-08-21'))).toHaveLength(4);});
  it('deducts a shop price once',()=>{const state=createProgressState(at('2026-08-21'),'install');state.inventory.credits=1000;const offer=dailyShop(state,at('2026-08-21'))[0]!;const bought=buyShopOffer(state,offer.id,at('2026-08-21'))!;expect(bought.inventory.credits).toBe(1000-offer.price);expect(buyShopOffer(bought,offer.id,at('2026-08-21'))).toBeNull();});
  it('claims an unlocked season tier once',()=>{const state=createProgressState(at('2026-08-21'),'install');state.seasons.points=100;const claimed=claimSeason(state,1,at('2026-08-21'))!;expect(claimed.inventory.credits).toBe(20);expect(claimSeason(claimed,1,at('2026-08-21'))).toBeNull();});
  it('round-trips a valid export',()=>{const state=createProgressState(at('2026-08-21'),'install');const parsed=parseImport(JSON.stringify(exportEnvelope(state,at('2026-08-21'))));expect(parsed.ok).toBe(true);if(parsed.ok)expect(parsed.state.installationId).toBe('install');});
  it('rejects negative economy and unknown schema',()=>{const state=createProgressState(at('2026-08-21'),'install');state.inventory.credits=-1;expect(isProgressState(state)).toBe(false);expect(parseImport(JSON.stringify({format:'medicinsk-svenska-progress',exportFormatVersion:2,progress:state})).ok).toBe(false);});
  it('prioritizes unopened capsules with semantic next-action data',()=>{const state=createProgressState(at('2026-08-21'),'install');state.inventory.capsules.push({id:'x',kind:'standard',earnedAt:at('2026-08-21')});expect(nextAction(state,at('2026-08-21'))).toEqual({kind:'open-box',count:1,href:'/palkinnot/#unopened-boxes'});});
});
