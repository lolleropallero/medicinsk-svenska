import { describe, expect, it } from 'vitest';
import { buildSessionUrl, parseSessionRequest } from '../../src/lib/session-url';

const decks = new Set(['anatomi', 'mediciner']);

describe('session URL configuration', () => {
  it('parses a deck request and builds a complete reusable URL', () => {
    const parsed = parseSessionRequest('?mode=deck&deck=anatomi&direction=sv-fi&amount=10&session=readable-1', decks);
    expect(parsed).toEqual({ ok: true, value: {
      mode: 'deck', answerMode: 'cards', sourceDeckId: 'anatomi', direction: 'sv-fi', requestedAmount: 10, sessionId: 'readable-1',
    } });
    if (parsed.ok && parsed.value.sessionId) {
      expect(buildSessionUrl(parsed.value as Parameters<typeof buildSessionUrl>[0])).toBe('/kortit/harjoitus?mode=deck&answer=cards&direction=sv-fi&amount=10&session=readable-1&deck=anatomi');
    }
  });

  it('allows a missing session ID for recoverable URL replacement', () => {
    expect(parseSessionRequest('?mode=lucky&answer=written&direction=fi-sv&amount=all', decks)).toEqual({
      ok: true,
      value: { mode: 'lucky', answerMode: 'written', direction: 'fi-sv', requestedAmount: 'all', sessionId: null },
    });
  });

  it.each([
    '?mode=deck&direction=fi-sv&amount=10&session=x',
    '?mode=deck&deck=unknown&direction=fi-sv&amount=10&session=x',
    '?mode=lucky&deck=anatomi&direction=fi-sv&amount=10&session=x',
    '?mode=deck&deck=anatomi&direction=invalid&amount=10&session=x',
    '?mode=deck&deck=anatomi&direction=fi-sv&amount=12&session=x',
    '?mode=deck&answer=invalid&deck=anatomi&direction=fi-sv&amount=10&session=x',
    '?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=',
    `?mode=deck&deck=anatomi&direction=fi-sv&amount=10&session=${'x'.repeat(129)}`,
  ])('fails closed for malformed request %s', (search) => {
    expect(parseSessionRequest(search, decks)).toEqual({ ok: false });
  });
});
