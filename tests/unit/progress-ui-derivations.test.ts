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

  it('derives league promotion and retention targets and remaining XP',()=>{
    expect(leagueProgress('Hopea',200)).toEqual({target:250,remaining:50,canPromote:true,nextTier:'Kulta'});
    expect(leagueProgress('Konsultti',475)).toEqual({target:500,remaining:25,canPromote:false,nextTier:undefined});
  });

  it('selects current, claimable, and upcoming season tiers until all 30 are requested',()=>{
    expect(compactSeasonTiers(450,[1,2,4])).toEqual([3,4,5,6,7]);
    expect(compactSeasonTiers(0,[])).toEqual([1,2,3,4]);
    expect(Array.from({length:30},(_,index)=>index+1)).toHaveLength(30);
  });

  it('defaults the collection to owned items and exposes the complete collection',()=>{
    const owned=['theme-default','cardStyle-default','progressFrame-default','title-default'];
    const compact=compactCollection(COSMETICS,owned),all=compactCollection(COSMETICS,owned,true,'all');
    expect(compact.map(item=>item.id)).toEqual(owned);
    expect(all.length).toBeGreaterThan(compact.length);
    expect(all.every(item=>!item.seasonExclusive)).toBe(true);
  });
});
