import { ACHIEVEMENTS, DEFAULT_COSMETICS, EARNABLE_COSMETICS } from './catalog';
import { addLocalDays, daysBetween, localDayKey, localWeekKey, seasonInfo } from './calendar';
import type { Capsule, CapsuleKind, DailyProgress, EventResult, ExerciseMode, ProgressEvent, ProgressStateV1, Quest, Rarity, Reward } from './types';

export const PROGRESS_KEY = 'medicinsk-svenska.progress.v1';
export const MAX_EVENTS = 10_000;
export const MAX_DAYS = 400;
const rarityRank: Record<Rarity,number> = { common:0,rare:1,epic:2,legendary:3 };

export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
export function seededUnit(value: string): number { return hashSeed(value) / 0x1_0000_0000; }
export function levelThreshold(level: number): number { return 10 * (Math.max(1, Math.floor(level)) - 1) * Math.max(1, Math.floor(level)); }
export function levelFromXp(xp: number): number { return Math.max(1, Math.floor((1 + Math.sqrt(1 + Math.max(0,xp) / 2.5)) / 2)); }
export function levelProgress(xp: number) {
  const level = levelFromXp(xp); const current = levelThreshold(level); const next = levelThreshold(level + 1);
  return { level, currentThreshold:current, nextThreshold:next, within:xp-current, remaining:next-xp, percent:(xp-current)/(next-current)*100 };
}

const sourceLabel = (mode: ExerciseMode) => mode === 'flashcards' ? 'sanakorttia' : mode === 'phrases' ? 'fraasia' : 'kuvailutehtävää';
export function generateDailyQuests(installationId: string, day: string, rerolls: number[] = [0,0,0]): Quest[] {
  const slot2Modes: [ExerciseMode,number][] = [['flashcards',10],['phrases',5],['descriptions',5]];
  const slot3: Pick<Quest,'kind'|'label'|'target'>[] = [
    {kind:'active',label:'Opiskele aktiivisesti 5 minuuttia',target:300_000},
    {kind:'variety',label:'Käytä kahta harjoitustapaa',target:2},
    {kind:'retries',label:'Hallitse 3 kertausta',target:3},
    {kind:'sessions',label:'Suorita 2 harjoituskierrosta',target:2},
  ];
  const mode = slot2Modes[hashSeed(`${installationId}:${day}:2:${rerolls[1]}`) % slot2Modes.length]!;
  const behaviour = slot3[hashSeed(`${installationId}:${day}:3:${rerolls[2]}`) % slot3.length]!;
  return [
    {id:`${day}:1:${rerolls[0]}`,slot:1,kind:'items',label:'Harjoittele 10 eri kohdetta',target:10,xp:5,credits:10,seasonPoints:10,rerollIndex:rerolls[0]!,claimed:false},
    {id:`${day}:2:${rerolls[1]}`,slot:2,kind:'mode',mode:mode[0],label:`Harjoittele ${mode[1]} ${sourceLabel(mode[0])}`,target:mode[1],xp:10,credits:15,seasonPoints:15,rerollIndex:rerolls[1]!,claimed:false},
    {id:`${day}:3:${rerolls[2]}`,slot:3,...behaviour,xp:15,credits:20,seasonPoints:20,rerollIndex:rerolls[2]!,claimed:false},
  ];
}
export function emptyDay(state: Pick<ProgressStateV1,'installationId'|'settings'>, day: string): DailyProgress {
  return { uniqueItemIds:[],completedItems:0,activeStudyMs:0,xp:0,modes:[],sessionsStarted:0,sessionsCompleted:0,retriesMastered:0,
    goalTarget:state.settings.dailyGoal,goalClaimed:false,qualified:false,freezeUsed:false,quests:generateDailyQuests(state.installationId,day),
    freeRerollUsed:false,allQuestsClaimed:false,sessionDropEligible:0,sessionDropAwarded:false };
}
export function createProgressState(now = Date.now(), installationId: string = globalThis.crypto?.randomUUID?.() ?? `local-${now}`): ProgressStateV1 {
  const season = seasonInfo(now);
  return { schemaVersion:1,installationId,createdAt:now,updatedAt:now,settings:{dailyGoal:10,calmMode:false},
    lifetime:{xp:0,activeStudyMs:0,completedItems:0,sessionsStarted:0,sessionsCompleted:0,studyDays:0,retriesMastered:0},daily:{},
    streak:{current:0,longest:0},achievements:structuredClone(ACHIEVEMENTS),records:{mostItemsDay:0,mostActiveMsDay:0,mostXpDay:0,longestStreak:0,bestSevenDayItems:0},
    inventory:{credits:0,rerollTokens:0,streakFreezes:0,ownedCosmeticIds:Object.values(DEFAULT_COSMETICS),equipped:{...DEFAULT_COSMETICS},capsules:[]},
    loot:{sinceRare:0,sinceEpic:0,sinceLegendary:0,openingHistory:[]},seasons:{id:season.id,index:season.index,points:0,claimedTiers:[],history:[]},
    league:{tier:'Pronssi',weekKey:localWeekKey(now),weeklyXp:0,settledWeeks:[]},comeback:{boostRemaining:0,boostMultiplier:1},highestRewardedLevel:1,
    processedEventIds:[],notifications:[],sessionRewards:{} };
}

function addCapsule(state: ProgressStateV1, kind: CapsuleKind, id: string, now: number) {
  if (!state.inventory.capsules.some((item) => item.id === id)) state.inventory.capsules.push({id,kind,earnedAt:now});
}
function applyReward(state: ProgressStateV1, reward: Reward, id: string, now: number) {
  if (reward.type === 'credits') state.inventory.credits += reward.amount;
  if (reward.type === 'rerollToken') state.inventory.rerollTokens += reward.amount;
  if (reward.type === 'streakFreeze') {
    const space = Math.max(0,2-state.inventory.streakFreezes); const accepted = Math.min(space,reward.amount);
    state.inventory.streakFreezes += accepted; state.inventory.credits += (reward.amount-accepted)*100;
  }
  if (reward.type === 'capsule') addCapsule(state,reward.kind,`${id}:capsule`,now);
  if (reward.type === 'cosmetic' && !state.inventory.ownedCosmeticIds.includes(reward.cosmeticId)) state.inventory.ownedCosmeticIds.push(reward.cosmeticId);
}
function grantXp(state: ProgressStateV1, day: DailyProgress, amount: number, now: number, id: string, earned: string[]) {
  if (amount <= 0) return; state.lifetime.xp += amount; day.xp += amount; state.league.weeklyXp += amount; earned.push(`+${amount} XP`);
  const level = levelFromXp(state.lifetime.xp);
  for (let reached=state.highestRewardedLevel+1; reached<=level; reached++) {
    state.inventory.credits += 10;
    if (reached%10===0) addCapsule(state,'golden',`${id}:level:${reached}`,now);
    else if (reached%5===0) addCapsule(state,'standard',`${id}:level:${reached}`,now);
    state.notifications.push({id:`level:${reached}`,message:`Taso ${reached} saavutettu`});
  }
  state.highestRewardedLevel=Math.max(state.highestRewardedLevel,level);
}
function questProgress(day: DailyProgress, quest: Quest): number {
  if (quest.kind==='items') return day.uniqueItemIds.length;
  if (quest.kind==='mode') return day.uniqueItemIds.filter((id)=>id.startsWith(`${quest.mode}:`)).length;
  if (quest.kind==='active') return day.activeStudyMs;
  if (quest.kind==='variety') return day.modes.length;
  if (quest.kind==='retries') return day.retriesMastered;
  return day.sessionsCompleted;
}
export function getQuestProgress(day: DailyProgress, quest: Quest) { return Math.min(quest.target,questProgress(day,quest)); }
function settleQuests(state: ProgressStateV1, day: DailyProgress, now: number, earned: string[]) {
  for (const quest of day.quests) if (!quest.claimed && questProgress(day,quest)>=quest.target) {
    quest.claimed=true; state.inventory.credits+=quest.credits; state.seasons.points+=quest.seasonPoints;
    grantXp(state,day,quest.xp,now,quest.id,earned); state.notifications.push({id:`quest:${quest.id}`,message:'Päivätehtävä valmis'});
  }
  if (!day.allQuestsClaimed && day.quests.every((quest)=>quest.claimed)) {
    day.allQuestsClaimed=true; state.seasons.points+=25; addCapsule(state,'golden',`daily-all:${localDayKey(now)}`,now); earned.push('Kultainen palkintokapseli');
  }
}
function streakMilestone(state: ProgressStateV1, streak: number, now: number) {
  const rewards: Record<number,Reward[]> = {3:[{type:'capsule',kind:'standard'}],7:[{type:'capsule',kind:'golden'},{type:'streakFreeze',amount:1}],
    14:[{type:'capsule',kind:'golden'}],30:[{type:'capsule',kind:'legendary'}],60:[{type:'capsule',kind:'golden'},{type:'streakFreeze',amount:1}],
    100:[{type:'capsule',kind:'legendary'}],365:[{type:'capsule',kind:'legendary'},{type:'cosmetic',cosmeticId:'season-legendary'}]};
  rewards[streak]?.forEach((reward,index)=>applyReward(state,reward,`streak:${streak}:${index}`,now));
}
function qualifyGoal(state: ProgressStateV1, day: DailyProgress, key: string, now: number, earned: string[]) {
  if (day.goalClaimed || day.uniqueItemIds.length < state.settings.dailyGoal) return;
  day.goalClaimed=true; day.qualified=true; day.goalTarget=state.settings.dailyGoal; state.inventory.credits+=10; state.seasons.points+=20;
  addCapsule(state,'standard',`daily-goal:${key}`,now); earned.push('+10 krediittiä','Palkintokapseli');
  state.streak.current=state.streak.current>0?state.streak.current+1:1; state.streak.longest=Math.max(state.streak.longest,state.streak.current);
  state.streak.lastQualifiedDay=key; state.records.longestStreak=state.streak.longest; streakMilestone(state,state.streak.current,now);
  state.notifications.push({id:`goal:${key}`,message:'Päivätavoite täynnä'});
}
function settleWeeklyQuests(state:ProgressStateV1,day:DailyProgress,key:string,now:number,earned:string[]){const week=localWeekKey(now),keys=Object.keys(state.daily).filter(date=>date>=week&&date<=key),studyDays=keys.filter(date=>state.daily[date]!.uniqueItemIds.length>0).length,items=keys.reduce((sum,date)=>sum+state.daily[date]!.uniqueItemIds.length,0),modes=new Set(keys.flatMap(date=>state.daily[date]!.modes)).size;
  const tasks:[string,boolean][]=[['days',studyDays>=5],['items',items>=100],['modes',modes>=3]];
  for(const [id,complete] of tasks){const eventId=`weekly:${week}:${id}`;if(complete&&!state.processedEventIds.includes(eventId)){state.processedEventIds.push(eventId);state.inventory.credits+=30;state.seasons.points+=30;grantXp(state,day,25,now,eventId,earned);state.notifications.push({id:eventId,message:'Viikkotehtävä valmis'});}}
  if(tasks.every(([,complete])=>complete)){const id=`weekly:${week}:all`;if(!state.processedEventIds.includes(id)){state.processedEventIds.push(id);state.seasons.points+=60;addCapsule(state,'golden',`${id}:capsule`,now);}}
}
function achievements(state: ProgressStateV1, now: number) {
  const today=state.daily[localDayKey(now)];
  const checks:Record<string,boolean>={
    'first-item':state.lifetime.completedItems>=1,'items-10':state.lifetime.completedItems>=10,'items-100':state.lifetime.completedItems>=100,'items-500':state.lifetime.completedItems>=500,
    'days-3':state.lifetime.studyDays>=3,'days-10':state.lifetime.studyDays>=10,'streak-3':state.streak.longest>=3,'streak-7':state.streak.longest>=7,
    'xp-100':state.lifetime.xp>=100,'xp-1000':state.lifetime.xp>=1000,'modes-3':(today?.modes.length??0)>=3,'active-60':state.lifetime.activeStudyMs>=3_600_000,
  };
  for (const achievement of state.achievements) if (!achievement.unlockedAt && checks[achievement.id]) {
    achievement.unlockedAt=now; applyReward(state,achievement.reward,`achievement:${achievement.id}`,now);
    state.notifications.push({id:`achievement:${achievement.id}`,message:`Saavutus avattu: ${achievement.name}`});
  }
}
function updateRecords(state: ProgressStateV1, key: string) {
  const day=state.daily[key]!; state.records.mostItemsDay=Math.max(state.records.mostItemsDay,day.uniqueItemIds.length);
  state.records.mostActiveMsDay=Math.max(state.records.mostActiveMsDay,day.activeStudyMs); state.records.mostXpDay=Math.max(state.records.mostXpDay,day.xp);
  let total=0; for(let offset=0;offset<7;offset++){const date=addLocalDays(key,-offset);if(date)total+=state.daily[date]?.uniqueItemIds.length??0;}
  state.records.bestSevenDayItems=Math.max(state.records.bestSevenDayItems,total);
}
function prune(state: ProgressStateV1) {
  state.processedEventIds=state.processedEventIds.slice(-MAX_EVENTS); state.inventory.capsules=state.inventory.capsules.slice(-200);
  state.loot.openingHistory=state.loot.openingHistory.slice(-100); state.league.settledWeeks=state.league.settledWeeks.slice(-104);
  state.seasons.history=state.seasons.history.slice(-12); const days=Object.keys(state.daily).sort((left,right)=>left.localeCompare(right));
  const rewardSessions=Object.keys(state.sessionRewards);for(const id of rewardSessions.slice(0,Math.max(0,rewardSessions.length-100)))delete state.sessionRewards[id];
  for (const key of days.slice(0,Math.max(0,days.length-MAX_DAYS))) delete state.daily[key];
}
export function reduceProgress(input: ProgressStateV1, event: ProgressEvent): EventResult {
  if (input.processedEventIds.includes(event.eventId)) return {state:input,applied:false,earned:[]};
  const state=structuredClone(input); const earned:string[]=[]; const key=localDayKey(event.occurredAt); const day=state.daily[key]??emptyDay(state,key);
  state.daily[key]=day; state.processedEventIds.push(event.eventId); state.updatedAt=Math.max(state.updatedAt,event.occurredAt); state.lastUsedMode=event.mode;
  if(event.type==='session-started'){day.sessionsStarted++;state.lifetime.sessionsStarted++;}
  if(event.type==='active-study'){const duration=Math.max(0,Math.min(30_000,event.durationMs));day.activeStudyMs+=duration;state.lifetime.activeStudyMs+=duration;}
  if(event.type==='session-completed'){
    day.sessionsCompleted++;state.lifetime.sessionsCompleted++;
    if(event.selectedCount>=10&&!day.sessionDropAwarded){day.sessionDropEligible++;const drops=seededUnit(`${state.installationId}:${key}:${day.sessionDropEligible}`)<.2||day.sessionDropEligible===3;
      if(drops){day.sessionDropAwarded=true;addCapsule(state,'standard',`session-drop:${key}`,event.occurredAt);earned.push('Palkintokapseli');}}
  }
  if(event.type==='item-completed'){
    state.lifetime.completedItems++;day.completedItems++;if(event.hadMisses){state.lifetime.retriesMastered++;day.retriesMastered++;}
    const uniqueId=`${event.mode}:${event.itemId}`;const isUnique=!day.uniqueItemIds.includes(uniqueId);
    if(isUnique){
      const firstStudy=day.uniqueItemIds.length===0;day.uniqueItemIds.push(uniqueId);if(!day.modes.includes(event.mode))day.modes.push(event.mode);
      if(firstStudy)state.lifetime.studyDays++;grantXp(state,day,2,event.occurredAt,event.eventId,earned);
      const baseSeason=day.uniqueItemIds.length<=25?1:0;const multiplied=state.comeback.boostRemaining>0?Math.round(baseSeason*state.comeback.boostMultiplier):baseSeason;
      state.seasons.points+=multiplied;if(state.comeback.boostRemaining>0)state.comeback.boostRemaining--;
      if(state.comeback.lastStudyDay){const gap=daysBetween(state.comeback.lastStudyDay,key);if(gap&&gap>=2&&state.comeback.handledGapEnd!==key){
        state.comeback.handledGapEnd=key;if(gap<=6){state.comeback.boostMultiplier=1.5;state.comeback.boostRemaining=10;}
        else if(gap<=29){addCapsule(state,'golden',`comeback:${key}`,event.occurredAt);state.comeback.boostMultiplier=2;state.comeback.boostRemaining=20;}
        else state.comeback.chain={startDay:key,uniqueItems:[],modes:[]};}}
      state.comeback.lastStudyDay=key;
      if(state.comeback.chain){if(!state.comeback.chain.uniqueItems.includes(uniqueId))state.comeback.chain.uniqueItems.push(uniqueId);if(!state.comeback.chain.modes.includes(event.mode))state.comeback.chain.modes.push(event.mode);
        if(state.comeback.chain.uniqueItems.length>=20&&state.comeback.chain.modes.length>=2){addCapsule(state,'legendary',`comeback-chain:${state.comeback.chain.startDay}`,event.occurredAt);delete state.comeback.chain;}}
    }
  }
  qualifyGoal(state,day,key,event.occurredAt,earned);settleQuests(state,day,event.occurredAt,earned);settleWeeklyQuests(state,day,key,event.occurredAt,earned);
  if(state.streak.rescue?.day===key){state.streak.rescue.progress=day.uniqueItemIds.length;if(day.uniqueItemIds.length>=20){state.streak.current=state.streak.rescue.previousStreak+1;state.streak.longest=Math.max(state.streak.longest,state.streak.current);state.streak.lastRescueDay=key;delete state.streak.rescue;}}
  achievements(state,event.occurredAt);updateRecords(state,key);
  if(earned.length){state.sessionRewards[event.sessionId]=[...new Set([...(state.sessionRewards[event.sessionId]??[]),...earned])];}
  prune(state);
  return {state,applied:true,earned};
}

export function setDailyGoal(input:ProgressStateV1, goal:5|10|20|30, now=Date.now()):ProgressStateV1 {
  const state=structuredClone(input);state.settings.dailyGoal=goal;const key=localDayKey(now);const day=state.daily[key]??emptyDay(state,key);state.daily[key]=day;
  qualifyGoal(state,day,key,now,[]);state.updatedAt=now;return state;
}

const leagueTiers=['Pronssi','Hopea','Kulta','Platina','Timantti','Konsultti'] as const;
const promoteAt=[150,250,400,600,850,Infinity],demoteBelow=[-1,75,125,200,300,500];
export function reconcileProgress(input:ProgressStateV1,now=Date.now()):ProgressStateV1{const state=structuredClone(input),today=localDayKey(now);let changed=false;
  const last=state.streak.lastReconciledDay??localDayKey(state.createdAt);let cursor=last,unprotected:string[]=[];let previousStreak=state.streak.current;
  while(cursor<today){const record=state.daily[cursor];if(!record?.qualified&&state.streak.current>0){if(state.inventory.streakFreezes>0){state.inventory.streakFreezes--;const target=record??emptyDay(state,cursor);target.freezeUsed=true;state.daily[cursor]=target;}else{previousStreak=state.streak.current;state.streak.current=0;unprotected.push(cursor);}}cursor=addLocalDays(cursor,1)??today;changed=true;}
  if(unprotected.length===1&&unprotected[0]===addLocalDays(today,-1)){const cooldown=state.streak.lastRescueDay?daysBetween(state.streak.lastRescueDay,today):null;if(cooldown===null||cooldown>=30)state.streak.rescue={day:today,previousStreak,progress:0};}
  else if(state.streak.rescue?.day!==today)delete state.streak.rescue;
  if(today>last&&state.streak.lastReconciledDay!==today){state.streak.lastReconciledDay=today;changed=true;}
  const currentWeek=localWeekKey(now);if(currentWeek>state.league.weekKey&&!state.league.settledWeeks.includes(state.league.weekKey)){const old=state.league.tier,index=leagueTiers.indexOf(old),xp=state.league.weeklyXp;let next=index,result='Säilyit sarjassa';if(xp>=promoteAt[index]!&&index<leagueTiers.length-1){next=index+1;result=`Nousit sarjaan ${leagueTiers[next]}`;addCapsule(state,next===1?'standard':'golden',`league:${state.league.weekKey}`,now);}else if(xp<demoteBelow[index]!&&index>0){next=index-1;result=`Putosit sarjaan ${leagueTiers[next]}`;}else if(old==='Konsultti')addCapsule(state,'golden',`league:${state.league.weekKey}:retain`,now);else state.inventory.credits+=10*(index+1);state.league.tier=leagueTiers[next]!;state.league.previousResult=result;state.league.settledWeeks.push(state.league.weekKey);state.league.weekKey=currentWeek;state.league.weeklyXp=0;changed=true;}
  const currentSeason=seasonInfo(now);if(currentSeason.index>state.seasons.index){for(let tier=1;tier<=Math.min(30,Math.floor(state.seasons.points/100));tier++)if(!state.seasons.claimedTiers.includes(tier)){SEASON_REWARDS[tier]!.forEach((reward,index)=>applyReward(state,reward,`season:${state.seasons.id}:${tier}:${index}`,now));state.seasons.claimedTiers.push(tier);}state.seasons.history.push({id:state.seasons.id,points:state.seasons.points,claimedTiers:[...state.seasons.claimedTiers]});state.seasons.history=state.seasons.history.slice(-12);state.seasons={id:currentSeason.id,index:currentSeason.index,points:0,claimedTiers:[],history:state.seasons.history};changed=true;}
  if(changed){state.updatedAt=Math.max(state.updatedAt,now);prune(state);}return state;}
export function rerollQuest(input:ProgressStateV1,slot:number,now=Date.now()):ProgressStateV1|null {
  const state=structuredClone(input),key=localDayKey(now),day=state.daily[key]??emptyDay(state,key),current=day.quests.find(q=>q.slot===slot);
  if(!current||current.claimed)return null;if(day.freeRerollUsed){if(state.inventory.rerollTokens<1)return null;state.inventory.rerollTokens--;}else day.freeRerollUsed=true;
  const indices=day.quests.map(q=>q.rerollIndex);indices[slot-1]=(indices[slot-1]??0)+1;let generated=generateDailyQuests(state.installationId,key,indices);
  let attempts=0;while(generated.some((q,i)=>i===slot-1&&day.quests.some(old=>old.slot!==slot&&old.label===q.label))&&attempts++<10){indices[slot-1]=(indices[slot-1]??0)+1;generated=generateDailyQuests(state.installationId,key,indices);}
  day.quests[slot-1]=generated[slot-1]!;state.daily[key]=day;settleQuests(state,day,now,[]);return state;
}

export function rarityForRoll(roll:number):Rarity{return roll<.65?'common':roll<.9?'rare':roll<.98?'epic':'legendary';}
export function openCapsule(input:ProgressStateV1,id:string,now=Date.now(),roll=Math.random):{state:ProgressStateV1;capsule:Capsule}|null {
  const state=structuredClone(input),capsule=state.inventory.capsules.find(item=>item.id===id);if(!capsule||capsule.openedAt)return null;
  let rarity=rarityForRoll(roll());let minimum: Rarity=capsule.kind==='legendary'?'legendary':capsule.kind==='golden'?'rare':'common';
  if(state.loot.sinceLegendary>=39)minimum='legendary';else if(state.loot.sinceEpic>=11&&rarityRank[minimum]<2)minimum='epic';else if(state.loot.sinceRare>=3&&rarityRank[minimum]<1)minimum='rare';
  if(rarityRank[rarity]<rarityRank[minimum])rarity=minimum;
  const category=roll();let reward:Reward;
  if(category<.75){const unowned=EARNABLE_COSMETICS.filter(item=>!state.inventory.ownedCosmeticIds.includes(item.id));
    const exact=unowned.filter(item=>item.rarity===rarity),higher=unowned.filter(item=>rarityRank[item.rarity]>rarityRank[rarity]).sort((a,b)=>rarityRank[a.rarity]-rarityRank[b.rarity]);
    const available=exact.length?exact:higher;reward=available.length?{type:'cosmetic',cosmeticId:available[Math.floor(roll()*available.length)]!.id}:{type:'credits',amount:[10,30,80,250][rarityRank[rarity]]!};}
  else if(category<.9)reward={type:'credits',amount:[10,30,80,250][rarityRank[rarity]]!};
  else reward=roll()<.5?{type:'rerollToken',amount:1}:{type:'streakFreeze',amount:1};
  applyReward(state,reward,`open:${id}`,now);capsule.openedAt=now;capsule.rarity=rarity;capsule.reward=reward;
  state.loot.sinceRare=rarityRank[rarity]>=1?0:state.loot.sinceRare+1;state.loot.sinceEpic=rarityRank[rarity]>=2?0:state.loot.sinceEpic+1;state.loot.sinceLegendary=rarity==='legendary'?0:state.loot.sinceLegendary+1;
  state.loot.openingHistory.push(id);state.loot.openingHistory=state.loot.openingHistory.slice(-100);return {state,capsule};
}

export interface ShopOffer {id:string;type:'cosmetic'|'utility'|'capsule';itemId:string;label:string;price:number;originalPrice:number;discounted:boolean;purchased:boolean}
export function dailyShop(state:ProgressStateV1,now=Date.now()):ShopOffer[]{const key=localDayKey(now),seed=`${state.installationId}:${key}`,discount=hashSeed(`${seed}:discount`)%4;
  const available=EARNABLE_COSMETICS.filter(c=>!state.inventory.ownedCosmeticIds.includes(c.id));const price:Record<Rarity,number>={common:40,rare:100,epic:250,legendary:600};
  const cosmetics=[0,1].map(slot=>{const planPrefix=`shop-plan:${key}:${slot}:`,purchasePrefix=`shop:${key}:${slot}:`;const prior=(state.processedEventIds.find(id=>id.startsWith(planPrefix))?.slice(planPrefix.length)??state.processedEventIds.find(id=>id.startsWith(purchasePrefix))?.slice(purchasePrefix.length));return EARNABLE_COSMETICS.find(item=>item.id===prior)??available[hashSeed(`${seed}:${slot}`)%Math.max(1,available.length)];}).filter(Boolean);
  const raw=[...cosmetics.map(c=>({type:'cosmetic' as const,itemId:c!.id,label:c!.name,originalPrice:price[c!.rarity]})),
    state.inventory.streakFreezes<2?{type:'utility' as const,itemId:'streakFreeze',label:'Putkisuoja',originalPrice:150}:{type:'utility' as const,itemId:'rerollToken',label:'Uudelleenarvontatunnus',originalPrice:75},
    hashSeed(`${seed}:capsule`)%2?{type:'capsule' as const,itemId:'standard',label:'Tavallinen palkintokapseli',originalPrice:60}:{type:'capsule' as const,itemId:'golden',label:'Kultainen palkintokapseli',originalPrice:180}];
  return raw.map((offer,index)=>{const id=`shop:${key}:${index}:${offer.itemId}`;return{...offer,id,price:index===discount?Math.ceil(offer.originalPrice*.8):offer.originalPrice,discounted:index===discount,purchased:state.processedEventIds.includes(id)}});}
export function buyShopOffer(input:ProgressStateV1,offerId:string,now=Date.now()):ProgressStateV1|null{const state=structuredClone(input),offer=dailyShop(state,now).find(item=>item.id===offerId);if(!offer||offer.purchased||state.inventory.credits<offer.price)return null;
  const key=localDayKey(now);dailyShop(state,now).forEach((item,index)=>{const plan=`shop-plan:${key}:${index}:${item.itemId}`;if(!state.processedEventIds.includes(plan))state.processedEventIds.push(plan);});
  state.inventory.credits-=offer.price;state.processedEventIds.push(offer.id);if(offer.type==='cosmetic')applyReward(state,{type:'cosmetic',cosmeticId:offer.itemId},offer.id,now);else if(offer.type==='utility')applyReward(state,{type:offer.itemId as 'rerollToken'|'streakFreeze',amount:1},offer.id,now);else addCapsule(state,offer.itemId as CapsuleKind,`${offer.id}:capsule`,now);return state;}

export const SEASON_REWARDS:Record<number,Reward[]>={1:[{type:'credits',amount:20}],2:[{type:'capsule',kind:'standard'}],3:[{type:'credits',amount:25}],4:[{type:'rerollToken',amount:1}],5:[{type:'cosmetic',cosmeticId:'season-rare'}],6:[{type:'credits',amount:30}],7:[{type:'capsule',kind:'standard'}],8:[{type:'streakFreeze',amount:1}],9:[{type:'credits',amount:40}],10:[{type:'capsule',kind:'golden'}],11:[{type:'credits',amount:40}],12:[{type:'capsule',kind:'standard'}],13:[{type:'rerollToken',amount:1}],14:[{type:'credits',amount:50}],15:[{type:'cosmetic',cosmeticId:'season-epic-1'}],16:[{type:'credits',amount:50}],17:[{type:'capsule',kind:'standard'}],18:[{type:'streakFreeze',amount:1}],19:[{type:'credits',amount:60}],20:[{type:'capsule',kind:'golden'}],21:[{type:'credits',amount:60}],22:[{type:'capsule',kind:'standard'}],23:[{type:'rerollToken',amount:1}],24:[{type:'credits',amount:75}],25:[{type:'cosmetic',cosmeticId:'season-epic-2'}],26:[{type:'credits',amount:75}],27:[{type:'capsule',kind:'golden'}],28:[{type:'streakFreeze',amount:1}],29:[{type:'credits',amount:100}],30:[{type:'cosmetic',cosmeticId:'season-legendary'},{type:'capsule',kind:'legendary'}]};
export function claimSeason(input:ProgressStateV1,tier:number,now=Date.now()):ProgressStateV1|null{if(!Number.isInteger(tier)||tier<1||tier>30||input.seasons.points<tier*100||input.seasons.claimedTiers.includes(tier))return null;const state=structuredClone(input);SEASON_REWARDS[tier]!.forEach((reward,index)=>applyReward(state,reward,`season:${state.seasons.id}:${tier}:${index}`,now));state.seasons.claimedTiers.push(tier);return state;}

export function nextAction(state:ProgressStateV1,now=Date.now()):{label:string;href:string}{const day=state.daily[localDayKey(now)]??emptyDay(state,localDayKey(now));if(state.inventory.capsules.some(c=>!c.openedAt))return{label:'Avaa palkintokapseli',href:'/palkinnot/'};
  const tier=Math.floor(state.seasons.points/100);if(Array.from({length:tier},(_,i)=>i+1).some(t=>!state.seasons.claimedTiers.includes(t)))return{label:'Lunasta kausipalkinto',href:'/kausi/'};
  if(day.uniqueItemIds.length<state.settings.dailyGoal)return{label:`${state.settings.dailyGoal-day.uniqueItemIds.length} tehtävää päivän kapseliin`,href:'/kortit/'};
  const quest=day.quests.filter(q=>!q.claimed).sort((a,b)=>(a.target-questProgress(day,a))-(b.target-questProgress(day,b)))[0];if(quest)return{label:quest.label,href:'/edistyminen/'};
  const routes:Record<ExerciseMode,string>={flashcards:'/kortit/',phrases:'/fraasit/',descriptions:'/kuvailu/'};return{label:state.lastUsedMode?`Jatka ${state.lastUsedMode==='flashcards'?'sanakorteilla':state.lastUsedMode==='phrases'?'fraaseilla':'kuvailutehtävillä'}`:'Aloita sanakorteilla',href:routes[state.lastUsedMode??'flashcards']};}
