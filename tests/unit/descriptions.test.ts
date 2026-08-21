import { describe, expect, it } from 'vitest';
import { isAcceptedAnswer, normalizeAnswer } from '../../src/lib/descriptions';
import type { DescriptionExerciseClient } from '../../src/types/content';
const item: DescriptionExerciseClient={id:'d',descriptionSv:'Vad?',answerSv:'njure',acceptedInflections:['njuren']};
describe('description answers',()=>{
  it('ignores case, surrounding whitespace, and ordinary punctuation',()=>expect(normalizeAnswer('  NJURE! ')).toBe('njure'));
  it('accepts the canonical answer and listed inflections',()=>{expect(isAcceptedAnswer(item,'Njure.')).toBe(true);expect(isAcceptedAnswer(item,'njuren')).toBe(true)});
  it('rejects synonyms and unrelated words',()=>expect(isAcceptedAnswer(item,'organ')).toBe(false));
});
