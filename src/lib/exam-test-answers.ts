export function normalizeExamAnswer(value: string): string {
  return value.normalize('NFC').trim().toLocaleLowerCase('sv')
    .replace(/[’‘]/gu, "'").replace(/\s*([,;])\s*/gu, '$1')
    .replace(/\s*\/\s*/gu, ' / ').replace(/\s+/gu, ' ').replace(/[.!?]+$/u, '').trim();
}

function withoutNotes(value: string): string {
  return value.replace(/\([^)]*\)/gu, '').replace(/\s+/gu, ' ').trim();
}

function optionalLetters(value: string): string[] {
  const match = value.match(/\(([\p{L}])\)/u);
  if (!match) return [value];
  return [value.replace(match[0], match[1]!), value.replace(match[0], '')].flatMap(optionalLetters);
}

export function finnishExamAnswers(value: string): string[] {
  return [...new Set(withoutNotes(value).split(/\s*[/;,]\s*/u).map((part) => part.trim()).filter(Boolean))];
}

// This converts notation already present in the course lists; it never supplies a missing class.
export function swedishExamAnswers(value: string): string[] {
  const optionalArticle = value.match(/^\((en|ett)\)\s+(.+)$/u);
  if (optionalArticle) return [optionalArticle[2]!, ...swedishExamAnswers(`${optionalArticle[1]} ${optionalArticle[2]}`)];
  const expanded = optionalLetters(value).map(withoutNotes);
  return [...new Set(expanded.flatMap((form) => {
    // Slash within a marked stem (ovari/um, förlam/ad) joins the stem; spaced slashes separate alternatives.
    const joined = form.replace(/([\p{L}])\/([\p{L}])/gu, '$1$2');
    const alternatives = joined.split(/\s+\/\s*|\s*\/\s+|\s*;\s*/u);
    return alternatives.flatMap((alternative) => {
      // Commas after explicit noun articles introduce inflections, not synonyms (öga, ögon).
      const parts = /^(?:en|ett|et)\s/u.test(alternative)
        ? [alternative]
        : alternative.split(/,\s*(?!-)(?=[\p{L}])/u);
      return parts.map((part) => {
        const [head = '', ...grammar] = part.split(',');
        const tail = grammar.join(',').trim();
        const gender = tail.match(/^-(en|et|n|t)\b/u)?.[1];
        const nounClass = tail.match(/\b([1-5])\b/u)?.[1];
        let answer = head.trim().replace(/^et\s/u, 'ett ');
        if (!/^(?:en|ett)\s/u.test(answer) && gender) answer = `${gender === 'et' || gender === 't' ? 'ett' : 'en'} ${answer}`;
        if (nounClass && !/\b[1-5]\b/u.test(answer)) answer += ` ${nounClass}`;
        return answer.replace(/\*/gu, '').replace(/\s+/gu, ' ').trim();
      });
    });
  }).filter(Boolean))];
}

export function swedishLexicalKey(answer: string): string {
  // Lower-case i is a preposition, while upper-case I denotes a listed verb class.
  return normalizeExamAnswer(answer.replace(/\b(?:[1-5]|I{1,3}|IV)\b/gu, ''))
    .replace(/^(?:en|ett)\s/u, '').replace(/\s+/gu, ' ').trim();
}

export function requireListedClasses(answers: readonly string[]): string[] {
  const withClass = new Set(answers.filter((answer) => /\b(?:[1-5]|I{1,3}|IV)\b/u.test(answer)).map(swedishLexicalKey));
  return [...new Map(answers.filter((answer) =>
    /\b(?:[1-5]|I{1,3}|IV)\b/u.test(answer) || !withClass.has(swedishLexicalKey(answer)),
  ).map((answer) => [normalizeExamAnswer(answer), answer])).values()];
}
