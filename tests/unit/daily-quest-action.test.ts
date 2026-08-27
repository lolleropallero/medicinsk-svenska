import { describe, expect, it } from 'vitest';
import { resolveDailyQuestAction, type QuestActionContext } from '../../src/lib/progress/daily-quest-action';
import type { ExerciseMode, Quest, QuestKind } from '../../src/lib/progress/types';
import type { VocabularyAnswerMode } from '../../src/lib/session';

const quest = (kind:QuestKind, mode?:ExerciseMode, claimed=false, answerMode?:VocabularyAnswerMode):Quest => ({
  id:`q-${kind}-${mode??'any'}`,slot:1,kind,...(mode?{mode}:{}),target:kind==='active'?300_000:10,
  ...(answerMode?{answerMode}:{}),xp:5,credits:10,seasonPoints:10,rerollIndex:0,claimed,
});
const base:QuestActionContext={
  modesUsedToday:[],sessions:{},freshUrls:{flashcards:'/fresh/cards',phrases:'/fresh/phrases',descriptions:'/fresh/descriptions',clinical:'/fresh/clinical'},
  freshFlashcardUrls:{cards:'/fresh/cards',choice:'/fresh/choice',written:'/fresh/written'},
};

describe('daily quest direct action resolver',()=>{
  it.each([
    ['flashcards','/fresh/cards'],['phrases','/fresh/phrases'],['descriptions','/fresh/descriptions'],
  ] as const)('routes a %s quest directly to that exercise', (mode,href)=>{
    expect(resolveDailyQuestAction(quest('mode',mode),base)).toMatchObject({mode,href,resumesSession:false});
  });

  it('resumes a valid mode-specific session',()=>{
    const context={...base,sessions:{phrases:{href:'/resume/phrases',startedAt:20}}};
    expect(resolveDailyQuestAction(quest('mode','phrases'),context)).toEqual({mode:'phrases',href:'/resume/phrases',resumesSession:true});
  });

  it('starts the daily vocabulary answer mode instead of inheriting another stored flashcard mode',()=>{
    const context={...base,sessions:{flashcards:{href:'/resume/cards',startedAt:20,answerMode:'cards' as const}}};
    expect(resolveDailyQuestAction(quest('mode','flashcards',false,'choice'),context)).toEqual({mode:'flashcards',href:'/fresh/choice',resumesSession:false});
    expect(resolveDailyQuestAction(quest('mode','flashcards',false,'cards'),context)).toEqual({mode:'flashcards',href:'/resume/cards',resumesSession:true});
  });

  it('uses the last-mode session for generic items, otherwise falls back to fresh lucky flashcards',()=>{
    expect(resolveDailyQuestAction(quest('items'),{...base,lastUsedMode:'descriptions',sessions:{descriptions:{href:'/resume/descriptions',startedAt:1}}})).toMatchObject({mode:'descriptions',resumesSession:true});
    expect(resolveDailyQuestAction(quest('items'),{...base,lastUsedMode:'phrases'})).toMatchObject({mode:'flashcards',href:'/fresh/cards',resumesSession:false});
    expect(resolveDailyQuestAction(quest('items',undefined,false,'written'),{...base,lastUsedMode:'phrases'})).toMatchObject({mode:'flashcards',href:'/fresh/written',resumesSession:false});
  });

  it('uses the most recent active session for active study and falls back to last mode',()=>{
    const sessions={flashcards:{href:'/old',startedAt:10},descriptions:{href:'/new',startedAt:30}};
    expect(resolveDailyQuestAction(quest('active'),{...base,lastUsedMode:'phrases',sessions})).toMatchObject({mode:'descriptions',href:'/new',resumesSession:true});
    expect(resolveDailyQuestAction(quest('active'),{...base,lastUsedMode:'phrases'})).toMatchObject({mode:'phrases',href:'/fresh/phrases'});
    expect(resolveDailyQuestAction(quest('active',undefined,false,'choice'),{...base})).toMatchObject({mode:'flashcards',href:'/fresh/choice'});
  });

  it('selects an unused mode for variety and prefers its resumable session',()=>{
    const context={...base,modesUsedToday:['flashcards'] as ExerciseMode[],sessions:{descriptions:{href:'/resume/descriptions',startedAt:2}}};
    expect(resolveDailyQuestAction(quest('variety'),context)).toMatchObject({mode:'descriptions',resumesSession:true});
    expect(resolveDailyQuestAction(quest('variety'),{...base,modesUsedToday:['flashcards','phrases']})).toMatchObject({mode:'descriptions',href:'/fresh/descriptions'});
  });

  it('prefers a valid flashcard or phrase session for retries without fabricating progress',()=>{
    const context={...base,lastUsedMode:'descriptions' as const,sessions:{phrases:{href:'/resume/phrases',startedAt:2}}};
    expect(resolveDailyQuestAction(quest('retries'),context)).toMatchObject({mode:'phrases',resumesSession:true});
    expect(resolveDailyQuestAction(quest('retries'),base)).toMatchObject({mode:'flashcards',href:'/fresh/cards',resumesSession:false});
  });

  it('resumes or starts the last-used mode for session completion',()=>{
    expect(resolveDailyQuestAction(quest('sessions'),{...base,lastUsedMode:'phrases',sessions:{phrases:{href:'/resume/phrases',startedAt:2}}})).toMatchObject({mode:'phrases',resumesSession:true});
    expect(resolveDailyQuestAction(quest('sessions'),{...base,lastUsedMode:'descriptions'})).toMatchObject({mode:'descriptions',href:'/fresh/descriptions'});
  });

  it('does not restart a completed quest',()=>expect(resolveDailyQuestAction(quest('items',undefined,true),base)).toBeNull());

  it('routes active-study and session-completion quests to a resumable clinical session when it was last used',()=>{
    const sessions={clinical:{href:'/resume/clinical',startedAt:5}};
    expect(resolveDailyQuestAction(quest('active'),{...base,lastUsedMode:'clinical',sessions})).toEqual({mode:'clinical',href:'/resume/clinical',resumesSession:true});
    expect(resolveDailyQuestAction(quest('sessions'),{...base,lastUsedMode:'clinical',sessions})).toEqual({mode:'clinical',href:'/resume/clinical',resumesSession:true});
  });

  it('falls back to a fresh clinical session when it was last used but nothing is resumable',()=>{
    const context={...base,freshUrls:{...base.freshUrls,clinical:'/fresh/clinical'},lastUsedMode:'clinical' as const};
    expect(resolveDailyQuestAction(quest('active'),context)).toEqual({mode:'clinical',href:'/fresh/clinical',resumesSession:false});
    expect(resolveDailyQuestAction(quest('sessions'),context)).toEqual({mode:'clinical',href:'/fresh/clinical',resumesSession:false});
  });

  it('never selects clinical for variety, retries, or generic items quests, which stay scoped to the three vocabulary modes',()=>{
    expect(resolveDailyQuestAction(quest('variety'),{...base,modesUsedToday:['flashcards','phrases','descriptions'] as const})).toMatchObject({mode:'flashcards'});
    expect(resolveDailyQuestAction(quest('retries'),{...base,lastUsedMode:'clinical'})).toMatchObject({mode:'flashcards'});
    expect(resolveDailyQuestAction(quest('items'),{...base,lastUsedMode:'clinical'})).toMatchObject({mode:'flashcards',href:'/fresh/cards'});
  });
});
