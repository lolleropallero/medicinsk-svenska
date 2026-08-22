import { describe, expect, it } from 'vitest';
import { COSMETICS } from '../../src/lib/progress/catalog';
import { createProgressState, emptyDay } from '../../src/lib/progress/core';
import { canRerollQuest, compactCollection, compactSeasonTiers, leagueProgress, weeklyQuestProgress } from '../../src/lib/progress/ui-derivations';

const now=new Date(2026,7,22,12).getTime();

describe('progress UI derivations',()=>{
  it('shows reroll only for incomplete quests with a free reroll or token',()=>{
    const state=createProgressState(now,'ui'),day=emptyDay(state,'2026-08-22'),quest=day.quests[1]!;
    expect(canRerollQuest(quest,day,0)).toBe(true);
    day.freeRerollUsed=true;expect(canRerollQuest(quest,day,0)).toBe(false);
    expect(canRerollQuest(quest,day,1)).toBe(true);
    quest.claimed=true;expect(canRerollQuest(quest,day,1)).toBe(false);
  });

  it('calculates weekly quest values, rewards, and completed state from this week',()=>{
    const state=createProgressState(now,'weekly');
    for(let index=0;index<5;index++){
      const key=`2026-08-${17+index}`,day=emptyDay(state,key);
      day.uniqueItemIds=Array.from({length:20},(_,item)=>`flashcards:${index}-${item}`);
      day.modes=index===0?['flashcards','phrases','descriptions']:['flashcards'];state.daily[key]=day;
    }
    const weekly=weeklyQuestProgress(state,now);
    expect(weekly.map(item=>({value:item.value,target:item.target,complete:item.complete}))).toEqual([
      {value:5,target:5,complete:true},{value:100,target:100,complete:true},{value:3,target:3,complete:true},
    ]);
    expect(weekly[0]).toMatchObject({xp:25,credits:30,seasonPoints:30});
  });

  it.each([
    ['Pronssi',0,'promotion',150,150,'Hopea'],['Pronssi',149,'promotion',150,1,'Hopea'],['Pronssi',150,'promotion-secured',150,0,'Hopea'],
    ['Hopea',0,'retention',75,75,'Kulta'],['Hopea',74,'retention',75,1,'Kulta'],['Hopea',75,'promotion',250,175,'Kulta'],['Hopea',249,'promotion',250,1,'Kulta'],['Hopea',250,'promotion-secured',250,0,'Kulta'],
    ['Kulta',124,'retention',125,1,'Platina'],['Kulta',125,'promotion',400,275,'Platina'],['Kulta',399,'promotion',400,1,'Platina'],['Kulta',400,'promotion-secured',400,0,'Platina'],
    ['Platina',199,'retention',200,1,'Timantti'],['Platina',200,'promotion',600,400,'Timantti'],['Platina',599,'promotion',600,1,'Timantti'],['Platina',600,'promotion-secured',600,0,'Timantti'],
    ['Timantti',299,'retention',300,1,'Konsultti'],['Timantti',300,'promotion',850,550,'Konsultti'],['Timantti',849,'promotion',850,1,'Konsultti'],['Timantti',850,'promotion-secured',850,0,'Konsultti'],
    ['Konsultti',499,'retention',500,1,undefined],['Konsultti',500,'retention-secured',500,0,undefined],
  ] as const)('derives %s league phase at %i XP', (tier,xp,phase,target,remaining,nextTier)=>{
    expect(leagueProgress(tier,xp)).toEqual({phase,target,remaining,nextTier});
  });

  it('selects current, claimable, and upcoming season tiers until all 30 are requested',()=>{
    expect(compactSeasonTiers(450,[1,2,4])).toEqual([3,4,5,6,7]);
    expect(compactSeasonTiers(0,[])).toEqual([1,2,3,4]);
    expect(Array.from({length:30},(_,index)=>index+1)).toHaveLength(30);
  });

  it('includes an owned seasonal cosmetic in the default owned view',()=>{
    const owned=['theme-default','cardStyle-default','progressFrame-default','title-default','season-rare'];
    expect(compactCollection(COSMETICS,owned).map(item=>item.id)).toEqual(owned);
  });

  it('includes every owned seasonal cosmetic under its matching type',()=>{
    const seasonal=COSMETICS.filter(item=>item.seasonExclusive),owned=seasonal.map(item=>item.id);
    for(const item of seasonal)expect(compactCollection(COSMETICS,owned,false,item.type).map(value=>value.id)).toContain(item.id);
  });

  it('exposes all seasonal cosmetics through Visa alla and keeps unowned entries available for locked rendering',()=>{
    const seasonalIds=['season-rare','season-epic-1','season-epic-2','season-legendary'];
    const all=compactCollection(COSMETICS,[],true,'all');
    expect(all.filter(item=>item.seasonExclusive).map(item=>item.id)).toEqual(seasonalIds);
    expect(compactCollection(COSMETICS,[])).toEqual([]);
  });

  it('does not mutate ownership, economy values, or normal cosmetics',()=>{
    const state=createProgressState(now,'collection'),ownedBefore=structuredClone(state.inventory.ownedCosmeticIds),creditsBefore=state.inventory.credits;
    const normalBefore=COSMETICS.filter(item=>!item.seasonExclusive).map(item=>item.id);
    compactCollection(COSMETICS,state.inventory.ownedCosmeticIds,true,'all');
    expect(state.inventory.ownedCosmeticIds).toEqual(ownedBefore);expect(state.inventory.credits).toBe(creditsBefore);
    expect(COSMETICS.filter(item=>!item.seasonExclusive).map(item=>item.id)).toEqual(normalBefore);
  });
});
