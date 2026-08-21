import { describe, expect, it } from 'vitest';
import { PART_OF_SPEECH_LABELS, partOfSpeechLabel } from '../../src/lib/grammar';

describe('Finnish grammar labels', () => {
  it('maps every internal part of speech to Finnish', () => {
    expect(PART_OF_SPEECH_LABELS).toEqual({
      noun: 'substantiivi', verb: 'verbi', adjective: 'adjektiivi', adverb: 'adverbi', other: 'muu',
    });
    expect(partOfSpeechLabel('adjective')).toBe('adjektiivi');
  });
});
