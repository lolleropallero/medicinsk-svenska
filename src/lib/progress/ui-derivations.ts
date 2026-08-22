import { localDayKey, localWeekKey } from './calendar';
import { LEAGUE_PROMOTION_XP, LEAGUE_RETENTION_XP, LEAGUE_TIERS } from './core';
import type { Cosmetic, DailyProgress, LeagueTier, ProgressStateV1, Quest } from './types';

export const WEEKLY_QUEST_REWARDS = { xp:25, credits:30, seasonPoints:30 } as const;
export type LeagueProgressPhase = 'retention'|'promotion'|'promotion-secured'|'retention-secured';

export function canRerollQuest(quest:Quest,day:DailyProgress,rerollTokens:number){
  return !quest.claimed&&(!day.freeRerollUsed||rerollTokens>0);
}

export function weeklyQuestProgress(state:ProgressStateV1,now=Date.now()){
  const week=localWeekKey(now),today=localDayKey(now),days=Object.entries(state.daily).filter(([key])=>key>=week&&key<=today).map(([,day])=>day);
  const values=[days.filter(day=>day.uniqueItemIds.length>0).length,days.reduce((sum,day)=>sum+day.uniqueItemIds.length,0),new Set(days.flatMap(day=>day.modes)).size];
  return [5,100,3].map((target,index)=>({value:values[index]!,target,complete:values[index]!>=target,...WEEKLY_QUEST_REWARDS}));
}

export function leagueProgress(tier:LeagueTier,weeklyXp:number){
  const index=LEAGUE_TIERS.indexOf(tier),nextTier=LEAGUE_TIERS[index+1],retentionTarget=LEAGUE_RETENTION_XP[index]!,promotionTarget=LEAGUE_PROMOTION_XP[index]!;
  let phase:LeagueProgressPhase,target:number;
  if(!nextTier){target=retentionTarget;phase=weeklyXp>=target?'retention-secured':'retention';}
  else if(index===0){target=promotionTarget;phase=weeklyXp>=target?'promotion-secured':'promotion';}
  else if(weeklyXp<retentionTarget){target=retentionTarget;phase='retention';}
  else{target=promotionTarget;phase=weeklyXp>=target?'promotion-secured':'promotion';}
  return {phase,target,remaining:Math.max(0,target-weeklyXp),nextTier};
}

export function compactSeasonTiers(points:number,claimedTiers:number[],upcomingCount=3){
  const unlocked=Math.min(30,Math.floor(points/100)),current=Math.min(30,Math.max(1,unlocked));
  const tiers=new Set<number>(Array.from({length:unlocked},(_,index)=>index+1).filter(tier=>!claimedTiers.includes(tier)));
  tiers.add(current);for(let tier=current+1;tier<=Math.min(30,current+upcomingCount);tier++)tiers.add(tier);
  return [...tiers].sort((a,b)=>a-b);
}

export function compactCollection(cosmetics:Cosmetic[],ownedIds:string[],showAll=false,filter='owned'){
  if(showAll||filter==='all')return cosmetics;
  if(filter==='owned')return cosmetics.filter(item=>ownedIds.includes(item.id));
  return cosmetics.filter(item=>item.type===filter);
}
