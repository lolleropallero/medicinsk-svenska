import { describe, expect, it } from 'vitest';
import { buildAnamnesisSessionUrl, parseAnamnesisRequest } from '../../src/lib/anamnesis-url';

const caseIds = new Set(['rintakipu']);

describe('anamnesis session URLs', () => {
  it('parses a valid case and session', () => {
    expect(parseAnamnesisRequest('?case=rintakipu&session=test-1', caseIds)).toEqual({
      ok: true, value: { caseId: 'rintakipu', sessionId: 'test-1' },
    });
  });
  it('parses a valid case with no session, leaving it null', () => {
    expect(parseAnamnesisRequest('?case=rintakipu', caseIds)).toEqual({
      ok: true, value: { caseId: 'rintakipu', sessionId: null },
    });
  });
  it.each([
    '?case=unknown', '?case=unknown&session=test-1', '', '?session=test-1',
    '?case=rintakipu&session=%20', '?case=rintakipu&session=',
  ])('fails closed for %s', (search) => expect(parseAnamnesisRequest(search, caseIds)).toEqual({ ok: false }));
  it('builds a canonical session URL', () => {
    expect(buildAnamnesisSessionUrl({ sessionId: 's1', caseId: 'rintakipu' }))
      .toBe('/tilanteet/harjoitus?case=rintakipu&session=s1');
  });
  it('builds against a custom pathname', () => {
    expect(buildAnamnesisSessionUrl({ sessionId: 's1', caseId: 'rintakipu' }, '/tilanteet/harjoitus/'))
      .toBe('/tilanteet/harjoitus/?case=rintakipu&session=s1');
  });
});
