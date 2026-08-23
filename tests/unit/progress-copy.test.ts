import { describe,expect,it } from 'vitest';
import { achievementCopy, boxCopy, leagueCopy, leagueResultCopy, nextActionCopy, notificationCopy, questCopy, rarityCopy, rewardCopy, sessionRewardCopy, weeklyQuestCopy } from '../../src/lib/progress/copy';
import { COSMETICS } from '../../src/lib/progress/catalog';
import { createProgressState, generateDailyQuests, nextAction, reduceProgress } from '../../src/lib/progress/core';
import { normalizeVisibleData } from '../../src/lib/progress/storage';
import type { ProgressStateV1, Quest } from '../../src/lib/progress/types';

const day='2026-08-21',at=Date.parse('2026-08-21T12:00:00Z');
describe('Swedish progress copy',()=>{
  it('maps every rarity',()=>expect(rarityCopy).toEqual({common:'Vanlig',rare:'Sällsynt',epic:'Episk',legendary:'Legendarisk'}));
  it('maps every box kind to reward-facing copy',()=>expect(boxCopy).toEqual({standard:'Vanlig belöning',golden:'Gyllene belöning',legendary:'Legendarisk belöning'}));
  it('maps stored league values for display',()=>expect(leagueCopy).toEqual({Pronssi:'Brons',Hopea:'Silver',Kulta:'Guld',Platina:'Platina',Timantti:'Diamant',Konsultti:'Mästare'}));
  it('maps league results',()=>expect(leagueResultCopy({kind:'promoted',tier:'Kulta'})).toBe('Du steg till Guld'));
  it('maps rewards without custom currency symbols',()=>expect(rewardCopy({type:'credits',amount:10})).toBe('10 krediter'));
  it('uses singular and plural reward actions',()=>{expect(nextActionCopy({kind:'open-box',count:1,href:'/'})).toBe('Öppna en belöning');expect(nextActionCopy({kind:'open-box',count:2,href:'/'})).toBe('Öppna 2 belöningar');});
  it('contains exact bilingual weekly quests',()=>expect(weeklyQuestCopy).toEqual([{sv:'Studera under 5 dagar',fi:'Opiskele viitenä päivänä'},{sv:'Gör 100 olika uppgifter',fi:'Suorita 100 eri tehtävää'},{sv:'Använd alla tre övningstyperna',fi:'Käytä kaikkia kolmea harjoitustapaa'}]));
  it('derives every daily quest from semantics',()=>{const variants:Quest[]=[
    {id:'1',slot:1,kind:'items',target:10,xp:5,credits:10,seasonPoints:10,rerollIndex:0,claimed:false},
    ...(['flashcards','phrases','descriptions'] as const).map((mode,index)=>({id:`m${index}`,slot:2,kind:'mode' as const,mode,target:mode==='flashcards'?10:5,xp:1,credits:1,seasonPoints:1,rerollIndex:0,claimed:false})),
    ...(['active','variety','retries','sessions'] as const).map((kind,index)=>({id:`q${index}`,slot:3,kind,target:kind==='active'?300000:kind==='retries'?3:2,xp:1,credits:1,seasonPoints:1,rerollIndex:0,claimed:false})),
  ];expect(variants.map(questCopy)).toEqual([
    {sv:'Gör 10 olika uppgifter',fi:'Suorita 10 eri tehtävää'},{sv:'Träna 10 ordkort',fi:'Harjoittele 10 sanakorttia'},{sv:'Träna 5 fraser',fi:'Harjoittele 5 fraasia'},{sv:'Lös 5 beskrivningsuppgifter',fi:'Ratkaise 5 kuvailutehtävää'},{sv:'Studera aktivt i 5 minuter',fi:'Opiskele aktiivisesti 5 minuuttia'},{sv:'Använd två övningstyper',fi:'Käytä kahta harjoitustapaa'},{sv:'Bemästra 3 repetitioner',fi:'Hallitse 3 kertausta'},{sv:'Slutför 2 övningspass',fi:'Suorita 2 harjoituskierrosta'},
  ]);});
  it('derives achievements by stable ID',()=>expect(achievementCopy({id:'first-item'})).toEqual({name:'Första steget',description:'Slutför din första uppgift.'}));
  it('derives notification and session reward copy',()=>{expect(notificationCopy({id:'a',kind:'achievement'})).toBe('Prestation upplåst');expect(sessionRewardCopy({kind:'credits',amount:10})).toBe('+10 krediter');});
  it('generates quests without persisted display labels',()=>expect(generateDailyQuests('install',day).every(quest=>quest.label===undefined)).toBe(true));
  it('returns semantic next action rather than a sentence',()=>expect(nextAction(createProgressState(at,'install'),at)).toMatchObject({kind:'daily-goal',remaining:10,href:'/kortit/'}));
  it('aggregates structured session rewards instead of persisting display strings',()=>{let state=createProgressState(at,'install');for(let index=0;index<2;index++)state=reduceProgress(state,{type:'item-completed',eventId:`e${index}`,sessionId:'s',mode:'flashcards',itemId:`i${index}`,sourceId:'x',occurredAt:at+index,firstAttemptCorrect:true,hadMisses:false,resolution:'mastered'}).state;expect(state.sessionRewards.s).toEqual([{kind:'xp',amount:4}]);});
  it('has Swedish cosmetic names and descriptions for every ID',()=>{expect(COSMETICS).toHaveLength(44);for(const item of COSMETICS){expect(item.name).toMatch(/[A-Za-zÅÄÖåäö]/);expect(item.description).toMatch(/[A-Za-zÅÄÖåäö]/);}});
  it('does not return forbidden Finnish metagame terminology from visible generators',()=>{const visible=[...Object.values(rarityCopy),...Object.values(boxCopy),...Object.values(leagueCopy),...generateDailyQuests('install',day).map(quest=>questCopy(quest).sv),rewardCopy({type:'credits',amount:10}),nextActionCopy({kind:'daily-goal',remaining:3,href:'/'}),achievementCopy({id:'first-item'}).name,notificationCopy({id:'x',kind:'daily-goal'})].join('\n'),brokenGoal=['10 tehtävää','päivän kapseliin'].join(' ');for(const forbidden of [brokenGoal,'Palkintokapseli','Putkisuoja','Uudelleenarvontatunnus','Kausipolku','Kausipisteet','Tavallinen','Harvinainen','Eeppinen','Legendaarinen','Pronssi','Hopea','Kulta','Timantti','Konsultti'])expect(visible).not.toContain(forbidden);});
});

describe('visible-data compatibility normalization',()=>{
  it('preserves all economic and statistical values while dropping stale display strings',()=>{
    const before=createProgressState(at,'legacy');
    before.lifetime.xp=340;before.inventory.credits=120;before.inventory.capsules.push({id:'kept',kind:'golden',earnedAt:at});before.loot.sinceEpic=4;before.streak.current=5;before.seasons.points=800;before.league.weeklyXp=77;before.processedEventIds=['event-kept'];(before as unknown as {notifications:unknown[]}).notifications=[{id:'old','message':'legacy'}];(before as unknown as {sessionRewards:Record<string,unknown[]>}).sessionRewards={s:['+20 XP','legacy reward']};
    const after=normalizeVisibleData(before as unknown as ProgressStateV1);
    expect({xp:after.lifetime.xp,credits:after.inventory.credits,capsules:after.inventory.capsules,pity:after.loot.sinceEpic,streak:after.streak.current,season:after.seasons.points,league:after.league.weeklyXp,events:after.processedEventIds}).toEqual({xp:340,credits:120,capsules:[{id:'kept',kind:'golden',earnedAt:at}],pity:4,streak:5,season:800,league:77,events:['event-kept']});
    expect(after.notifications).toEqual([]);expect(after.sessionRewards.s).toEqual([{kind:'xp',amount:20}]);
  });
});
