import type { Achievement, Cosmetic, CosmeticType, Rarity, Reward } from './types';

const defs: Record<CosmeticType, [string, string][]> = {
  theme: [['Päivystys','Selkeä vaalea teema'],['Leikkaussali','Viileä sinivihreä teema'],['Arkisto','Lämmin paperisävy'],['Yövuoro','Tumma korkeakontrastinen teema'],['Laboratorio','Raikas sininen teema'],['Kuntoutus','Rauhallinen vihreä teema'],['Klinikka','Hillitty harmaa teema'],['Konsultaatio','Syvä laivastonsininen teema'],['Anatomia','Pehmeä punaruskea teema'],['Seuranta','Neutraali seurantateema']],
  cardStyle: [['Peruskortti','Selkeä peruskortti'],['Resepti','Hieno viivapohja'],['Lomake','Jäsennelty korttipinta'],['Muistio','Pehmeä paperipinta'],['Näyte','Ohut kaksoisreuna'],['Kansio','Vahva yläreuna'],['Tarkistus','Kulmikas korttipinta'],['Kertomus','Väljä typografia'],['Kuvantaminen','Tumma kehys'],['Lähete','Rauhallinen lomaketyyli']],
  progressFrame: [['Peruskehys','Selkeä peruskehys'],['Pulssi','Rytmikäs viivakehys'],['Ristikko','Hillitty ruudutus'],['Mittari','Kaksoisviivakehys'],['Seuranta','Katkoviivakehys'],['Kierto','Pyöristetty kehys'],['Kudos','Pehmeä varjostus'],['Spektri','Korostettu kehys'],['Synteesi','Kolminkertainen kehys'],['Käyrä','Tarkka mittauskehys']],
  title: [['Opiskelija','Oletusarvoinen arvonimi'],['Harjoittelija','Säännöllinen harjoittelija'],['Kertaaja','Kertauksen taitaja'],['Sanaston kerääjä','Sanaston kartuttaja'],['Fraasien tuntija','Fraasien harjoittelija'],['Kuvailija','Kuvailun harjoittelija'],['Päivystäjä','Aktiivinen opiskelija'],['Klinikan kulkija','Pitkäjänteinen opiskelija'],['Konsultoija','Kokenut harjoittelija'],['Kokonaisuuden rakentaja','Monipuolinen harjoittelija']],
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
  { id:'season-rare',type:'title',rarity:'rare',name:'Kauden tarkkailija',description:'Kausipolun arvonimi',seasonExclusive:true },
  { id:'season-epic-1',type:'progressFrame',rarity:'epic',name:'Kausikehys',description:'Kausipolun kehys',seasonExclusive:true },
  { id:'season-epic-2',type:'cardStyle',rarity:'epic',name:'Kausikortti',description:'Kausipolun kortti',seasonExclusive:true },
  { id:'season-legendary',type:'theme',rarity:'legendary',name:'Ylilääkärinkierto',description:'Kausipolun päätösteema',seasonExclusive:true },
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
export const RARITY_LABEL: Record<Rarity,string> = { common:'Tavallinen',rare:'Harvinainen',epic:'Eeppinen',legendary:'Legendaarinen' };
