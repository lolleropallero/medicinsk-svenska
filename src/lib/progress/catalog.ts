import type { Achievement, Cosmetic, CosmeticType, Rarity, Reward } from './types';

const defs: Record<CosmeticType, [string, string][]> = {
  theme: [['Akuten','Ett tydligt ljust tema.'],['Operationssalen','Ett svalt blågrönt tema.'],['Arkivet','Varma toner av papper.'],['Nattjour','Ett mörkt tema med hög kontrast.'],['Laboratoriet','Ett friskt blått tema.'],['Rehabilitering','Ett lugnt grönt tema.'],['Kliniken','Ett återhållet grått tema.'],['Konsultation','Ett djupt marinblått tema.'],['Anatomi','Mjuka rödbruna toner.'],['Uppföljning','Ett neutralt tema för uppföljning.']],
  cardStyle: [['Grundkort','Ett tydligt kort utan dekoration.'],['Recept','Diskreta skrivlinjer.'],['Formulär','En strukturerad kortyta.'],['Anteckning','En mjuk pappersyta.'],['Prov','En tunn dubbel ram.'],['Journal','En markerad överkant.'],['Kontroll','En stram kantig yta.'],['Berättelse','Luftig typografi.'],['Bilddiagnostik','En mörk ram.'],['Remiss','En lugn formulärstil.']],
  progressFrame: [['Basram','En tydlig enkel ram.'],['Puls','En rytmisk linjeram.'],['Rutnät','Ett diskret rutmönster.'],['Mätare','En dubbel linjeram.'],['Uppföljning','En streckad ram.'],['Rotation','En mjukt rundad ram.'],['Vävnad','En mjuk skuggning.'],['Spektrum','En markerad ram.'],['Syntes','En tredubbel ram.'],['Kurva','En exakt mätram.']],
  title: [['Student','Standardtitel.'],['Praktikant','För regelbunden träning.'],['Repetitör','För säker repetition.'],['Ordsamlare','För ett växande ordförråd.'],['Fraskännare','För flitig frasträning.'],['Beskrivare','För säker beskrivning.'],['Jourhavande','För aktivt studium.'],['Kliniker','För uthållig träning.'],['Konsult','För en erfaren övare.'],['Helhetsbyggare','För mångsidig träning.']],
};
const rarities: Rarity[] = [
  ...Array(16).fill('common'), ...Array(10).fill('rare'), ...Array(7).fill('epic'), ...Array(3).fill('legendary'),
] as Rarity[];
const types: CosmeticType[] = ['theme','cardStyle','progressFrame','title'];
export const DEFAULT_COSMETICS: Record<CosmeticType,string> = { theme:'theme-default', cardStyle:'cardStyle-default', progressFrame:'progressFrame-default', title:'title-default' };
const baseCosmetics: Cosmetic[] = types.flatMap((type, typeIndex) => defs[type].map(([name, description], index) => ({
  id: index === 0 ? DEFAULT_COSMETICS[type] : `${type}-${index}`,
  type, name, description, rarity: index === 0 ? 'common' : rarities[typeIndex * 9 + index - 1]!,
})));
export const COSMETICS: Cosmetic[] = [...baseCosmetics,
  { id:'season-rare',type:'title',rarity:'rare',name:'Rotationsobservatör',description:'En titel från säsongens kliniska rotation.',seasonExclusive:true },
  { id:'season-epic-1',type:'progressFrame',rarity:'epic',name:'Rotationsram',description:'En exklusiv ram från den kliniska rotationen.',seasonExclusive:true },
  { id:'season-epic-2',type:'cardStyle',rarity:'epic',name:'Kliniskt kort',description:'En exklusiv kortstil från den kliniska rotationen.',seasonExclusive:true },
  { id:'season-legendary',type:'theme',rarity:'legendary',name:'Överläkarjour',description:'Säsongens exklusiva avslutningstema.',seasonExclusive:true },
];
export const EARNABLE_COSMETICS = COSMETICS.filter((item) => !Object.values(DEFAULT_COSMETICS).includes(item.id) && !item.seasonExclusive);
const reward = (type: Reward['type'], value: number | string): Reward => type === 'credits'
  ? { type, amount: value as number } : type === 'capsule' ? { type, kind: value as 'standard' }
  : type === 'cosmetic' ? { type, cosmeticId: value as string } : type === 'rerollToken'
    ? { type, amount: value as number } : { type:'streakFreeze', amount:value as number };
const achievementDefs: [string,string,string,Reward][] = [
  ['first-item','Ensimmäinen askel','Harjoittele yksi kohde',reward('credits',10)],
  ['items-10','Hyvä alku','Harjoittele 10 kohdetta',reward('credits',20)],
  ['items-100','Sata kohdetta','Harjoittele 100 kohdetta',reward('capsule','standard')],
  ['items-500','Vakiintunut tapa','Harjoittele 500 kohdetta',reward('capsule','standard')],
  ['days-3','Kolme päivää','Opiskele kolmena päivänä',reward('credits',30)],
  ['days-10','Kymmenen päivää','Opiskele kymmenenä päivänä',reward('capsule','standard')],
  ['streak-3','Kolmen päivän putki','Saavuta kolmen päivän putki',reward('credits',30)],
  ['streak-7','Viikon putki','Saavuta seitsemän päivän putki',reward('capsule','golden')],
  ['xp-100','Sata XP:tä','Kerää 100 XP:tä',reward('credits',40)],
  ['xp-1000','Tuhat XP:tä','Kerää 1000 XP:tä',reward('capsule','golden')],
  ['modes-3','Kolme tapaa','Käytä kaikkia harjoitustapoja samana päivänä',reward('credits',25)],
  ['active-60','Keskittynyt tunti','Opiskele aktiivisesti tunti',reward('capsule','standard')],
];
export const ACHIEVEMENTS: Achievement[] = achievementDefs.map(([id,name,description,reward]) => ({id,name,description,reward}));
export const RARITY_LABEL: Record<Rarity,string> = { common:'Vanlig',rare:'Sällsynt',epic:'Episk',legendary:'Legendarisk' };
