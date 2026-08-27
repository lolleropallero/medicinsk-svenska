import {
  isReasonableClinicalSessionId,
  type ClinicalRequestedAmount,
  type ClinicalSessionConfiguration,
  type ClinicalSessionMode,
} from './clinical-session';

export type ParsedClinicalRequest = Omit<ClinicalSessionConfiguration, 'sessionId'> & { sessionId: string | null };
export type ClinicalRequestResult = { ok: true; value: ParsedClinicalRequest } | { ok: false };

function parseAmount(value: string | null): ClinicalRequestedAmount | null {
  if (value === '5' || value === '10') return Number(value) as 5 | 10;
  return value === 'all' ? 'all' : null;
}

export function parseClinicalRequest(search: string, validCategoryIds: ReadonlySet<string>): ClinicalRequestResult {
  const params = new URLSearchParams(search);
  const mode = params.get('mode') as ClinicalSessionMode | null;
  const requestedAmount = parseAmount(params.get('amount'));
  const category = params.get('category');
  const sessionId = params.get('session');
  if ((mode !== 'all' && mode !== 'category') || requestedAmount === null ||
      (params.has('session') && !isReasonableClinicalSessionId(sessionId))) return { ok: false };
  if (mode === 'category') {
    if (!category || !validCategoryIds.has(category)) return { ok: false };
    return { ok: true, value: { mode, sourceCategoryId: category, requestedAmount, sessionId } };
  }
  if (params.has('category')) return { ok: false };
  return { ok: true, value: { mode, requestedAmount, sessionId } };
}

export function buildClinicalSessionUrl(configuration: ClinicalSessionConfiguration, pathname = '/tilanteet/harjoitus'): string {
  const params = new URLSearchParams({
    mode: configuration.mode,
    amount: String(configuration.requestedAmount),
    session: configuration.sessionId,
  });
  if (configuration.mode === 'category' && configuration.sourceCategoryId) params.set('category', configuration.sourceCategoryId);
  return `${pathname}?${params.toString()}`;
}
