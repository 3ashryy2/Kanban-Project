import { isTokenExpired, readTokenExpiry } from './jwt';

// An unsigned token with the given payload; only the middle part matters to the browser
const tokenWith = (payload: object): string =>
  `header.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.signature`;

describe('jwt helpers', () => {
  it('reads the expiry claim as milliseconds', () => {
    expect(readTokenExpiry(tokenWith({ exp: 1_800_000_000 }))).toBe(1_800_000_000_000);
  });

  it('returns null for tokens it cannot read', () => {
    expect(readTokenExpiry('not-a-jwt')).toBeNull();
    expect(readTokenExpiry('a.%%%.c')).toBeNull();
    expect(readTokenExpiry(tokenWith({ sub: 'dev@valeo.com' }))).toBeNull();
  });

  it('treats a passed expiry as expired and a future one as live', () => {
    const now = 1_800_000_000_000;
    expect(isTokenExpired(tokenWith({ exp: 1_799_999_999 }), now)).toBe(true);
    expect(isTokenExpired(tokenWith({ exp: 1_800_000_060 }), now)).toBe(false);
  });

  it('leaves unreadable tokens for the server to judge', () => {
    expect(isTokenExpired('not-a-jwt')).toBe(false);
  });
});
