// Separate validation keeps the curated medical collection and its rules unchanged.
export function validateEverydayContent(input: unknown): string[] {
  const errors: string[] = [];
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim() === value && value.length > 0;
  const entryKeys = new Set(['id', 'fi', 'sv', 'partOfSpeech', 'article', 'inflectionClass', 'inflection']);
  const parts = new Set(['noun', 'verb', 'adjective', 'adverb', 'other']);
  const topicIds = new Set<string>();
  const cardIds = new Set<string>();
  const finnish = new Set<string>();
  const swedish = new Set<string>();
  let total = 0;
  if (!Array.isArray(input) || input.length !== 20) return ['Arkisanasto must contain 20 topic decks'];
  for (const topic of input) {
    if (!record(topic) || !nonempty(topic.id) || !/^arki-[a-z]+(?:-[a-z]+)*$/u.test(topic.id) || !nonempty(topic.nameFi)) {
      errors.push('invalid everyday topic'); continue;
    }
    if (Object.keys(topic).some(key => !['id', 'nameFi', 'entries'].includes(key))) errors.push(`unknown everyday topic field: ${topic.id}`);
    if (topicIds.has(topic.id)) errors.push(`duplicate everyday topic: ${topic.id}`);
    topicIds.add(topic.id);
    if (!Array.isArray(topic.entries)) { errors.push(`missing everyday cards: ${topic.id}`); continue; }
    if (topic.entries.length !== 25) errors.push(`everyday deck must contain 25 cards: ${topic.id}`);
    for (const entry of topic.entries) {
      total++;
      if (!record(entry) || !nonempty(entry.id) || !nonempty(entry.fi) || !nonempty(entry.sv)) {
        errors.push(`invalid everyday entry: ${topic.id}`); continue;
      }
      const id = entry.id;
      if (Object.keys(entry).some(key => !entryKeys.has(key))) errors.push(`unknown everyday entry field: ${id}`);
      if (!id.startsWith(`${topic.id}-`) || !/^arki-[a-z]+(?:-[a-z]+)*$/u.test(id) || cardIds.has(id)) errors.push(`invalid or duplicate everyday ID: ${id}`);
      cardIds.add(id);
      for (const [term, seen, language] of [[entry.fi, finnish, 'fi'], [entry.sv, swedish, 'sv']] as const) {
        const normalized = term.normalize('NFC').toLocaleLowerCase(language);
        if (seen.has(normalized)) errors.push(`duplicate everyday ${language} term: ${term}`);
        seen.add(normalized);
        if (/[<>\n\r/;]|\s{2}/u.test(term)) errors.push(`malformed everyday term: ${id}`);
      }
      if (/^(en|ett)\s|\b(?:[1-5]|I{1,3}|IV)\b/u.test(entry.sv)) errors.push(`grammar embedded in everyday term: ${id}`);
      if (!parts.has(String(entry.partOfSpeech))) errors.push(`invalid everyday part of speech: ${id}`);
      const cls = entry.inflectionClass;
      if (entry.partOfSpeech === 'noun') {
        if (!['en', 'ett'].includes(String(entry.article))) errors.push(`everyday noun needs article: ${id}`);
        if (cls !== undefined && !/^[1-5]$/u.test(String(cls))) errors.push(`invalid everyday noun class: ${id}`);
        if (cls === undefined && !nonempty(entry.inflection)) errors.push(`everyday noun needs class or explicit exception: ${id}`);
      } else {
        if (entry.article !== undefined) errors.push(`article on everyday non-noun: ${id}`);
        if (entry.partOfSpeech === 'verb') {
          if (!/^(I|II|III|IV)$/u.test(String(cls))) errors.push(`everyday verb needs class: ${id}`);
          if (!nonempty(entry.inflection)) errors.push(`everyday verb needs principal forms: ${id}`);
        } else if (cls !== undefined) errors.push(`class on everyday non-noun/verb: ${id}`);
      }
      if (entry.inflection !== undefined && (!nonempty(entry.inflection) || /[<>\n\r]/u.test(entry.inflection))) errors.push(`invalid everyday inflection: ${id}`);
    }
  }
  if (total !== 500) errors.push(`Arkisanasto must contain exactly 500 cards, found ${total}`);
  return errors;
}
