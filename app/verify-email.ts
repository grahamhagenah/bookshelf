import { createHmac, timingSafeEqual } from "node:crypto";

// Links in confirmation emails: the account and address they were sent
// for and when they stop working, signed so they can't be made up. Changing
// your email makes old links useless, since the address is part of them.

export const VERIFY_LINK_DAYS = 7;
// How long before the confirmation email can be sent again
export const RESEND_WAIT_MS = 2 * 60 * 1000;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function makeVerifyToken(
  userId: string,
  email: string,
  secret: string,
  now = Date.now(),
) {
  const expires = now + VERIFY_LINK_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify([userId, email, expires])).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function readVerifyToken(
  token: string,
  secret: string,
  now = Date.now(),
): { userId: string; email: string } | null {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const [userId, email, expires] = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof userId !== "string" || typeof email !== "string" || typeof expires !== "number") {
      return null;
    }
    return expires > now ? { userId, email } : null;
  } catch {
    return null;
  }
}

export function canResend(sentAt: Date | null, now = Date.now()) {
  return !sentAt || now - sentAt.getTime() >= RESEND_WAIT_MS;
}
