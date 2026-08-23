import { COSMETICS } from './catalog';
import { DAY_RE, dateFromDayKey } from './calendar';
import { createProgressState, levelProgress, PROGRESS_KEY, reconcileProgress, reduceProgress } from './core';
import type { ProgressEvent, ProgressNotification, ProgressStateV1, SessionReward } from './types';
import { playMilestone } from '../sound/player';
export { PROGRESS_KEY } from './core';

const exactKeys = (value: object, keys: string[]) => Object.keys(value).every((key) => keys.includes(key));
const nonNegativeInt = (value: unknown) => Number.isInteger(value) && Number(value) >= 0;
const finiteNonNegative = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const cosmeticIds = new Set(COSMETICS.map((item) => item.id));

export function isProgressState(value: unknown): value is ProgressStateV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state=value as Partial<ProgressStateV1>;
  if (!(state.schemaVersion===1&&typeof state.installationId==='string'&&state.installationId.length>0&&finiteNonNegative(state.createdAt)&&finiteNonNegative(state.updatedAt))) return false;
  if (!state.settings||!exactKeys(state.settings,['dailyGoal','calmMode'])||![5,10,20,30].includes(state.settings.dailyGoal!)||typeof state.settings.calmMode!=='boolean') return false;
  if (!state.lifetime||!Object.values(state.lifetime).every(finiteNonNegative)) return false;
  if (!state.daily||typeof state.daily!=='object'||Array.isArray(state.daily)||!Object.entries(state.daily).every(([key,day])=>DAY_RE.test(key)&&dateFromDayKey(key)&&day&&typeof day==='object'&&Array.isArray(day.uniqueItemIds)&&new Set(day.uniqueItemIds).size===day.uniqueItemIds.length&&day.uniqueItemIds.every(id=>typeof id==='string')&&nonNegativeInt(day.completedItems)&&finiteNonNegative(day.activeStudyMs)&&finiteNonNegative(day.xp)&&Array.isArray(day.modes)&&Array.isArray(day.quests))) return false;
  if (!state.inventory||!nonNegativeInt(state.inventory.credits)||!nonNegativeInt(state.inventory.rerollTokens)||!nonNegativeInt(state.inventory.streakFreezes)||state.inventory.streakFreezes!>2||!Array.isArray(state.inventory.ownedCosmeticIds)||!state.inventory.ownedCosmeticIds.every(id=>cosmeticIds.has(id))||new Set(state.inventory.ownedCosmeticIds).size!==state.inventory.ownedCosmeticIds.length) return false;
  if (!state.inventory.equipped||!Object.values(state.inventory.equipped).every(id=>cosmeticIds.has(id))||!Array.isArray(state.inventory.capsules)||new Set(state.inventory.capsules.map(c=>c.id)).size!==state.inventory.capsules.length||!state.inventory.capsules.every(c=>typeof c.id==='string'&&['standard','golden','legendary'].includes(c.kind)&&finiteNonNegative(c.earnedAt)&&(!c.openedAt||(finiteNonNegative(c.openedAt)&&c.reward&&c.rarity)))) return false;
  if (!state.loot||![state.loot.sinceRare,state.loot.sinceEpic,state.loot.sinceLegendary].every(nonNegativeInt)||state.loot.sinceRare>3||state.loot.sinceEpic>11||state.loot.sinceLegendary>39||!Array.isArray(state.loot.openingHistory)) return false;
  if (!Array.isArray(state.processedEventIds)||state.processedEventIds.length>10_000||new Set(state.processedEventIds).size!==state.processedEventIds.length||!state.processedEventIds.every(id=>typeof id==='string')) return false;
  return Boolean(state.streak&&state.achievements&&state.records&&state.seasons&&state.league&&state.comeback&&Array.isArray(state.notifications)&&state.sessionRewards&&typeof state.sessionRewards==='object'&&!Array.isArray(state.sessionRewards));
}

export function normalizeVisibleData(input:ProgressStateV1):ProgressStateV1{
  const state=structuredClone(input) as ProgressStateV1 & {notifications:unknown[];sessionRewards:Record<string,unknown[]>};
  state.notifications=state.notifications.filter((item):item is ProgressNotification=>Boolean(item&&typeof item==='object'&&'kind' in item&&'id' in item));
  for(const [sessionId,rewards] of Object.entries(state.sessionRewards)){
    const migrated:SessionReward[]=[];
    for(const item of rewards as unknown[]){
      const legacy:unknown=item;
      if(legacy&&typeof legacy==='object'&&'kind' in legacy){migrated.push(legacy as SessionReward);continue;}
      if(typeof legacy==='string'){const xp=legacy.match(/^\+(\d+) XP$/);if(xp)migrated.push({kind:'xp',amount:Number(xp[1])});}
    }
    state.sessionRewards[sessionId]=migrated.filter((value,index,all)=>all.findIndex(item=>JSON.stringify(item)===JSON.stringify(value))===index);
  }
  if(state.league.previousResult&&!state.league.result)state.league.result={kind:'retained',tier:state.league.tier};
  return state;
}

export function loadProgress(storage: Pick<Storage,'getItem'|'setItem'|'removeItem'>=localStorage, now=Date.now()): ProgressStateV1 {
  const raw=storage.getItem(PROGRESS_KEY);if(!raw){const state=createProgressState(now);storage.setItem(PROGRESS_KEY,JSON.stringify(state));return state;}
  try { const parsed:unknown=JSON.parse(raw);if(isProgressState(parsed)){const normalized=normalizeVisibleData(parsed);const reconciled=reconcileProgress(normalized,now);if(JSON.stringify(reconciled)!==JSON.stringify(parsed))storage.setItem(PROGRESS_KEY,JSON.stringify(reconciled));return reconciled;}storage.setItem(`${PROGRESS_KEY}.corrupt.${now}`,raw); }
  catch { try{storage.setItem(`${PROGRESS_KEY}.corrupt.${now}`,raw);}catch{/* best effort */} }
  storage.removeItem(PROGRESS_KEY);return createProgressState(now);
}
export function saveProgress(state:ProgressStateV1,storage:Pick<Storage,'setItem'>=localStorage){storage.setItem(PROGRESS_KEY,JSON.stringify(state));}
export function dispatchProgress(event:ProgressEvent,storage:Storage=localStorage){const current=loadProgress(storage,event.occurredAt);const result=reduceProgress(current,event);if(result.applied){saveProgress(result.state,storage);const priorNotifications=new Set(current.notifications.map(item=>item.id));const added=result.state.notifications.filter(item=>!priorNotifications.has(item.id));playMilestone({levelUp:levelProgress(result.state.lifetime.xp).level>levelProgress(current.lifetime.xp).level,achievement:added.some(item=>item.kind==='achievement'),questComplete:added.some(item=>item.kind==='daily-quest'||item.kind==='weekly-quest')});}return result;}
export interface ExportEnvelope {format:'medicinsk-svenska-progress';exportFormatVersion:1;exportedAt:number;progress:ProgressStateV1}
export function exportEnvelope(state:ProgressStateV1,now=Date.now()):ExportEnvelope{return{format:'medicinsk-svenska-progress',exportFormatVersion:1,exportedAt:now,progress:state};}
export function parseImport(raw:string):{ok:true;state:ProgressStateV1}|{ok:false;error:string}{try{const value:unknown=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))return{ok:false,error:'Tiedosto ei ole kelvollinen.'};const envelope=value as Partial<ExportEnvelope>;
  if(envelope.format!=='medicinsk-svenska-progress'||envelope.exportFormatVersion!==1||!isProgressState(envelope.progress))return{ok:false,error:'Tiedoston versio tai sisältö ei kelpaa.'};return{ok:true,state:normalizeVisibleData(envelope.progress)};}catch{return{ok:false,error:'Tiedostoa ei voitu lukea.'};}}
export function resetProgress(storage:Storage=localStorage,now=Date.now()){const state=createProgressState(now);saveProgress(state,storage);return state;}
