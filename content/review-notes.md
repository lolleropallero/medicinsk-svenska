# Content review notes

The six V1 PDFs were extracted with pdfplumber. Ambiguous rows were checked against the rendered source layout. Learner-facing data contains only canonical terms.

## Corrections made

- `anatomi` item 95: `et finger, fingret, fingrar, -na` → `finger`. Source has ‘et finger’; corrected the obvious missing t.
- `sjukdomar` item 144: `vattkoppor vesirokk` → `vattkoppor`. PDF extraction split Finnish ‘vesirokko’ across cells; visually unambiguous.
- `sjukdomar` item 145: `vitflytning, -en 2 valkovuo` → `vitflytning`. PDF extraction split Finnish ‘valkovuoto’ across cells; visually unambiguous.
- `avdelningar` item 5: `förlossninsavdelning, -en` → `förlossningsavdelning`. Source has ‘förlossninsavdelning’; corrected the missing g.

## Canonical choices made

- `anatomi` item 5: selected `äggstock` from `en äggstock 2 / ett ovari/um, -et, -er`.
- `anatomi` item 28: selected `haka` from `en haka 1 / en käk(e) 2`.
- `anatomi` item 112: selected `ledband` from `ett ledband 5 / ett ligamen bindsena 1 t 5 / en`.
- `anatomi` item 115: selected `mellangärde` from `ett mellangärde 4 / ett / en / or diafragma, -er`.
- `anatomi` item 125: selected `säte` from `ett säte 4 /en bak 2`.
- `anatomi` item 137: selected `tonsiller` from `tonsiller, -na / halsmandl ar, -na`.
- `sjukdomar` item 1: selected `åderbrock` from `åderbrock, -et / åderbråck, - et`.
- `sjukdomar` item 5: selected `andnöd` from `andnöd, -en, andtäppa, -n`.
- `sjukdomar` item 7: selected `angina` from `angina, halsfluss`.
- `sjukdomar` item 12: selected `benbrott` from `benbrott, -et / fraktur, -en 3`.
- `sjukdomar` item 14: selected `benskörhet` from `benskörhet, -en / osteoporos`.
- `sjukdomar` item 19: selected `blåmärke` from `blåmärke, -t 4; blånad, -en 3`.
- `sjukdomar` item 23: selected `blödarsjuka` from `blödarsjuka, -n; hemofili, -n`.
- `sjukdomar` item 59: selected `gasbesvär` from `gasbesvär, -et / luftbesvär, -et`.
- `sjukdomar` item 62: selected `gulsot` from `gulsot, -en; icterus (en)`.
- `sjukdomar` item 63: selected `halsbränna` from `halsbränna, -n / sura uppstötningar`.
- `sjukdomar` item 64: selected `halsont` from `halsont, -en; ont i halsen`.
- `sjukdomar` item 69: selected `hjärninflammation` from `hjärninflammation, -en 3; encefalit,-en 3`.
- `sjukdomar` item 76: selected `hjärtstillestånd` from `hjärtstillestånd, -et; asyatoli, -n`.
- `sjukdomar` item 92: selected `koronarsjukdom` from `koronarsjukdom, -en 2; kranskärlssjukdom, -en 2`.
- `sjukdomar` item 102: selected `magont` from `magont, buksmärta, -n 1`.
- `sjukdomar` item 138: selected `urininkontinens` from `urininkontinens, -en / urinläckage`.
- `sjukdomar` item 139: selected `urinvägsinfektion` from `urinvägsinfektion,-en / - inflammation -en`.
- `mediciner` item 28: selected `måttbägare` from `en måttbägare 5 / ett måttglas 5`.
- `mediciner` item 29: selected `medicin` from `en medicin 3 / ett läkemedel 5`.
- `mediciner` item 38: selected `e-piller` from `ett e-piller 5 / ett p-piller 5`.
- `mediciner` item 48: selected `stolpiller` from `ett stolpiller 5 / ett suppositori/um 3`.
- `mediciner` item 57: selected `orsaka` from `förorsaka I / orsaka I / framkalla I / ge upphov til X l`.
- `mediciner` item 68: selected `irritera` from `irritera I / reta I`.
- `mediciner` item 92: selected `skonsam` from `skonsam ,-t, -ma / hudvänlig, -t, - a`.
- `mediciner` item 103: selected `uppfriskande` from `uppfriskande / uppiggande, taipum.`.
- `avdelningar` item 1: selected `barnarådgivningsbyrå` from `barnarådgivningsbyrå, -n 3 (Fi.) / BVC, barnavårdscentral, -en (Sv.)`.
- `avdelningar` item 3: selected `mödrarådgivning` from `en mödrarådgivning, -en (Fi.) / MVC, en mödravårdscentral 3 (Sv.)`.
- `avdelningar` item 7: selected `hälsocentral` from `hälsocentral, -en 3 (Fi.) / vårdcentral, -en 3 (Sv.)`.

## Duplicates removed

- `sjukdomar` item 88: `klaffel, -et 5` / `läppävika`.
- `forsta-hjalpen` item 14: `en förgiftning 2` / `myrkytys`.
- `forsta-hjalpen` item 17: `en hjärnskakning 2` / `aivotärähdys`.
- `forsta-hjalpen` item 35: `ett bett 5` / `purema`.
- `forsta-hjalpen` item 53: `illamående, -t` / `pahoinvointi`.
- `forsta-hjalpen` item 73: `svullnad, -en` / `turvotus`.
- `mediciner` item 78: `mildra I / lindra I / stilla I` / `lievittää`.

## Omitted source rows

- `anatomi` item 15: `en blodåd/er, -ern, -rar, -rarna` — `verisuoni` (unresolved visible alternative).
- `anatomi` item 24: `en fot 3 (mon. fötter, -na)` — `jalkaterä` (multi-word entry).
- `anatomi` item 30: `en hals 2` — `kaula, kurkku` (multi-word entry).
- `anatomi` item 33: `en hand (mon. händer, -na)` — `käsi` (multi-word entry).
- `anatomi` item 81: `en stjärt 2` — `peppu, pylly` (multi-word entry).
- `anatomi` item 83: `en tand 3 (mon. tänder, -na)` — `hammas` (multi-word entry).
- `anatomi` item 100: `ett ben 5` — `koko jalka` (multi-word entry).
- `sjukdomar` item 2: `åderförkalkning, -en` — `verisuonten kalkkeutuminen` (multi-word entry).
- `sjukdomar` item 20: `bli IV dement` — `dementoitua` (multi-word entry).
- `sjukdomar` item 21: `bli IV förkyl/d, -t, -da` — `vilustua` (unresolved visible alternative).
- `sjukdomar` item 38: `dement` — `dementiaa sairastava` (multi-word entry).
- `sjukdomar` item 45: `ett exrtra slag 5` — `lisälyönti` (multi-word entry).
- `sjukdomar` item 46: `ett sym(p)tom 5 på ngt` — `oire jstkn` (multi-word entry).
- `sjukdomar` item 55: `försvagad syn` — `heikentynyt näkö` (multi-word entry).
- `sjukdomar` item 56: `förträngning av kransartä rerna` — `sepelvaltimon tukkeuma` (multi-word entry).
- `sjukdomar` item 61: `gula febern` — `keltakuume` (multi-word entry).
- `sjukdomar` item 88: `klaffel, -et 5` — `läppävika` (duplicate canonical pair).
- `sjukdomar` item 95: `lårbenshalsbrott, -et` — `reisiluunkaulan murtuminen` (multi-word entry).
- `sjukdomar` item 98: `livmoderframfall, -et` — `kohdun laskeutuma` (multi-word entry).
- `sjukdomar` item 103: `må III illa` — `voida pahoin (fyys.)` (multi-word entry).
- `sjukdomar` item 110: `nedsatt hörsel, -n` — `huonontunut kuulo` (multi-word entry).
- `sjukdomar` item 114: `öronsusning, -en / tinnit us` — `korvien suhina` (multi-word entry).
- `sjukdomar` item 116: `röda hund` — `vihurirokko` (multi-word entry).
- `sjukdomar` item 140: `vara IV dement` — `dementoitunut` (multi-word entry).
- `sjukdomar` item 141: `vara IV förkyl/d, -t, -da` — `olla vilustunut` (unresolved visible alternative).
- `sjukdomar` item 142: `vara IV förlam/ad, -at, -a de` — `olla halvaantunut` (unresolved visible alternative).
- `forsta-hjalpen` item 1: `1. hoito (yl. )vård, -en, t.ex. äldrevård 2. hoito (lääket.) behandling, -en` — `hoito` (multi-word entry).
- `forsta-hjalpen` item 14: `en förgiftning 2` — `myrkytys` (duplicate canonical pair).
- `forsta-hjalpen` item 17: `en hjärnskakning 2` — `aivotärähdys` (duplicate canonical pair).
- `forsta-hjalpen` item 35: `ett bett 5` — `purema` (duplicate canonical pair).
- `forsta-hjalpen` item 37: `ett lårbensbrott 5` — `reisiluun murtuma` (multi-word entry).
- `forsta-hjalpen` item 38: `ett nyckelbensbrott 5` — `solisluun murtuma` (multi-word entry).
- `forsta-hjalpen` item 39: `ett revbensbrott 5` — `kylkiluun murtuma` (multi-word entry).
- `forsta-hjalpen` item 44: `ett sym(p)tom 5 (på ngt)` — `oire` (multi-word entry).
- `forsta-hjalpen` item 49: `framstupa sidoläge` — `kylkiasento` (multi-word entry).
- `forsta-hjalpen` item 53: `illamående, -t` — `pahoinvointi` (duplicate canonical pair).
- `forsta-hjalpen` item 55: `konstgjord andning, -en` — `tekohengitys` (multi-word entry).
- `forsta-hjalpen` item 60: `mun-mot-mun -metoden` — `suusta suuhun -menetelmä` (multi-word entry).
- `forsta-hjalpen` item 63: `omtöcknad` — `sekaisin oleva` (multi-word entry).
- `forsta-hjalpen` item 66: `skada I sig` — `satuttaa itsensä` (multi-word entry).
- `forsta-hjalpen` item 73: `svullnad, -en` — `turvotus` (duplicate canonical pair).
- `forsta-hjalpen` item 75: `ur led` — `sijoiltaan oleva` (multi-word entry).
- `forsta-hjalpen` item 76: `vak/en, -et, -na` — `valveilla` (unresolved visible alternative).
- `mediciner` item 1: `ända till första / andra ... strecket` — `ensimmäiseen / toiseen viivaan saakka` (unresolved visible alternative).
- `mediciner` item 2: `används efter måltid` — `käytetään ruokailun jälkeen` (multi-word entry).
- `mediciner` item 3: `badda I med borvatten` — `hautoa boorivedellä` (multi-word entry).
- `mediciner` item 4: `bakteriehämmande, taipum.` — `bakteereja tappava` (multi-word entry).
- `mediciner` item 6: `bestryka IV huden med salva` — `sivellä ihoa voiteella` (multi-word entry).
- `mediciner` item 7: `blandas med maten` — `sekoitetan ruokaan` (multi-word entry).
- `mediciner` item 8: `bör användas före ...` — `käytettävä ennen ...` (multi-word entry).
- `mediciner` item 17: `en dosett 3` — `annosrasia, dosetti` (multi-word entry).
- `mediciner` item 20: `en gång dagligen` — `kerran päivässä` (multi-word entry).
- `mediciner` item 24: `enligt läkarens föreskrift / enligt läkarordination` — `lääkärin määräyksen mukaan` (multi-word entry).
- `mediciner` item 25: `enligt särskild läkarordination` — `erityisen lääkärinmääräyksen mukaan` (multi-word entry).
- `mediciner` item 30: `en salva 1 / en kräm 3` — `salva, voide` (multi-word entry).
- `mediciner` item 46: `ett receptfritt läkemedel` — `käsikauppavalmiste` (multi-word entry).
- `mediciner` item 47: `ett sömnmed/el, -let 5` — `unilääke` (unresolved visible alternative).
- `mediciner` item 49: `får inte sväljas` — `ei saa niellä` (multi-word entry).
- `mediciner` item 50: `farligt att förtära` — `vaarallista nautittavaksi` (multi-word entry).
- `mediciner` item 51: `febersänkande, febernedsättande, taipum .` — `kuumetta alentava` (multi-word entry).
- `mediciner` item 53: `för barn i skolåldern` — `kouluikäisille` (multi-word entry).
- `mediciner` item 54: `för barn under 1 (ett) år` — `alle 1-vuotiaille` (multi-word entry).
- `mediciner` item 55: `före / under / efter måltid en` — `ennen ateriaa / aterian aikana / aterian jälkeen` (unresolved visible alternative).
- `mediciner` item 56: `för lokalbehandling` — `paikallisesti` (multi-word entry).
- `mediciner` item 59: `för spädbarn` — `vauvoille` (multi-word entry).
- `mediciner` item 62: `förvaras i upprätt ställnin g` — `säilytetään pystyasennossa` (multi-word entry).
- `mediciner` item 63: `förvaras oåtkomligt för barn` — `säilytetään lasten ulottumattomissa, ei lasten käsiin` (multi-word entry).
- `mediciner` item 64: `förvaras skyddad för ljus värme / fuktighet /` — `säilytetään suojattuna valolta / lämmöltä / kosteudelta` (unresolved visible alternative).
- `mediciner` item 65: `förvaras svalt / i rumstemperatur` — `säilytetään viileässä / huoneen lämmössä` (unresolved visible alternative).
- `mediciner` item 66: `för vuxna` — `aikuisille` (multi-word entry).
- `mediciner` item 67: `hudskyddande, taipum.` — `ihoa suojaava` (multi-word entry).
- `mediciner` item 69: `i samband med maten` — `ruuan yhteydessä` (multi-word entry).
- `mediciner` item 70: `klådstillande, taipum.` — `kutinaa lievittävä` (multi-word entry).
- `mediciner` item 73: `låtes lösa sig i munnen` — `annetaan liueta suussa` (multi-word entry).
- `mediciner` item 74: `lossa I / lösgöra (-gör, gjorde, - gjort) slem` — `irrottaa limaa` (multi-word entry).
- `mediciner` item 75: `löst i vatten` — `veteen liuotettuna` (multi-word entry).
- `mediciner` item 77: `massera I / gnida (gnider, gned, gnidit)IV in ett lager salva` — `hieroa (sisään) voidekerros` (multi-word entry).
- `mediciner` item 78: `mildra I / lindra I / stilla I` — `lievittää` (duplicate canonical pair).
- `mediciner` item 80: `minst, högst` — `vähintään, enintään` (multi-word entry).
- `mediciner` item 81: `mot brännskador` — `palovammoihin` (multi-word entry).
- `mediciner` item 82: `mot huggormsbett` — `kyyn puremaan` (multi-word entry).
- `mediciner` item 83: `mot insektbett` — `hyönteisen puremaan` (multi-word entry).
- `mediciner` item 84: `mot insektsting` — `hyönteisen pistoon` (multi-word entry).
- `mediciner` item 85: `mot kylskador` — `paleltumiin` (multi-word entry).
- `mediciner` item 86: `nedsätta (-sätter, -satte, -satt)` — `alentaa` (multi-word entry).
- `mediciner` item 89: `receptbelag/d, -t, -da` — `reseptillä saatava` (unresolved visible alternative).
- `mediciner` item 90: `receptfri, -tt, -a` — `ilman resptiä saatava` (multi-word entry).
- `mediciner` item 91: `sänka II feber` — `alentaa kuumetta` (multi-word entry).
- `mediciner` item 93: `slemlösande, taipum.` — `limaa irrottava` (multi-word entry).
- `mediciner` item 94: `smärtstillande, taipum.` — `kipua lievittävä` (multi-word entry).
- `mediciner` item 97: `stryka (stryker, strök, strukit) IV salva på huden` — `sivellä voidetta iholle` (multi-word entry).
- `mediciner` item 98: `sväljes hela` — `niellään kokonaisina` (multi-word entry).
- `mediciner` item 99: `ta IV (tar, tog, tagit) in / inta IV` — `ottaa, nauttia, syödä` (multi-word entry).
- `mediciner` item 100: `(till) invärtes / utvärtes (bruk)` — `sisäisesti / ulkoisesti` (unresolved visible alternative).
- `mediciner` item 101: `tuggas väl / tuggas sönder` — `pureskellaan hyvin / pureskellaan rikki` (unresolved visible alternative).
- `mediciner` item 102: `två gånger med 6 timmar mellanrum s` — `kaksi kertaa kuuden tunnin välein` (multi-word entry).
- `mediciner` item 104: `upplöses i vatten` — `liuotetaan veteen` (multi-word entry).
- `mediciner` item 105: `utspädd / outspädd` — `laimennettuna / laimentamattomana` (unresolved visible alternative).
- `mediciner` item 106: `värkstillande, taipum.` — `särkyä lievittävä` (multi-word entry).
- `mediciner` item 109: `vid behov` — `tarvittaessa` (multi-word entry).
- `mediciner` item 110: `vid förebyggande av X` — `X:n ehkäisyyn` (multi-word entry).
- `mediciner` item 111: `vid förkylningssy(p)tom 5` — `vilustumisoireisiin` (multi-word entry).
- `mediciner` item 112: `vid halsbränna` — `närästykseen` (multi-word entry).
- `mediciner` item 113: `vid lindrandet av hostretning` — `yskänärsytyksen lievittämiseen` (multi-word entry).
- `mediciner` item 114: `vid störningar i ämnesomsättningen` — `aineenvaihdunnan häiriöihin` (multi-word entry).
- `mediciner` item 115: `vid tillfällig värk` — `tilapäiseen särkyyn` (multi-word entry).
- `avdelningar` item 6: `första hjälpen` — `ensiapu` (multi-word entry).
- `avdelningar` item 8: `inremedicinska kliniken` — `sisätautiklinikka` (multi-word entry).
- `avdelningar` item 11: `kirurgiska kliniken` — `kirurgian klinikka` (multi-word entry).

## Later human review

- Reassess omitted phrase entries only if a future product version relaxes the one-lexical-item rule.
