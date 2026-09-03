import { describe, expect, it } from 'vitest';
import { validateAnamnesisContent } from '../../scripts/validate-content';
import anamnesisCasesData from '../../content/anamnesis-cases.json';
import type { AnamnesisCase, AnamnesisSection } from '../../src/types/content';

// Transcribed independently from the task's required content (not derived from content/anamnesis-cases.json)
// so this test can catch drift in either direction.
const expectedSections: AnamnesisSection[] = [
  {
    id: 'nykyinen-vaiva', nameFi: 'Nykyinen vaiva', items: [
      { id: 'rintakipu-01', patientSv: 'Sedan en tid tillbaka får jag då och då ont i bröstet.', modelQuestionsSv: ['Vad har ni för besvär?', 'Vad söker ni för idag?'] },
      { id: 'rintakipu-02', patientSv: 'För ungefär tre månader sedan.', modelQuestionsSv: ['När började besvären?'] },
      { id: 'rintakipu-03', patientSv: 'Mitt i bröstet, ungefär här.', modelQuestionsSv: ['Var i bröstet gör det ont?'] },
      { id: 'rintakipu-04', patientSv: 'I vänster axel.', modelQuestionsSv: ['Strålar smärtan någonstans?', 'Vart strålar smärtan?'] },
      { id: 'rintakipu-05', patientSv: 'Det känns som ett tryck över bröstet.', modelQuestionsSv: ['Hur känns smärtan?', 'Hur skulle ni beskriva smärtan?'] },
      { id: 'rintakipu-06', patientSv: 'När jag promenerar fort gör det ordentligt ont i bröstet.', modelQuestionsSv: ['När brukar smärtan komma?', 'Vad utlöser smärtan?'] },
      { id: 'rintakipu-07', patientSv: 'När jag lägger mig ner och vilar en stund försvinner smärtan.', modelQuestionsSv: ['Vad får smärtan att gå över?', 'Vad lindrar smärtan?'] },
      { id: 'rintakipu-08', patientSv: 'Vanligtvis fem till tio minuter.', modelQuestionsSv: ['Hur länge brukar smärtan hålla i sig?'] },
      { id: 'rintakipu-09', patientSv: 'Kanske två eller tre gånger i veckan.', modelQuestionsSv: ['Hur ofta får ni ont?'] },
      { id: 'rintakipu-10', patientSv: 'Ungefär sju av tio när det är som värst.', modelQuestionsSv: ['Hur ont gör det på en skala från noll till tio?'] },
    ],
  },
  {
    id: 'liitannaisoireet', nameFi: 'Liitännäisoireet', items: [
      { id: 'rintakipu-11', patientSv: 'Ja, jag blir också andfådd när det händer.', modelQuestionsSv: ['Blir ni andfådd samtidigt?'] },
      { id: 'rintakipu-12', patientSv: 'Ibland blir jag lite kallsvettig.', modelQuestionsSv: ['Blir ni kallsvettig?'] },
      { id: 'rintakipu-13', patientSv: 'Nej, jag brukar inte må illa.', modelQuestionsSv: ['Mår ni illa när ni har ont?'] },
      { id: 'rintakipu-14', patientSv: 'Ibland känns det som om hjärtat slår fort.', modelQuestionsSv: ['Får ni hjärtklappning?'] },
      { id: 'rintakipu-15', patientSv: 'Nej, jag har aldrig svimmat någon gång.', modelQuestionsSv: ['Har ni svimmat eller varit nära att svimma?'] },
      { id: 'rintakipu-16', patientSv: 'Nej, det är inget fel på mina ben.', modelQuestionsSv: ['Har ni haft svullnad eller smärta i benen?'] },
      { id: 'rintakipu-17', patientSv: 'Nej, jag har varken hosta eller feber.', modelQuestionsSv: ['Har ni haft hosta eller feber?'] },
      { id: 'rintakipu-18', patientSv: 'Nej, det gör ingen skillnad.', modelQuestionsSv: ['Blir smärtan värre när ni andas djupt?'] },
    ],
  },
  {
    id: 'aiemmat-sairaudet-toimenpiteet', nameFi: 'Aiemmat sairaudet ja toimenpiteet', items: [
      { id: 'rintakipu-19', patientSv: 'Ja, ibland ligger blodtrycket kring 160–170.', modelQuestionsSv: ['Har ni högt blodtryck?', 'Vet ni vad ert blodtryck brukar ligga på?'] },
      { id: 'rintakipu-20', patientSv: 'Nej, jag har inte diabetes.', modelQuestionsSv: ['Har ni diabetes?'] },
      { id: 'rintakipu-21', patientSv: 'Nej, jag vet inte vad mitt kolesterolvärde är.', modelQuestionsSv: ['Vet ni vad ert kolesterolvärde är?'] },
      { id: 'rintakipu-22', patientSv: 'Nej, jag har aldrig haft någon hjärtinfarkt eller annan hjärtsjukdom.', modelQuestionsSv: ['Har ni haft någon hjärtsjukdom tidigare?'] },
      { id: 'rintakipu-23', patientSv: 'Nej, jag har aldrig haft någon blodpropp.', modelQuestionsSv: ['Har ni haft någon blodpropp tidigare?'] },
      { id: 'rintakipu-24', patientSv: 'Två gånger, först för blindtarmen och sedan för att jag bröt armen.', modelQuestionsSv: ['Har ni opererats tidigare?'] },
    ],
  },
  {
    id: 'laakitys-allergiat', nameFi: 'Lääkitys ja allergiat', items: [
      { id: 'rintakipu-25', patientSv: 'Ja, jag tar tabletter mot ryggvärk.', modelQuestionsSv: ['Tar ni några läkemedel regelbundet?', 'Använder ni några mediciner?'] },
      { id: 'rintakipu-26', patientSv: 'Jag kommer inte ihåg namnet, men jag tar en tablett vid behov.', modelQuestionsSv: ['Vad heter medicinen och hur ofta tar ni den?'] },
      { id: 'rintakipu-27', patientSv: 'Hösnuva, och jag nyser alltid i närheten av katter.', modelQuestionsSv: ['Har ni några allergier?'] },
    ],
  },
  {
    id: 'sukuanamneesi', nameFi: 'Sukuanamneesi', items: [
      { id: 'rintakipu-28', patientSv: 'Min pappa fick hjärtinfarkt när han var 54.', modelQuestionsSv: ['Finns det hjärt- och kärlsjukdomar i släkten?'] },
      { id: 'rintakipu-29', patientSv: 'Ja, min morfar hade blödarsjuka.', modelQuestionsSv: ['Finns det några andra ärftliga sjukdomar i släkten?'] },
    ],
  },
  {
    id: 'tupakka-alkoholi-paihteet', nameFi: 'Tupakka, alkoholi ja päihteet', items: [
      { id: 'rintakipu-30', patientSv: 'Nej, jag slutade för ett par år sedan.', modelQuestionsSv: ['Röker ni?'] },
      { id: 'rintakipu-31', patientSv: 'Ungefär ett paket om dagen.', modelQuestionsSv: ['Hur mycket rökte ni?'] },
      { id: 'rintakipu-32', patientSv: 'I ungefär trettio år.', modelQuestionsSv: ['Hur länge rökte ni?'] },
      { id: 'rintakipu-33', patientSv: 'Jag dricker en öl till maten varje dag och ibland lite vin.', modelQuestionsSv: ['Hur mycket alkohol dricker ni?'] },
      { id: 'rintakipu-34', patientSv: 'Nej, aldrig! Sånt håller jag inte på med!', modelQuestionsSv: ['Använder ni narkotika eller andra droger?', 'Använder ni några andra rusmedel?'] },
    ],
  },
  {
    id: 'sosiaalinen-anamneesi-elintavat', nameFi: 'Sosiaalinen anamneesi ja elintavat', items: [
      { id: 'rintakipu-35', patientSv: 'Jag jobbar som snickare på en byggfirma.', modelQuestionsSv: ['Vad arbetar ni med?'] },
      { id: 'rintakipu-36', patientSv: 'Nej, jag är inte gift.', modelQuestionsSv: ['Är ni gift eller sambo?'] },
      { id: 'rintakipu-37', patientSv: 'Jag bor ensam i en lägenhet.', modelQuestionsSv: ['Bor ni ensam?', 'Hur bor ni?'] },
      { id: 'rintakipu-38', patientSv: 'Jag promenerar ibland, men jag motionerar inte regelbundet.', modelQuestionsSv: ['Motionerar ni regelbundet?'] },
    ],
  },
  {
    id: 'perustiedot', nameFi: 'Perustiedot', items: [
      { id: 'rintakipu-39', patientSv: 'Jag är 57 år, 1,60 meter lång och väger 96 kilo.', modelQuestionsSv: ['Hur gammal är ni?', 'Hur lång är ni?', 'Hur mycket väger ni?'] },
    ],
  },
];
const expectedSectionCounts = [10, 8, 6, 3, 2, 5, 4, 1];

describe('anamnesis case content — exact required content', () => {
  const cases = anamnesisCasesData as AnamnesisCase[];
  const rintakipu = cases.find((item) => item.id === 'rintakipu')!;

  it('ships exactly one case: the published Rintakipu anamnesis', () => {
    expect(cases).toHaveLength(1);
    expect(rintakipu).toMatchObject({ id: 'rintakipu', nameFi: 'Rintakipu', status: 'published' });
  });

  it('has exactly the eight required sections, in order, with the required item counts', () => {
    expect(rintakipu.sections.map((section) => section.id)).toEqual(expectedSections.map((section) => section.id));
    expect(rintakipu.sections.map((section) => section.nameFi)).toEqual(expectedSections.map((section) => section.nameFi));
    expect(rintakipu.sections.map((section) => section.items.length)).toEqual(expectedSectionCounts);
  });

  it('matches the required content exactly: every patient line and model question, in order', () => {
    expect(rintakipu.sections).toEqual(expectedSections);
  });

  it('numbers all 39 items sequentially across the whole case', () => {
    const ids = rintakipu.sections.flatMap((section) => section.items.map((item) => item.id));
    expect(ids).toHaveLength(39);
    expect(ids).toEqual(Array.from({ length: 39 }, (_, index) => `rintakipu-${String(index + 1).padStart(2, '0')}`));
  });
});

describe('anamnesis content structural validation', () => {
  const makeCase = (overrides: Partial<AnamnesisCase> = {}): AnamnesisCase => ({
    id: 'rintakipu', nameFi: 'Rintakipu', status: 'published', sections: expectedSections, ...overrides,
  });
  const errorsFor = (cases: unknown[] = [makeCase()]) => validateAnamnesisContent(cases);

  it('accepts the well-formed required case', () => expect(errorsFor()).toEqual([]));

  it('rejects more or fewer than one case', () => {
    expect(errorsFor([]).some((error) => error.includes('exactly one anamnesis case'))).toBe(true);
    expect(errorsFor([makeCase(), makeCase({ id: 'other' })]).some((error) => error.includes('exactly one anamnesis case'))).toBe(true);
  });

  it('rejects a missing, unpublished, or renamed required case', () => {
    expect(errorsFor([makeCase({ status: 'review' })]).some((error) => error.includes('required published anamnesis case'))).toBe(true);
    expect(errorsFor([makeCase({ nameFi: 'Väärä nimi' })]).some((error) => error.includes('required published anamnesis case'))).toBe(true);
  });

  it('rejects unknown properties on the case, a section, or an item', () => {
    expect(errorsFor([{ ...makeCase(), extra: true }]).some((error) => error.includes('unknown anamnesis case properties'))).toBe(true);
    const badSection = [{ ...expectedSections[0]!, extra: true }, ...expectedSections.slice(1)];
    expect(errorsFor([makeCase({ sections: badSection })]).some((error) => error.includes('unknown anamnesis section properties'))).toBe(true);
    const badItemSection = { ...expectedSections[0]!, items: [{ ...expectedSections[0]!.items[0]!, extra: true }, ...expectedSections[0]!.items.slice(1)] };
    expect(errorsFor([makeCase({ sections: [badItemSection, ...expectedSections.slice(1)] })]).some((error) => error.includes('unknown anamnesis item properties'))).toBe(true);
  });

  it('rejects a wrong number of sections', () => {
    expect(errorsFor([makeCase({ sections: expectedSections.slice(0, 7) })]).some((error) => error.includes('exactly 8 sections'))).toBe(true);
  });

  it('rejects sections that are reordered, renamed, or unrecognized', () => {
    const swapped = [expectedSections[1]!, expectedSections[0]!, ...expectedSections.slice(2)];
    expect(errorsFor([makeCase({ sections: swapped })]).some((error) => error.includes('out of order'))).toBe(true);
    const renamed = [{ ...expectedSections[0]!, nameFi: 'Väärä osio' }, ...expectedSections.slice(1)];
    expect(errorsFor([makeCase({ sections: renamed })]).some((error) => error.includes('out of order'))).toBe(true);
  });

  it('rejects a section with the wrong item count', () => {
    const short = { ...expectedSections[0]!, items: expectedSections[0]!.items.slice(0, 5) };
    expect(errorsFor([makeCase({ sections: [short, ...expectedSections.slice(1)] })]).some((error) => error.includes('exactly 10 items'))).toBe(true);
  });

  it('rejects non-sequential or case-mismatched item IDs', () => {
    const reordered = { ...expectedSections[0]!, items: [expectedSections[0]!.items[1]!, expectedSections[0]!.items[0]!, ...expectedSections[0]!.items.slice(2)] };
    expect(errorsFor([makeCase({ sections: [reordered, ...expectedSections.slice(1)] })]).some((error) => error.includes('not sequential'))).toBe(true);
    const wrongCase = { ...expectedSections[0]!, items: [{ ...expectedSections[0]!.items[0]!, id: 'other-01' }, ...expectedSections[0]!.items.slice(1)] };
    expect(errorsFor([makeCase({ sections: [wrongCase, ...expectedSections.slice(1)] })]).some((error) => error.includes('does not match case') || error.includes('not sequential'))).toBe(true);
  });

  it('rejects a duplicate item ID', () => {
    const duplicated = { ...expectedSections[0]!, items: [expectedSections[0]!.items[0]!, expectedSections[0]!.items[0]!, ...expectedSections[0]!.items.slice(2)] };
    expect(errorsFor([makeCase({ sections: [duplicated, ...expectedSections.slice(1)] })]).some((error) => error.includes('not sequential'))).toBe(true);
  });

  it('rejects zero, too many, or duplicate model questions on an item', () => {
    const zero = { ...expectedSections[0]!.items[0]!, modelQuestionsSv: [] };
    expect(errorsFor([makeCase({ sections: [{ ...expectedSections[0]!, items: [zero, ...expectedSections[0]!.items.slice(1)] }, ...expectedSections.slice(1)] })])
      .some((error) => error.includes('between one and three model questions'))).toBe(true);
    const four = { ...expectedSections[0]!.items[0]!, modelQuestionsSv: ['a?', 'b?', 'c?', 'd?'] };
    expect(errorsFor([makeCase({ sections: [{ ...expectedSections[0]!, items: [four, ...expectedSections[0]!.items.slice(1)] }, ...expectedSections.slice(1)] })])
      .some((error) => error.includes('between one and three model questions'))).toBe(true);
    const dup = { ...expectedSections[0]!.items[0]!, modelQuestionsSv: ['Samma fråga?', 'Samma fråga?'] };
    expect(errorsFor([makeCase({ sections: [{ ...expectedSections[0]!, items: [dup, ...expectedSections[0]!.items.slice(1)] }, ...expectedSections.slice(1)] })])
      .some((error) => error.includes('duplicate model question'))).toBe(true);
  });

  it('rejects empty, whitespace-broken, newline, or alternative-pattern dialogue text', () => {
    const fields: [string, AnamnesisSection[]][] = [
      ['empty patient line', [{ ...expectedSections[0]!, items: [{ ...expectedSections[0]!.items[0]!, patientSv: '' }, ...expectedSections[0]!.items.slice(1)] }, ...expectedSections.slice(1)]],
      ['padded patient line', [{ ...expectedSections[0]!, items: [{ ...expectedSections[0]!.items[0]!, patientSv: '  padded  ' }, ...expectedSections[0]!.items.slice(1)] }, ...expectedSections.slice(1)]],
      ['slash in model question', [{ ...expectedSections[0]!, items: [{ ...expectedSections[0]!.items[0]!, modelQuestionsSv: ['a/b?'] }, ...expectedSections[0]!.items.slice(1)] }, ...expectedSections.slice(1)]],
      ['newline in patient line', [{ ...expectedSections[0]!, items: [{ ...expectedSections[0]!.items[0]!, patientSv: 'line one\nline two' }, ...expectedSections[0]!.items.slice(1)] }, ...expectedSections.slice(1)]],
    ];
    for (const [label, sections] of fields) {
      expect(errorsFor([makeCase({ sections })]).length, `expected an error for ${label}`).toBeGreaterThan(0);
    }
  });
});
