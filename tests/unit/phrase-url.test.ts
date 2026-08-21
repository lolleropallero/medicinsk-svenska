import { describe, expect, it } from 'vitest';
import { buildPhraseSessionUrl, parsePhraseRequest } from '../../src/lib/phrase-url';

const categories = new Set(['oireet-vointi']);
describe('phrase session URLs', () => {
  it('parses all and category configurations', () => {
    expect(parsePhraseRequest('?mode=all&amount=10', categories)).toEqual({ ok: true, value: { mode: 'all', requestedAmount: 10, sessionId: null } });
    expect(parsePhraseRequest('?mode=category&category=oireet-vointi&amount=25&session=test-1', categories)).toEqual({
      ok: true, value: { mode: 'category', sourceCategoryId: 'oireet-vointi', requestedAmount: 25, sessionId: 'test-1' },
    });
  });
  it.each([
    '?mode=unknown&amount=10', '?mode=all&amount=50', '?mode=category&amount=10',
    '?mode=category&category=missing&amount=10', '?mode=all&category=oireet-vointi&amount=10',
    '?mode=all&amount=10&session=%20',
  ])('fails closed for %s', (search) => expect(parsePhraseRequest(search, categories)).toEqual({ ok: false }));
  it('builds a canonical category URL', () => {
    expect(buildPhraseSessionUrl({ sessionId: 's1', mode: 'category', sourceCategoryId: 'oireet-vointi', requestedAmount: 'all' }))
      .toBe('/fraasit/harjoitus?mode=category&amount=all&session=s1&category=oireet-vointi');
  });
});
