import { describe, expect, it } from 'vitest';
import { buildClinicalSessionUrl, parseClinicalRequest } from '../../src/lib/clinical-url';

const categories = new Set(['kipu']);
describe('clinical scenario session URLs', () => {
  it('parses all and category configurations', () => {
    expect(parseClinicalRequest('?mode=all&amount=5', categories)).toEqual({ ok: true, value: { mode: 'all', requestedAmount: 5, sessionId: null } });
    expect(parseClinicalRequest('?mode=category&category=kipu&amount=10&session=test-1', categories)).toEqual({
      ok: true, value: { mode: 'category', sourceCategoryId: 'kipu', requestedAmount: 10, sessionId: 'test-1' },
    });
  });
  it.each([
    '?mode=unknown&amount=5', '?mode=all&amount=25', '?mode=category&amount=5',
    '?mode=category&category=missing&amount=5', '?mode=all&category=kipu&amount=5',
    '?mode=all&amount=5&session=%20',
  ])('fails closed for %s', (search) => expect(parseClinicalRequest(search, categories)).toEqual({ ok: false }));
  it('builds a canonical category URL', () => {
    expect(buildClinicalSessionUrl({ sessionId: 's1', mode: 'category', sourceCategoryId: 'kipu', requestedAmount: 'all' }))
      .toBe('/tilanteet/harjoitus?mode=category&amount=all&session=s1&category=kipu');
  });
  it('builds a canonical all-mode URL', () => {
    expect(buildClinicalSessionUrl({ sessionId: 's2', mode: 'all', requestedAmount: 10 }))
      .toBe('/tilanteet/harjoitus?mode=all&amount=10&session=s2');
  });
});
