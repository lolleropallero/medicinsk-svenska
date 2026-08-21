import {
  isReasonableSessionId,
  type CreateSessionOptions,
  type RequestedAmount,
  type SessionMode,
} from './session';
import type { Direction } from '../types/content';

export type ParsedSessionRequest = Omit<CreateSessionOptions, 'sessionId'> & { sessionId: string | null };
export type SessionRequestResult =
  | { ok: true; value: ParsedSessionRequest }
  | { ok: false };

function parseAmount(value: string | null): RequestedAmount | null {
  if (value === '10' || value === '25' || value === '50') return Number(value) as 10 | 25 | 50;
  return value === 'all' ? 'all' : null;
}

export function parseSessionRequest(search: string, validDeckIds: ReadonlySet<string>): SessionRequestResult {
  const params = new URLSearchParams(search);
  const mode = params.get('mode') as SessionMode | null;
  const direction = params.get('direction') as Direction | null;
  const requestedAmount = parseAmount(params.get('amount'));
  const deck = params.get('deck');
  const hasSession = params.has('session');
  const sessionId = params.get('session');

  if (
    (mode !== 'deck' && mode !== 'lucky') ||
    (direction !== 'fi-sv' && direction !== 'sv-fi') ||
    requestedAmount === null ||
    (hasSession && !isReasonableSessionId(sessionId))
  ) return { ok: false };

  if (mode === 'deck') {
    if (!deck || !validDeckIds.has(deck)) return { ok: false };
    return {
      ok: true,
      value: { mode, sourceDeckId: deck, direction, requestedAmount, sessionId },
    };
  }

  if (params.has('deck')) return { ok: false };
  return { ok: true, value: { mode, direction, requestedAmount, sessionId } };
}

export function buildSessionUrl(
  configuration: CreateSessionOptions,
  pathname = '/kortit/harjoitus',
): string {
  const params = new URLSearchParams({
    mode: configuration.mode,
    direction: configuration.direction,
    amount: String(configuration.requestedAmount),
    session: configuration.sessionId,
  });
  if (configuration.mode === 'deck' && configuration.sourceDeckId) {
    params.set('deck', configuration.sourceDeckId);
  }
  return `${pathname}?${params.toString()}`;
}
