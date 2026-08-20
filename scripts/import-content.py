"""One-time, source-grounded importer for the six V1 PDFs.

The generated JSON is committed; this script is not used by the browser or build.
"""
from __future__ import annotations
from pathlib import Path
import json, re
import pdfplumber

DOWNLOADS = Path(r"C:\Users\aleks\Downloads")
CONTENT = Path("content")
CONTENT.mkdir(exist_ok=True)

SOURCES = {
    "anatomi": "Anatomi ru-su.pdf",
    "sjukdomar": "Sjukdomar och besvär ru-su.pdf",
    "forsta-hjalpen": "Första hjälpen ru-su.pdf",
    "mediciner": "Mediciner, medicinering ru-su.pdf",
    "avdelningar": "Avdelningar ru-su.pdf",
}

DECKS = [
    {"id":"anatomi","nameFi":"Anatomia","descriptionFi":"Kehon rakenteet ja elimet.","sourceDocument":SOURCES["anatomi"],"status":"published"},
    {"id":"sjukdomar","nameFi":"Sairaudet ja vaivat","descriptionFi":"Sairauksia, oireita ja tavallisia vaivoja.","sourceDocument":SOURCES["sjukdomar"],"status":"published"},
    {"id":"forsta-hjalpen","nameFi":"Ensiapu","descriptionFi":"Ensiavun tilanteet, välineet ja oireet.","sourceDocument":SOURCES["forsta-hjalpen"],"status":"published"},
    {"id":"mediciner","nameFi":"Lääkkeet ja lääkitys","descriptionFi":"Lääkemuodot, vaikutukset ja lääkityksen sanasto.","sourceDocument":SOURCES["mediciner"],"status":"published"},
    {"id":"avdelningar","nameFi":"Osastot","descriptionFi":"Terveydenhuollon osastot ja vastaanotot.","sourceDocument":SOURCES["avdelningar"],"status":"published"},
]

# Item-specific canonical choices. Values are (Swedish term, article or None).
CHOICES = {
    ("anatomi",5):("äggstock","en"), ("anatomi",28):("haka","en"),
    ("anatomi",112):("ledband","ett"), ("anatomi",115):("mellangärde","ett"),
    ("anatomi",125):("säte","ett"), ("anatomi",137):("tonsiller",None),
    ("sjukdomar",1):("åderbrock",None), ("sjukdomar",5):("andnöd",None),
    ("sjukdomar",7):("angina",None), ("sjukdomar",12):("benbrott",None),
    ("sjukdomar",14):("benskörhet",None), ("sjukdomar",19):("blåmärke",None),
    ("sjukdomar",23):("blödarsjuka",None), ("sjukdomar",59):("gasbesvär",None),
    ("sjukdomar",62):("gulsot",None), ("sjukdomar",63):("halsbränna",None),
    ("sjukdomar",64):("halsont",None), ("sjukdomar",69):("hjärninflammation",None),
    ("sjukdomar",76):("hjärtstillestånd",None), ("sjukdomar",92):("koronarsjukdom",None),
    ("sjukdomar",102):("magont",None), ("sjukdomar",114):("öronsusning",None),
    ("sjukdomar",138):("urininkontinens",None), ("sjukdomar",139):("urinvägsinfektion",None),
    ("mediciner",28):("måttbägare","en"), ("mediciner",29):("medicin","en"),
    ("mediciner",38):("e-piller","ett"), ("mediciner",48):("stolpiller","ett"),
    ("mediciner",57):("orsaka",None), ("mediciner",68):("irritera",None),
    ("mediciner",74):("lossa",None), ("mediciner",78):("lindra",None),
    ("mediciner",92):("skonsam",None), ("mediciner",99):("ta",None),
    ("mediciner",103):("uppfriskande",None),
    ("avdelningar",1):("barnarådgivningsbyrå",None),
    ("avdelningar",3):("mödrarådgivning","en"),
    ("avdelningar",7):("hälsocentral",None),
}

CORRECTIONS = {
    ("anatomi",95):("finger","ett","Source has ‘et finger’; corrected the obvious missing t."),
    ("avdelningar",5):("förlossningsavdelning",None,"Source has ‘förlossninsavdelning’; corrected the missing g."),
    ("sjukdomar",144):("vattkoppor",None,"PDF extraction split Finnish ‘vesirokko’ across cells; visually unambiguous."),
    ("sjukdomar",145):("vitflytning",None,"PDF extraction split Finnish ‘valkovuoto’ across cells; visually unambiguous."),
}

def rows_from_pdf(path: Path):
    found: dict[int, tuple[str,str,int]] = {}
    with pdfplumber.open(path) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            for table in page.extract_tables():
                for row in table:
                    starts = [i for i,c in enumerate(row) if c and re.fullmatch(r"\d+\.", c.strip())]
                    for pos_index, start in enumerate(starts):
                        end = starts[pos_index+1] if pos_index+1 < len(starts) else len(row)
                        cells = [c.strip() for c in row[start+1:end] if c and c.strip()]
                        if len(cells) < 2:
                            continue
                        number = int(row[start].strip("."))
                        term = " ".join(cells[:-1]).replace("\n", " ")
                        fi = cells[-1].replace("\n", " ")
                        candidate = (term, fi, page_no)
                        # Prefer the least-fragmented extraction candidate.
                        if number not in found or len(term) + len(fi) < sum(map(len, found[number][:2])):
                            found[number] = candidate
    return found

def clean_pair(deck: str, number: int, raw_sv: str, raw_fi: str):
    raw_sv = re.sub(r"\s+", " ", raw_sv).strip()
    raw_fi = re.sub(r"\s+", " ", raw_fi).strip()
    article = None
    if (deck,number) in CORRECTIONS:
        sv, article, _ = CORRECTIONS[(deck,number)]
    elif (deck,number) in CHOICES:
        sv, article = CHOICES[(deck,number)]
    else:
        first = re.split(r"\s+/\s+|;", raw_sv, 1)[0].strip()
        match = re.match(r"^(en|ett)\s+(.+)$", first)
        if match:
            article, first = match.groups()
        first = re.split(r",", first, 1)[0]
        first = re.sub(r"\s+\d+\*?$", "", first).strip()
        first = re.sub(r"\s+taipum\.?$", "", first).strip()
        first = re.sub(r"\s+(?:I|II|IIa|IIb|III|IV)$", "", first).strip()
        first = re.sub(r"\(([^)]*)\)", lambda m: m.group(1) if len(m.group(1)) == 1 else "", first)
        sv = first.strip()
    fi = re.sub(r"\s*\([^)]*\)\s*$", "", raw_fi).strip()
    # Repair two extraction splits verified against the one-page table.
    if deck == "sjukdomar" and number == 144: fi = "vesirokko"
    if deck == "sjukdomar" and number == 145: fi = "valkovuoto"
    reason = None
    if not sv or not fi: reason = "empty field after extraction"
    elif any(ch in sv for ch in "/\n") or any(ch in fi for ch in "/\n"): reason = "unresolved visible alternative"
    elif " " in sv or " " in fi: reason = "multi-word entry"
    elif "," in fi or ";" in fi: reason = "multiple Finnish meanings"
    elif deck == "sjukdomar" and number in {20,21,38,55,56,103,110,140,141,142}: reason = "phrase or explanatory form"
    elif deck == "mediciner" and number in {30}: reason = "multiple Finnish meanings"
    return sv, fi, article, reason

cards, omissions, choices, corrections = [], [], [], []
seen_pairs = set()
for deck, filename in SOURCES.items():
    entries = rows_from_pdf(DOWNLOADS / filename)
    for number, (raw_sv, raw_fi, page) in sorted(entries.items()):
        sv, fi, article, reason = clean_pair(deck, number, raw_sv, raw_fi)
        pair = (fi.casefold(), sv.casefold())
        if not reason and pair in seen_pairs:
            reason = "duplicate canonical pair"
        if reason:
            omissions.append((deck, number, raw_sv, raw_fi, reason))
            continue
        seen_pairs.add(pair)
        source_tail = raw_sv
        pos = "noun" if article or "," in source_tail else ("verb" if re.search(r"\b(?:I|II|IIa|IIb|III|IV)\b", source_tail) else None)
        card = {"id":f"{deck}-{number:03d}","deckId":deck,"fi":fi,"sv":sv,"status":"published",
                "source":{"document":filename,"page":page,"item":str(number)}}
        if article: card["article"] = article
        if pos: card["partOfSpeech"] = pos
        cards.append(card)
        if (deck,number) in CHOICES: choices.append((deck,number,raw_sv,sv))
        if (deck,number) in CORRECTIONS: corrections.append((deck,number,raw_sv,sv,CORRECTIONS[(deck,number)][2]))

DESCRIPTIONS = [
 # cells, tissues, skin (8)
 ("celler","Cellens geléaktiga inre innehåller mest vatten och lösta ämnen. Vad kallas det?","cytoplasma",1),
 ("celler","Denna tunna hinna omger cytoplasman. Vad är det?","cellmembran",1),
 ("celler","Den finns i cytoplasman och innehåller cellens arvsmassa. Vad är det?","cellkärna",1),
 ("celler","Dessa små delar i cytoplasman sköter bland annat cellens andning och ämnesomsättning. Vad kallas de?","organeller",1),
 ("vävnader","Den täcker kroppens inre och yttre ytor och fungerar som skydd. Vilken vävnadstyp är det?","epitelvävnad",2),
 ("vävnader","Ben, brosk, fett och blod hör till denna vävnadstyp. Vilken?","stödjevävnad",2),
 ("vävnader","Den består av celler som kan dra ihop sig. Vilken vävnadstyp är det?","muskelvävnad",2),
 ("hud","Detta är kroppens största organ och har tre lager. Vad är det?","hud",2),
 # skeleton, joints, muscles (7)
 ("skelett","Det fungerar som kroppens stomme och skyddar inälvorna. Vad är det?","skelett",4),
 ("skelett","Den finns bland annat i bröstbenet och där bildas blodkroppar. Vad är det?","benmärg",4),
 ("skelett","Den går inne i ryggraden och leder information till och från hjärnan. Vad är det?","ryggmärg",4),
 ("leder","Här möts två eller flera benändar, som kan röra sig mot varandra. Vad är det?","led",4),
 ("leder","Denna ledtyp kan röra sig åt alla håll och finns i axeln och höften. Vad kallas den?","kulled",4),
 ("muskler","Denna viljestyrda och snabba muskulatur bygger upp de stora musklerna i armar och ben. Vilken?","skelettmuskulatur",5),
 ("muskler","Den finns i blodkärlens väggar, luftrören och mag-tarmkanalen och kan inte styras av viljan. Vilken muskulatur?","glatt muskulatur",5),
 # nervous and senses (7)
 ("nervsystem","Det består av hjärnan, ryggmärgen och nerverna. Vad är det?","nervsystem",6),
 ("nervsystem","Den är mest utvecklad av hjärnans delar och innehåller centra för bland annat känsel, syn, tal och minne. Vad är det?","storhjärna",6),
 ("nervsystem","Denna del av hjärnan styr rörelser och balans. Vad är det?","lillhjärna",6),
 ("nervsystem","Här finns områden som reglerar andning och blodcirkulation. Vilken del av hjärnan?","hjärnstam",6),
 ("nervsystem","Flera nervtrådar löper tillsammans i en bindvävsskida. Vad bildar de?","nerv",6),
 ("sinnen","Cellerna här reagerar på ljus och färg och omvandlar ljuset till nervimpulser. Vilken del av ögat?","näthinna",6),
 ("sinnen","Celler här registrerar både hörsel- och balansintryck. Vilken del av örat?","inneröra",7),
 # circulation and respiration (8)
 ("cirkulation","Det ligger mellan lungorna, har två förmak och två kamrar och pumpar blod. Vad är det?","hjärta",7),
 ("cirkulation","Dessa blodkärl leder blod från hjärtat ut i kroppen. Vad kallas de?","artärer",8),
 ("cirkulation","Dessa blodkärl leder blod från vävnaderna tillbaka till hjärtat. Vad kallas de?","vener",8),
 ("cirkulation","Dessa är de minsta blodkärlen och förenar artärer med vener. Vad kallas de?","kapillärer",8),
 ("andning","Här tas syrgas upp i blodet och koldioxid avges. Vilka organ är det?","lungor",8),
 ("andning","Dessa små strukturer i lungorna för över syrgas till blodet. Vad kallas de?","lungblåsor",8),
 ("andning","Den värmer, befuktar och renar inandningsluften och innehåller luktsinnesceller. Vad är det?","näshåla",8),
 ("andning","Den hindrar föda från att hamna i luftstrupen och gör det möjligt att bilda ljud. Vad är det?","struphuvud",8),
 # blood and immunity (6)
 ("blod","Den flytande delen av blodet omger blodkropparna. Vad kallas den?","blodplasma",9),
 ("blod","Dessa blodkroppar innehåller hemoglobin och transporterar syre. Vilka är de?","röda blodkroppar",10),
 ("immunförsvar","Dessa blodkroppar skyddar kroppen mot infektioner och kan bilda antikroppar. Vilka är de?","vita blodkroppar",10),
 ("blod","Dessa kan klumpa ihop sig och hjälpa till att stoppa en blödning. Vad kallas de?","blodplättar",10),
 ("immunförsvar","Denna vätska sugs upp av särskilda kärl i vävnaderna och återförs senare till blodet. Vad är det?","lymfa",10),
 ("immunförsvar","Detta organ ligger till vänster i buken, filtrerar blod och bryter ner gamla röda blodkroppar. Vad är det?","mjälte",10),
 # digestion and urinary (7)
 ("matsmältning","Detta rör leder födan från svalget till magsäcken. Vad är det?","matstrupe",11),
 ("matsmältning","Detta organ bildar sekret som hjälper till att bryta ned födan och ligger i övre delen av buken. Vad är det?","lever",11),
 ("matsmältning","Denna körtel hör till mag-tarmkanalen och bildar vätska som hjälper till att bryta ned födan. Vad är det?","bukspottkörtel",11),
 ("urinvägar","Dessa organ filtrerar blodet, reglerar vätska och salter och bildar urin. Vilka är de?","njurar",11),
 ("urinvägar","Dessa leder urinen från njurarna till urinblåsan. Vad kallas de?","urinledare",11),
 ("urinvägar","Här lagras urinen tillfälligt innan den töms. Vad är det?","urinblåsa",11),
 ("urinvägar","Genom detta rör lämnar urinen kroppen. Vad är det?","urinrör",12),
 # reproduction, hormones, temperature (8)
 ("fortplantning","Här bildas sädescellerna. Vilka organ är det?","testiklar",12),
 ("fortplantning","Här mognar sädescellerna efter att de har bildats. Vad är det?","bitestiklar",12),
 ("fortplantning","Dessa organ avger mogna ägg och ligger långt ner i buken. Vilka är de?","äggstockar",12),
 ("fortplantning","Här sker befruktningen vanligen och ägget förs vidare mot livmodern. Vad är det?","äggledare",12),
 ("fortplantning","Det befruktade ägget bäddas in i detta organs slemhinna och utvecklas där. Vad är det?","livmoder",13),
 ("hormoner","Denna körtel är ett endokrint organ och dess hormon påverkar ämnesomsättningen och kroppstemperaturen. Vad är det?","sköldkörtel",13),
 ("hormoner","Dessa signalämnen bildas i endokrina organ och transporteras med blodet. Vad kallas de?","hormoner",13),
 ("temperatur","Det finns i hjärnan, fungerar som en termostat och reglerar kroppens inre temperatur. Vad är det?","temperaturcentrum",13),
]

descriptions=[]
for i,(section,prompt,answer,page) in enumerate(DESCRIPTIONS,1):
    descriptions.append({"id":f"beskrivning-{i:03d}","descriptionSv":prompt,"answerSv":answer,
      "status":"published","source":{"document":"Människoroppen - en översikt.pdf","page":page,"section":section}})

(CONTENT/"decks.json").write_text(json.dumps(DECKS,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
(CONTENT/"flashcards.json").write_text(json.dumps(cards,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
(CONTENT/"descriptions.json").write_text(json.dumps(descriptions,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

lines=["# Content review notes","","The six V1 PDFs were extracted with pdfplumber. Ambiguous rows were checked against the rendered source layout. Learner-facing data contains only canonical terms.","","## Corrections made",""]
for deck,n,raw,fixed,why in corrections: lines.append(f"- `{deck}` item {n}: `{raw}` → `{fixed}`. {why}")
lines += ["","## Canonical choices made",""]
for deck,n,raw,fixed in choices: lines.append(f"- `{deck}` item {n}: selected `{fixed}` from `{raw}`.")
lines += ["","## Duplicates removed",""]
dups=[o for o in omissions if o[4]=="duplicate canonical pair"]
lines += [f"- `{d}` item {n}: `{sv}` / `{fi}`." for d,n,sv,fi,_ in dups] or ["- None."]
lines += ["","## Omitted source rows",""]
for deck,n,sv,fi,reason in omissions: lines.append(f"- `{deck}` item {n}: `{sv}` — `{fi}` ({reason}).")
lines += ["","## Later human review", "", "- Reassess omitted phrase entries only if a future product version relaxes the one-lexical-item rule."]
(CONTENT/"review-notes.md").write_text("\n".join(lines)+"\n",encoding="utf-8")

from collections import Counter
print("cards", Counter(c["deckId"] for c in cards), "total", len(cards))
print("descriptions", Counter(d["source"]["section"] for d in descriptions), "total", len(descriptions))
print("omissions", Counter(o[0] for o in omissions))
