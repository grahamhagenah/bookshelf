import { createHmac, timingSafeEqual } from "node:crypto";

// Links that carry their own data (an account, an address, when they stop
// working), signed so they can't be made up or edited

export function hmac(data: string, secret: string) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signToken(parts: unknown[], secret: string) {
  const payload = Buffer.from(JSON.stringify(parts)).toString("base64url");
  return `${payload}.${hmac(payload, secret)}`;
}

// The parts back, or null if the token was tampered with or isn't one
export function readToken(token: string, secret: string): unknown[] | null {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;
  if (!sameString(hmac(payload, secret), signature)) return null;
  try {
    const parts = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Array.isArray(parts) ? parts : null;
  } catch {
    return null;
  }
}

// Compares in constant time, so timing can't reveal how much matched
export function sameString(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
