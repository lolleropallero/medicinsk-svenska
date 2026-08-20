import { describe, expect, it } from 'vitest';
import { validateContent } from '../../scripts/validate-content';
import type { Deck, DescriptionExercise, Flashcard } from '../../src/types/content';
const deck: Deck={id:'d',nameFi:'D',descriptionFi:'x',sourceDocument:'x.pdf',status:'published'};
const card: Flashcard={id:'c',deckId:'d',fi:'maksa',sv:'lever',status:'published',source:{document:'x.pdf',page:1}};
const descriptions=Array.from({length:40},(_,i):DescriptionExercise=>({id:`q${i}`,descriptionSv:'Vad beskrivs?',answerSv:'lever',status:'published',source:{document:'x.pdf',page:1,section:'s'}}));
describe('content validation',()=>{
  it('accepts a minimal well-formed set',()=>expect(validateContent([deck],[card],descriptions)).toEqual([]));
  it('rejects duplicate IDs and pairs',()=>{
    const errors=validateContent([deck],[card,{...card}],descriptions);
    expect(errors.some(e=>e.includes('duplicate flashcard ID'))).toBe(true); expect(errors.some(e=>e.includes('duplicate canonical pair'))).toBe(true);
  });
  it('rejects unknown decks, visible alternatives, and missing source data',()=>{
    const bad={...card,id:'bad',deckId:'unknown',sv:'lever / hepar',source:{document:'',page:0}};
    const errors=validateContent([deck],[bad],descriptions.slice(0,2));
    expect(errors.some(e=>e.includes('unknown deck'))).toBe(true); expect(errors.some(e=>e.includes('slash-separated'))).toBe(true);
    expect(errors.some(e=>e.includes('fewer than 40'))).toBe(true);
  });
});
