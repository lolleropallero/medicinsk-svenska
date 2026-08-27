import { COSMETICS } from './catalog';
import type { Achievement, CapsuleKind, ExerciseMode, LeagueResult, LeagueTier, ProgressNotification, Quest, Rarity, Reward, SessionReward } from './types';

export const rarityCopy:Record<Rarity,string>={common:'Vanlig',rare:'Sällsynt',epic:'Episk',legendary:'Legendarisk'};
export const boxCopy:Record<CapsuleKind,string>={standard:'Vanlig belöning',golden:'Gyllene belöning',legendary:'Legendarisk belöning'};
export const leagueCopy:Record<LeagueTier,string>={Pronssi:'Brons',Hopea:'Silver',Kulta:'Guld',Platina:'Platina',Timantti:'Diamant',Konsultti:'Mästare'};
export const modeRoutes:Record<ExerciseMode,string>={flashcards:'/kortit/',phrases:'/fraasit/',descriptions:'/kuvailu/',clinical:'/tilanteet/'};

export interface BilingualCopy { sv:string; fi:string }
export function questCopy(quest:Pick<Quest,'kind'|'mode'|'target'|'answerMode'>):BilingualCopy{
  if(quest.kind==='items')return{sv:'Gör 10 olika uppgifter',fi:'Suorita 10 eri tehtävää'};
  if(quest.kind==='mode'&&quest.mode==='flashcards'){
    if('answerMode' in quest&&quest.answerMode==='choice')return{sv:'Gör 10 flervalsuppgifter',fi:'Harjoittele 10 monivalintaa'};
    if('answerMode' in quest&&quest.answerMode==='written')return{sv:'Skriv 10 ordsvar',fi:'Kirjoita 10 sanavastausta'};
    return{sv:'Träna 10 ordkort',fi:'Harjoittele 10 sanakorttia'};
  }
  if(quest.kind==='mode'&&quest.mode==='phrases')return{sv:'Träna 5 fraser',fi:'Harjoittele 5 fraasia'};
  if(quest.kind==='mode')return{sv:'Lös 5 beskrivningsuppgifter',fi:'Ratkaise 5 kuvailutehtävää'};
  if(quest.kind==='active')return{sv:'Studera aktivt i 5 minuter',fi:'Opiskele aktiivisesti 5 minuuttia'};
  if(quest.kind==='variety')return{sv:'Använd två övningstyper',fi:'Käytä kahta harjoitustapaa'};
  if(quest.kind==='retries')return{sv:'Bemästra 3 repetitioner',fi:'Hallitse 3 kertausta'};
  return{sv:'Slutför 2 övningspass',fi:'Suorita 2 harjoituskierrosta'};
}
export const weeklyQuestCopy:BilingualCopy[]=[
  {sv:'Studera under 5 dagar',fi:'Opiskele viitenä päivänä'},
  {sv:'Gör 100 olika uppgifter',fi:'Suorita 100 eri tehtävää'},
  {sv:'Använd tre olika övningstyper',fi:'Käytä kolmea eri harjoitustyyppiä'},
];
export function plural(value:number,one:string,many:string){return `${value} ${value===1?one:many}`;}
export function rewardCopy(reward:Reward):string{
  if(reward.type==='credits')return `${reward.amount} krediter`;
  if(reward.type==='capsule')return boxCopy[reward.kind];
  if(reward.type==='cosmetic')return COSMETICS.find(item=>item.id===reward.cosmeticId)?.name??'Kosmetik';
  if(reward.type==='rerollToken')return plural(reward.amount,'uppdragsbyte','uppdragsbyten');
  return plural(reward.amount,'svitfrysning','svitfrysningar');
}
const achievementText:Record<string,[string,string]>={
  'first-item':['Första steget','Slutför din första uppgift.'],'items-10':['En bra början','Slutför 10 uppgifter.'],
  'items-100':['Hundra uppgifter','Slutför 100 uppgifter.'],'items-500':['En stadig vana','Slutför 500 uppgifter.'],
  'days-3':['Tre studiedagar','Studera under tre dagar.'],'days-10':['Tio studiedagar','Studera under tio dagar.'],
  'streak-3':['Tre dagars svit','Nå en svit på tre dagar.'],'streak-7':['En veckas svit','Nå en svit på sju dagar.'],
  'xp-100':['Hundra XP','Samla 100 erfarenhetspoäng.'],'xp-1000':['Tusen XP','Samla 1 000 erfarenhetspoäng.'],
  'modes-3':['Tre sätt att öva','Använd tre olika övningstyper samma dag.'],'active-60':['En fokuserad timme','Studera aktivt i en timme.'],
};
export function achievementCopy(achievement:Pick<Achievement,'id'>){const [name,description]=achievementText[achievement.id]??['Prestation','Fortsätt öva.'];return{name,description};}
export function leagueResultCopy(result:LeagueResult){return result.kind==='retained'?'Du stannade kvar':result.kind==='promoted'?`Du steg till ${leagueCopy[result.tier]}`:`Du föll till ${leagueCopy[result.tier]}`;}
export function notificationCopy(notification:ProgressNotification):string{
  if(notification.kind==='level')return `Ny nivå: ${notification.level}`;
  if(notification.kind==='daily-goal')return'Dagens mål klart';if(notification.kind==='daily-quest')return'Dagens uppdrag klart';
  if(notification.kind==='weekly-quest')return'Veckans uppdrag klart';if(notification.kind==='achievement')return'Prestation upplåst';
  if(notification.kind==='golden-box')return'Du fick en gyllene belöning';if(notification.kind==='season-step')return'Nytt steg i säsongen';
  if(notification.kind==='league')return leagueResultCopy(notification.result);return'Välkommen tillbaka';
}
export function sessionRewardCopy(reward:SessionReward):string{
  if(reward.kind==='xp')return`+${reward.amount} XP`;if(reward.kind==='credits')return`+${reward.amount} krediter`;
  if(reward.kind==='season-points')return`+${reward.amount} säsongspoäng`;if(reward.kind==='daily-quest')return'Dagens uppdrag klart';
  if(reward.kind==='daily-goal')return'Dagens mål klart';if(reward.kind==='golden-box')return'Gyllene belöning erhållen';return'Vanlig belöning erhållen';
}
export type NextAction={kind:'open-box';count:number;href:string}|{kind:'claim-season';count:number;href:string}|{kind:'daily-goal';remaining:number;href:string}|{kind:'daily-quest';quest:Quest;remaining:number;href:string}|{kind:'continue';mode:ExerciseMode;href:string};
export function nextActionCopy(action:NextAction):string{
  if(action.kind==='open-box')return action.count===1?'Öppna en belöning':`Öppna ${action.count} belöningar`;
  if(action.kind==='claim-season')return action.count===1?'Hämta säsongsbelöningen':`Hämta ${action.count} säsongsbelöningar`;
  if(action.kind==='daily-goal')return`${action.remaining} uppgifter kvar till dagens mål`;
  if(action.kind==='daily-quest'){
    if(action.quest.mode==='phrases')return`${action.remaining} fraser kvar i dagens uppdrag`;
    if(action.quest.kind==='variety')return`${action.remaining===1?'En':action.remaining} övningstyp kvar i veckans uppdrag`;
    return questCopy(action.quest).sv;
  }
  return action.mode==='flashcards'?'Fortsätt med ordkort':action.mode==='phrases'?'Fortsätt med fraser':action.mode==='descriptions'?'Fortsätt med beskrivningar':'Fortsätt med kliniska situationer';
}
