import { readToken, signToken } from "~/signed-token";

// Links in confirmation emails: the account and address they were sent
// for and when they stop working, signed so they can't be made up. Changing
// your email makes old links useless, since the address is part of them.

export const VERIFY_LINK_DAYS = 7;
// How long before the confirmation email can be sent again
export const RESEND_WAIT_MS = 2 * 60 * 1000;

export function makeVerifyToken(
  userId: string,
  email: string,
  secret: string,
  now = Date.now(),
) {
  const expires = now + VERIFY_LINK_DAYS * 24 * 60 * 60 * 1000;
  return signToken([userId, email, expires], secret);
}

export function readVerifyToken(
  token: string,
  secret: string,
  now = Date.now(),
): { userId: string; email: string } | null {
  const parts = readToken(token, secret);
  if (!parts || parts.length !== 3) return null;
  const [userId, email, expires] = parts;
  if (typeof userId !== "string" || typeof email !== "string" || typeof expires !== "number") {
    return null;
  }
  return expires > now ? { userId, email } : null;
}

export function canResend(sentAt: Date | null, now = Date.now()) {
  return !sentAt || now - sentAt.getTime() >= RESEND_WAIT_MS;
}
