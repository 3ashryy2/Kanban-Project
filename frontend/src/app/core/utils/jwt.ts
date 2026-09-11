/**
 * Expiry of a JWT in milliseconds since the epoch, read from its payload's "exp" claim.
 * Returns null when the token can't be read; the signature is never checked here (only the server can).
 */
export function readTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // JWTs use base64url ('-' and '_' instead of '+' and '/', no padding); atob needs plain base64
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = JSON.parse(json).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True only when the token states an expiry and it has passed; unreadable tokens are left for the server to judge. */
export function isTokenExpired(token: string, now: number = Date.now()): boolean {
  const expiry = readTokenExpiry(token);
  return expiry !== null && expiry <= now;
}
