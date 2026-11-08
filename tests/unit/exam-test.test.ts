import { describe, expect, it } from 'vitest';
import { examTestTerms } from '../../src/lib/exam-test-content';
import { examTopics } from '../../src/lib/exam-content';
import { finnishExamAnswers, requireListedClasses, swedishExamAnswers, swedishLexicalKey } from '../../src/lib/exam-test-answers';
import {
  createExamTest, gradeExamTest, isExamTestAnswerCorrect, isStoredExamTest, moveExamTest, scoreExamTestAnswer, submitExamTest, updateExamTestAnswer,
  type ExamTestTerm,
} from '../../src/lib/exam-test-session';
import { seededRandom } from '../../src/lib/session';

const termsById = new Map(examTestTerms.map((term) => [term.id, term]));
const findTerm = (fi: string) => examTestTerms.find((term) => term.fi === fi)!;

describe('exam answer keys', () => {
  it('requires the listed noun article and class, without fuzzy spelling or missing accents', () => {
    const child: ExamTestTerm = { id: 'child', topicIds: ['t'], fi: 'lapsi', sv: 'ett barn 5', fiAnswers: ['lapsi'], svAnswers: ['ett barn 5'] };
    expect(isExamTestAnswerCorrect(child, 'fi-sv', '  ETT  barn 5. ')).toBe(true);
    for (const answer of ['barn', 'ett barn', 'barn 5', 'en barn 5', 'ett barn 4', 'ett barrn 5']) {
      expect(isExamTestAnswerCorrect(child, 'fi-sv', answer)).toBe(false);
    }
    expect(isExamTestAnswerCorrect(findTerm('pää'), 'sv-fi', 'paa')).toBe(false);
    expect(isExamTestAnswerCorrect(findTerm('pää'), 'fi-sv', 'ett huvud 5')).toBe(true);
    expect(isExamTestAnswerCorrect(findTerm('pää'), 'fi-sv', 'ett huvud')).toBe(false);
  });

  it('decodes supplied noun and verb notation, optional stem letters and inflection notes', () => {
    expect(swedishExamAnswers('smärta, -n 1')).toEqual(['en smärta 1']);
    expect(swedishExamAnswers('ett öga, -t, ögon, -en')).toEqual(['ett öga']);
    expect(swedishExamAnswers('en näsborr(e) 2')).toEqual(['en näsborre 2', 'en näsborr 2']);
    expect(swedishExamAnswers('en äggstock 2 / ett ovari/um, -et, -er')).toEqual(['en äggstock 2', 'ett ovarium']);
    expect(swedishExamAnswers('förlam/ad, -at, -ade')).toEqual(['förlamad']);
    expect(swedishExamAnswers('lindra I')).toEqual(['lindra I']);
    expect(isExamTestAnswerCorrect(findTerm('lievittää'), 'fi-sv', 'lindra')).toBe(false);
    expect(isExamTestAnswerCorrect(findTerm('lievittää'), 'fi-sv', 'lindra I')).toBe(true);
  });

  it('accepts listed synonyms but never lets an incorrect alternative hide behind a correct one', () => {
    const jaw = findTerm('leuka');
    expect(isExamTestAnswerCorrect(jaw, 'fi-sv', 'en haka 1')).toBe(true);
    expect(isExamTestAnswerCorrect(jaw, 'fi-sv', 'en käke 2')).toBe(true);
    expect(isExamTestAnswerCorrect(jaw, 'fi-sv', 'en haka 1 / en käke 2')).toBe(true);
    expect(isExamTestAnswerCorrect(jaw, 'fi-sv', 'en haka 1 / en käke')).toBe(false);
    expect(isExamTestAnswerCorrect(jaw, 'fi-sv', 'en haka 1 / en fot 3')).toBe(false);
    expect(finnishExamAnswers('vamma, vaurio')).toEqual(['vamma', 'vaurio']);
    expect(findTerm('vasen / oikea eteinen').fiAnswers).toEqual(['vasen eteinen', 'oikea eteinen']);
  });

  it('preserves prepositions and only requires classes actually supplied by the lists', () => {
    expect(swedishLexicalKey('i vila')).toBe('i vila');
    expect(swedishLexicalKey('vila I sig')).toBe('vila sig');
    expect(findTerm('lepo').fiAnswers).not.toContain('levossa');
    expect(findTerm('levossa').svAnswers).toEqual(['i vila']);
    expect(findTerm('hengenahdistus').svAnswers).toContain('en andnöd');
    expect(requireListedClasses(['en svullnad', 'en svullnad 3'])).toEqual(['en svullnad 3']);
    expect(findTerm('sivuääni').svAnswers).toEqual(['ett biljud 5']);
    expect(isExamTestAnswerCorrect(findTerm('sivuääni'), 'fi-sv', 'ett biljud')).toBe(false);
  });

  it('grades the completed classes and corrected extra-beat spelling from the curated cards', () => {
    for (const [fi, answer] of [
      ['etusormi', 'ett pekfinger 2'], ['allergia', 'en allergi 3'],
      ['kaula', 'en hals 2'], ['hoitoaika', 'en vårdtid 3'],
      ['lisälyönti', 'ett extra slag 5'],
      ['kohtu', 'en livmoder 2'], ['välikorva', 'ett mellanöra 4'],
    ]) {
      const term = examTestTerms.find((candidate) => candidate.fiAnswers.includes(fi!))!;
      expect(term, fi).toBeDefined();
      expect(isExamTestAnswerCorrect(term, 'fi-sv', answer!), fi).toBe(true);
      expect(scoreExamTestAnswer(term, 'fi-sv', answer!.replace(/\s+[1-5]\b/u, '')).points, fi).toBe(1);
    }
    expect(isExamTestAnswerCorrect(findTerm('lisälyönti'), 'fi-sv', 'ett exrtra slag 5')).toBe(false);
  });

  it('keeps expanded alternatives and their classes usable in the written exam', () => {
    const answers = examTestTerms.flatMap((term) => term.svAnswers);
    expect(answers).toEqual(expect.arrayContaining([
      'en urinvägsinfektion 3', 'en urinvägsinflammation 3',
      'hjärtat slår hårdare', 'hjärtat slår snabbare', 'vara pensionär',
    ]));
    for (const term of examTestTerms) {
      for (const answer of term.svAnswers) {
        expect(scoreExamTestAnswer(term, 'fi-sv', answer).points, answer).toBe(2);
      }
    }
  });

  it('does not require a redundant class when the card supplies the inflected forms', () => {
    for (const [fi, answer] of [
      ['silmä', 'ett öga'], ['korva', 'ett öra'],
      ['sormi', 'ett finger'],
      ['munasarja', 'ett ovarium'],
      ['olla jnkn lääkärin hoidossa', 'gå hos någon läkare'],
    ]) {
      const term = examTestTerms.find((candidate) => candidate.fiAnswers.includes(fi!))!;
      expect(term.svAnswers, fi).toContain(answer);
      expect(scoreExamTestAnswer(term, 'fi-sv', answer!), fi).toMatchObject({ points: 2, classMaximum: 0 });
    }
    expect(findTerm('munasarja').svAnswers).toContain('en äggstock 2');
  });

  it('removes newly added phrase classes while keeping the original class requirements', () => {
    for (const [fi, answer] of [
      ['lähettävä lääkäri', 'remitterande läkare'],
      ['oikea eteinen', 'höger förmak'],
      ['lievittää kipuja', 'lindra smärtor'],
    ]) {
      const term = examTestTerms.find((candidate) => candidate.fiAnswers.includes(fi!))!;
      expect(term.svAnswers, fi).toContain(answer);
      expect(scoreExamTestAnswer(term, 'fi-sv', answer!), fi).toMatchObject({ points: 2, classMaximum: 0 });
    }
    for (const [fi, answer] of [
      ['hammas', 'en tand 3'], ['jalkaterä', 'en fot 3'],
      ['lisälyönti', 'ett extra slag 5'], ['säteillä', 'stråla I ut'],
    ]) {
      const term = examTestTerms.find((candidate) => candidate.fiAnswers.includes(fi!))!;
      expect(term.svAnswers, fi).toContain(answer);
      expect(scoreExamTestAnswer(term, 'fi-sv', answer!), fi).toMatchObject({ points: 2, classMaximum: 1 });
    }
  });

  it('awards one point each for the term and listed class, independently, to a maximum of two', () => {
    const head = findTerm('pää');
    expect(scoreExamTestAnswer(head, 'fi-sv', 'ett huvud 5')).toMatchObject({ points: 2, termPoints: 1, classPoints: 1 });
    for (const answer of ['ett huvud', 'ett huvud 4', 'ett huvud 6', 'ett huvud IV']) {
      expect(scoreExamTestAnswer(head, 'fi-sv', answer)).toMatchObject({ points: 1, termPoints: 1, classPoints: 0 });
    }
    for (const answer of ['huvud 5', 'en huvud 5', 'ett huvudd 5']) {
      expect(scoreExamTestAnswer(head, 'fi-sv', answer)).toMatchObject({ points: 1, termPoints: 0, classPoints: 1 });
    }
    expect(scoreExamTestAnswer(head, 'fi-sv', 'en huvud 4').points).toBe(0);
    expect(scoreExamTestAnswer(head, 'fi-sv', 'fel 1 2 3 4 5').points).toBe(0);
    expect(scoreExamTestAnswer(findTerm('leuka'), 'fi-sv', 'en haka 2').points).toBe(1);
    expect(scoreExamTestAnswer(findTerm('lievittää'), 'fi-sv', 'lindra ii')).toMatchObject({ points: 1, termPoints: 1, classPoints: 0 });
    expect(scoreExamTestAnswer(findTerm('vaihtaa X jhkn'), 'fi-sv', 'sätta II X till ngt')).toMatchObject({ points: 1, termPoints: 0, classPoints: 1 });
  });

  it('awards two points for translations and source answers without a listed class', () => {
    expect(scoreExamTestAnswer(findTerm('pää'), 'sv-fi', 'pää')).toMatchObject({ points: 2, termMaximum: 2, classMaximum: 0 });
    expect(scoreExamTestAnswer(findTerm('pää'), 'sv-fi', 'pahasti väärin').points).toBe(0);
    expect(scoreExamTestAnswer(findTerm('hengenahdistus'), 'fi-sv', 'en andnöd')).toMatchObject({ points: 2, termMaximum: 2, classMaximum: 0 });
    expect(scoreExamTestAnswer(findTerm('hengenahdistus'), 'fi-sv', 'en andnot').points).toBe(0);
    expect(scoreExamTestAnswer(findTerm('levossa'), 'fi-sv', 'i vila').points).toBe(2);
  });

  it('keeps every source topic and merges only overlapping meanings for a non-repeating pool', () => {
    expect(examTestTerms.length).toBeGreaterThan(400);
    expect(new Set(examTestTerms.map((term) => term.id)).size).toBe(examTestTerms.length);
    expect(examTestTerms.every((term) => term.fiAnswers.length > 0 && term.svAnswers.length > 0)).toBe(true);
    expect(examTestTerms.every((term) => term.fiAnswers.every(Boolean) && term.svAnswers.every(Boolean))).toBe(true);
    for (const topic of examTopics) expect(examTestTerms.some((term) => term.topicIds.includes(topic.id))).toBe(true);
    expect(findTerm('sivuääni').topicIds).toEqual(['tentti-sairaudet', 'tentti-sydansairaudet', 'tentti-tutkiminen']);
  });
});

describe('fifty-question exam session', () => {
  it('draws 25 distinct terms in each direction with all six lists represented in both sections', () => {
    for (let seed = 0; seed < 40; seed++) {
      const session = createExamTest(examTestTerms, `exam-${seed}`, 1000, seededRandom(seed));
      expect(session.questions).toHaveLength(50);
      expect(new Set(session.questions.map((question) => question.termId)).size).toBe(50);
      expect(session.questions.slice(0, 25).every((question) => question.direction === 'fi-sv')).toBe(true);
      expect(session.questions.slice(25).every((question) => question.direction === 'sv-fi')).toBe(true);
      for (const section of [session.questions.slice(0, 25), session.questions.slice(25)]) {
        for (const topic of examTopics) expect(section.some((question) => termsById.get(question.termId)!.topicIds.includes(topic.id))).toBe(true);
      }
      expect(isStoredExamTest(session, termsById, `exam-${seed}`)).toBe(true);
    }
    expect(createExamTest(examTestTerms, 'exam', 1000, seededRandom(1)).questions).not.toEqual(createExamTest(examTestTerms, 'exam', 1000, seededRandom(2)).questions);
  });

  it('persists answers and permits edits across the language boundary without resampling', () => {
    let session = createExamTest(examTestTerms, 'exam', 1000, seededRandom(2));
    const questions = structuredClone(session.questions);
    session = moveExamTest(session, 24);
    session = updateExamTestAnswer(session, 'ett huvud 5');
    session = moveExamTest(session, 25);
    session = updateExamTestAnswer(session, 'pää');
    session = moveExamTest(session, 24);
    expect(session.answers[24]).toBe('ett huvud 5');
    expect(session.answers[25]).toBe('pää');
    expect(session.questions).toEqual(questions);
    expect(isStoredExamTest(JSON.parse(JSON.stringify(session)), termsById, 'exam')).toBe(true);
    expect(moveExamTest(session, -1)).toBe(session);
    expect(moveExamTest(session, 50)).toBe(session);
  });

  it('grades both sections, counts empty answers as errors and freezes a submitted exam', () => {
    let session = createExamTest(examTestTerms, 'exam', 1000, seededRandom(3));
    session.answers = session.questions.map((question) => {
      const term = termsById.get(question.termId)!;
      return (question.direction === 'fi-sv' ? term.svAnswers : term.fiAnswers)[0]!;
    });
    expect(gradeExamTest(session, termsById)).toMatchObject({ total: 100, swedish: 50, finnish: 50 });
    session.answers[0] = 'väärä'; session.answers[25] = '';
    session = submitExamTest(session, 121000);
    const grade = gradeExamTest(session, termsById);
    expect(grade.total).toBe(96); expect(grade.swedish).toBe(48); expect(grade.finnish).toBe(48);
    expect(session.completedAt).toBe(121000);
    expect(updateExamTestAnswer(session, 'muutos')).toBe(session);
    expect(moveExamTest(session, 10)).toBe(session);
    expect(submitExamTest(session, 900000)).toBe(session);
    expect(isStoredExamTest(session, termsById, 'exam')).toBe(true);
  });

  it('rejects malformed, unknown, duplicate and incorrectly balanced stored exams', () => {
    const session = createExamTest(examTestTerms, 'exam', 1000, seededRandom(5));
    for (const invalid of [null, [], {}, { ...session, sessionId: 'another' }, { ...session, currentIndex: 50 },
      { ...session, startedAt: '1000' }, { ...session, completedAt: 999 }, { ...session, answers: Array(49).fill('') },
      { ...session, answers: Array(50).fill(null) }, { ...session, answers: Array(50).fill('x'.repeat(501)) },
      { ...session, questions: session.questions.map((question) => ({ ...question, direction: 'fi-sv' })) },
      { ...session, questions: [session.questions[0], ...session.questions.slice(0, 49)] },
      { ...session, questions: session.questions.map((question) => ({ ...question, termId: 'unknown' })) },
    ]) expect(isStoredExamTest(invalid, termsById, 'exam')).toBe(false);
  });
});
