import { describe, expect, it } from 'vitest';
import { buildDescriptionSessionUrl, parseDescriptionRequest } from '../../src/lib/description-url';
const categories = new Set(['a']);

describe('description URL configuration', () => {
  it('parses all-topics and category URLs and permits a missing initial session ID', () => {
    expect(parseDescriptionRequest('?mode=all&amount=10', categories)).toEqual({ ok: true, value: { sourceMode: 'all', requestedAmount: 10, roundType: 'initial', sessionId: null } });
    expect(parseDescriptionRequest('?mode=category&category=a&amount=all&session=id', categories).ok).toBe(true);
  });
  it.each([
    '?mode=nope&amount=10&session=id',
    '?mode=category&amount=10&session=id',
    '?mode=category&category=missing&amount=10&session=id',
    '?mode=all&category=a&amount=10&session=id',
    '?mode=all&amount=12&session=id',
    '?mode=all&amount=10&session=%20',
    '?mode=all&amount=10&round=retry',
  ])('fails closed for %s', (search) => expect(parseDescriptionRequest(search, categories)).toEqual({ ok: false }));
  it('builds initial and retry URLs without leaking incompatible parameters', () => {
    expect(buildDescriptionSessionUrl({ sessionId: 'id', sourceMode: 'all', requestedAmount: 10, roundType: 'initial' })).toBe('/kuvailu/harjoitus?mode=all&amount=10&session=id');
    expect(buildDescriptionSessionUrl({ sessionId: 'id', sourceMode: 'category', sourceCategoryId: 'a', requestedAmount: 'all', roundType: 'retry' })).toBe('/kuvailu/harjoitus?mode=category&amount=all&session=id&category=a&round=retry');
  });
});
