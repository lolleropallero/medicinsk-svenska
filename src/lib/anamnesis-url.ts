import { isReasonableAnamnesisSessionId, type AnamnesisSessionConfiguration } from './anamnesis-session';

export type ParsedAnamnesisRequest = Omit<AnamnesisSessionConfiguration, 'sessionId'> & { sessionId: string | null };
export type AnamnesisRequestResult = { ok: true; value: ParsedAnamnesisRequest } | { ok: false };

export function parseAnamnesisRequest(search: string, validCaseIds: ReadonlySet<string>): AnamnesisRequestResult {
  const params = new URLSearchParams(search);
  const caseId = params.get('case');
  const sessionId = params.get('session');
  if (!caseId || !validCaseIds.has(caseId)) return { ok: false };
  if (params.has('session') && !isReasonableAnamnesisSessionId(sessionId)) return { ok: false };
  return { ok: true, value: { caseId, sessionId } };
}

export function buildAnamnesisSessionUrl(configuration: AnamnesisSessionConfiguration, pathname = '/tilanteet/harjoitus'): string {
  const params = new URLSearchParams({ case: configuration.caseId, session: configuration.sessionId });
  return `${pathname}?${params.toString()}`;
}
