import { localDayKey, localWeekKey } from './calendar';
import { LEAGUE_PROMOTION_XP, LEAGUE_RETENTION_XP, LEAGUE_TIERS } from './core';
import type { Cosmetic, DailyProgress, LeagueTier, ProgressStateV1, Quest } from './types';

export const WEEKLY_QUEST_REWARDS = { xp:25, credits:30, seasonPoints:30 } as const;

export function canRerollQuest(quest:Quest,day:DailyProgress,rerollTokens:number){
  return !quest.claimed&&(!day.freeRerollUsed||rerollTokens>0);
}

export function weeklyQuestProgress(state:ProgressStateV1,now=Date.now()){
  const week=localWeekKey(now),today=localDayKey(now),days=Object.entries(state.daily).filter(([key])=>key>=week&&key<=today).map(([,day])=>day);
  const values=[days.filter(day=>day.uniqueItemIds.length>0).length,days.reduce((sum,day)=>sum+day.uniqueItemIds.length,0),new Set(days.flatMap(day=>day.modes)).size];
  return [5,100,3].map((target,index)=>({value:values[index]!,target,complete:values[index]!>=target,...WEEKLY_QUEST_REWARDS}));
}

export function leagueProgress(tier:LeagueTier,weeklyXp:number){
  const index=LEAGUE_TIERS.indexOf(tier),canPromote=index<LEAGUE_TIERS.length-1;
  const target=canPromote?LEAGUE_PROMOTION_XP[index]!:LEAGUE_RETENTION_XP[index]!;
  return {target,remaining:Math.max(0,target-weeklyXp),canPromote,nextTier:canPromote?LEAGUE_TIERS[index+1]:undefined};
}

export function compactSeasonTiers(points:number,claimedTiers:number[],upcomingCount=3){
  const unlocked=Math.min(30,Math.floor(points/100)),current=Math.min(30,Math.max(1,unlocked));
  const tiers=new Set<number>(Array.from({length:unlocked},(_,index)=>index+1).filter(tier=>!claimedTiers.includes(tier)));
  tiers.add(current);for(let tier=current+1;tier<=Math.min(30,current+upcomingCount);tier++)tiers.add(tier);
  return [...tiers].sort((a,b)=>a-b);
}

export function compactCollection(cosmetics:Cosmetic[],ownedIds:string[],showAll=false,filter='owned'){
  const available=cosmetics.filter(item=>!item.seasonExclusive);
  if(showAll||filter==='all')return available;
  if(filter==='owned')return available.filter(item=>ownedIds.includes(item.id));
  return available.filter(item=>item.type===filter);
}
