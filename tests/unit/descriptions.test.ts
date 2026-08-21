import { describe, expect, it } from 'vitest';
import { isAcceptedAnswer, normalizeAnswer } from '../../src/lib/descriptions';
import type { DescriptionExerciseClient } from '../../src/types/content';
const item: DescriptionExerciseClient={id:'d',categoryId:'c',descriptionSv:'Vad?',answerSv:'njure',acceptedInflections:['njuren']};
describe('description answers',()=>{
  it('ignores case, surrounding whitespace, and ordinary punctuation',()=>expect(normalizeAnswer('  NJURE! ')).toBe('njure'));
  it('accepts the canonical answer and listed inflections',()=>{expect(isAcceptedAnswer(item,'Njure.')).toBe(true);expect(isAcceptedAnswer(item,'njuren')).toBe(true)});
  it('rejects synonyms and unrelated words',()=>expect(isAcceptedAnswer(item,'organ')).toBe(false));
  it('accepts the optional correct indefinite article with the lemma only',()=>{
    const noun={...item,answerSv:'hjärta',acceptedInflections:['hjärtat'],article:'ett' as const};
    expect(isAcceptedAnswer(noun,'hjärta')).toBe(true);
    expect(isAcceptedAnswer(noun,'ett hjärta')).toBe(true);
    expect(isAcceptedAnswer(noun,'hjärtat')).toBe(true);
    expect(isAcceptedAnswer(noun,'en hjärta')).toBe(false);
    expect(isAcceptedAnswer(noun,'ett hjärtat')).toBe(false);
  });
  it('normalizes canonically equivalent Unicode',()=>expect(normalizeAnswer('NA\u0308THINNA')).toBe('näthinna'));
});
