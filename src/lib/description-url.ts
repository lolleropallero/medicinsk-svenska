import {
  isReasonableDescriptionSessionId,
  type DescriptionRequestedAmount,
  type DescriptionRoundType,
  type DescriptionSessionConfiguration,
  type DescriptionSourceMode,
} from './description-session';

export type ParsedDescriptionRequest = Omit<DescriptionSessionConfiguration, 'sessionId'> & { sessionId: string | null };
export type DescriptionRequestResult = { ok: true; value: ParsedDescriptionRequest } | { ok: false };

function parseAmount(value: string | null): DescriptionRequestedAmount | null {
  if (value === '10' || value === '25' || value === '50') return Number(value) as 10 | 25 | 50;
  return value === 'all' ? 'all' : null;
}

export function parseDescriptionRequest(search: string, validCategoryIds: ReadonlySet<string>): DescriptionRequestResult {
  const params = new URLSearchParams(search);
  const sourceMode = params.get('mode') as DescriptionSourceMode | null;
  const requestedAmount = parseAmount(params.get('amount'));
  const category = params.get('category');
  const roundType = (params.get('round') ?? 'initial') as DescriptionRoundType;
  const sessionId = params.get('session');
  if (
    (sourceMode !== 'all' && sourceMode !== 'category') ||
    requestedAmount === null ||
    (roundType !== 'initial' && roundType !== 'retry') ||
    (params.has('session') && !isReasonableDescriptionSessionId(sessionId)) ||
    (roundType === 'retry' && !sessionId)
  ) return { ok: false };
  if (sourceMode === 'category') {
    if (!category || !validCategoryIds.has(category)) return { ok: false };
    return { ok: true, value: { sourceMode, sourceCategoryId: category, requestedAmount, roundType, sessionId } };
  }
  if (params.has('category')) return { ok: false };
  return { ok: true, value: { sourceMode, requestedAmount, roundType, sessionId } };
}

export function buildDescriptionSessionUrl(
  configuration: DescriptionSessionConfiguration,
  pathname = '/kuvailu/harjoitus',
): string {
  const params = new URLSearchParams({
    mode: configuration.sourceMode,
    amount: String(configuration.requestedAmount),
    session: configuration.sessionId,
  });
  if (configuration.sourceMode === 'category' && configuration.sourceCategoryId) {
    params.set('category', configuration.sourceCategoryId);
  }
  if (configuration.roundType === 'retry') params.set('round', 'retry');
  return `${pathname}?${params.toString()}`;
}
