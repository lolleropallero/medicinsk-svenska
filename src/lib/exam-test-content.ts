import { examCardPayload } from './exam-content';
import { finnishExamAnswers, normalizeExamAnswer, requireListedClasses, swedishExamAnswers, swedishLexicalKey } from './exam-test-answers';
import type { ExamTestTerm } from './exam-test-session';

// Only source constructions whose alternatives share a word need an explicit expansion.
const overrides: Record<string, { fi?: string[]; sv?: string[] }> = {
  'ett mellangärde 4 / ett / en diafragma, -er / or': { sv: ['ett mellangärde 4', 'ett diafragma', 'en diafragma'] },
  'bli IV bättre / sämre': { fi: ['muuttua paremmaksi', 'muuttua huonommaksi'], sv: ['bli IV bättre', 'bli IV sämre'] },
  'vänster / höger förmak': { fi: ['vasen eteinen', 'oikea eteinen'], sv: ['vänster förmak', 'höger förmak'] },
  'några / ett par gånger': { sv: ['några gånger', 'ett par gånger'] },
  'hjärtat slår hårdare/snabbare': { fi: ['sydän lyö kovemmin', 'sydän lyö nopeammin'], sv: ['hjärtat slår hårdare', 'hjärtat slår snabbare'] },
  'urinvägsinfektion,-en / -inflammation -en': { sv: ['en urinvägsinfektion', 'en urinvägsinflammation'] },
  'nedsatt hörsel': { fi: ['alentunut kuulo', 'heikentynyt kuulo'] },
  'klara I sig själv': { fi: ['selvitä itse', 'selvitä itsenäisesti'] },
  'täppa II till': { fi: ['tukkia'] },
  'bryta IV benet': { fi: ['murtaa jalka', 'katkaista jalka'] },
  'bryta IV armen': { fi: ['murtaa käsivarsi', 'katkaista käsivarsi'] },
  'bryta IV nyckelbenet': { fi: ['murtaa solisluu', 'katkaista solisluu'] },
  'oregelbund, -en, -et, -na': { sv: ['oregelbunden'] },
  'f.d. (före detta) X': { sv: ['f.d. X', 'före detta X'] },
};

const terms: ExamTestTerm[] = [];
for (const card of examCardPayload) {
  const override = overrides[card.sv];
  const fiAnswers = override?.fi ?? finnishExamAnswers(card.fi);
  const svAnswers = override?.sv ?? swedishExamAnswers(card.sv);
  terms.push({ id: card.id, topicIds: [card.deckId], fi: card.fi, sv: svAnswers[0]!, fiAnswers, svAnswers });
}

// One term can occur in several course lists, with different notation or synonyms.
// Merge connected meanings so it cannot reappear later and give away another question's answer.
const parents = terms.map((_, index) => index);
function root(index: number): number {
  if (parents[index] !== index) parents[index] = root(parents[index]!);
  return parents[index]!;
}
const seen = new Map<string, number>();
terms.forEach((term, index) => {
  const keys = [...term.fiAnswers.map((answer) => `fi:${normalizeExamAnswer(answer)}`), ...term.svAnswers.map((answer) => `sv:${swedishLexicalKey(answer)}`)];
  for (const key of keys) {
    const prior = seen.get(key);
    if (prior === undefined) seen.set(key, index);
    else parents[root(index)] = root(prior);
  }
});
const grouped = new Map<number, ExamTestTerm>();
terms.forEach((term, index) => {
  const key = root(index), prior = grouped.get(key);
  if (!prior) grouped.set(key, { ...term, topicIds: [...term.topicIds], fiAnswers: [...term.fiAnswers], svAnswers: [...term.svAnswers] });
  else {
    prior.topicIds = [...new Set([...prior.topicIds, ...term.topicIds])];
    prior.fiAnswers = [...new Set([...prior.fiAnswers, ...term.fiAnswers])];
    prior.svAnswers.push(...term.svAnswers);
  }
});
export const examTestTerms: ExamTestTerm[] = [...grouped.values()].map((term) => {
  const svAnswers = requireListedClasses(term.svAnswers);
  return { ...term, sv: svAnswers[0]!, svAnswers };
});
