import type { PartOfSpeech } from '../types/content';

export const PART_OF_SPEECH_LABELS: Record<PartOfSpeech, string> = {
  noun: 'substantiivi',
  verb: 'verbi',
  adjective: 'adjektiivi',
  adverb: 'adverbi',
  other: 'muu',
};

export function partOfSpeechLabel(partOfSpeech: PartOfSpeech): string {
  return PART_OF_SPEECH_LABELS[partOfSpeech];
}
