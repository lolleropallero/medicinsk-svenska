import {
  isReasonablePhraseSessionId,
  type PhraseRequestedAmount,
  type PhraseSessionConfiguration,
  type PhraseSessionMode,
} from './phrase-session';

export type ParsedPhraseRequest = Omit<PhraseSessionConfiguration, 'sessionId'> & { sessionId: string | null };
export type PhraseRequestResult = { ok: true; value: ParsedPhraseRequest } | { ok: false };

function parseAmount(value: string | null): PhraseRequestedAmount | null {
  if (value === '10' || value === '25') return Number(value) as 10 | 25;
  return value === 'all' ? 'all' : null;
}

export function parsePhraseRequest(search: string, validCategoryIds: ReadonlySet<string>): PhraseRequestResult {
  const params = new URLSearchParams(search);
  const mode = params.get('mode') as PhraseSessionMode | null;
  const requestedAmount = parseAmount(params.get('amount'));
  const category = params.get('category');
  const sessionId = params.get('session');
  if ((mode !== 'all' && mode !== 'category') || requestedAmount === null ||
      (params.has('session') && !isReasonablePhraseSessionId(sessionId))) return { ok: false };
  if (mode === 'category') {
    if (!category || !validCategoryIds.has(category)) return { ok: false };
    return { ok: true, value: { mode, sourceCategoryId: category, requestedAmount, sessionId } };
  }
  if (params.has('category')) return { ok: false };
  return { ok: true, value: { mode, requestedAmount, sessionId } };
}

export function buildPhraseSessionUrl(configuration: PhraseSessionConfiguration, pathname = '/fraasit/harjoitus'): string {
  const params = new URLSearchParams({
    mode: configuration.mode,
    amount: String(configuration.requestedAmount),
    session: configuration.sessionId,
  });
  if (configuration.mode === 'category' && configuration.sourceCategoryId) params.set('category', configuration.sourceCategoryId);
  return `${pathname}?${params.toString()}`;
}
