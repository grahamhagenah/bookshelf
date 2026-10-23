import { hmac, readToken, sameString, signToken } from "~/signed-token";

// Links in password-reset emails. Each carries a fingerprint of the
// password as it was when the link was sent, so it stops working the moment
// the password changes: a link works once, and an old one can't undo a
// newer reset.

export const RESET_LINK_MINUTES = 60;

const KIND = "reset";

export function passwordStamp(passwordHash: string, secret: string) {
  return hmac(`${KIND}:${passwordHash}`, secret).slice(0, 22);
}

export function makeResetToken(
  userId: string,
  passwordHash: string,
  secret: string,
  now = Date.now(),
) {
  const expires = now + RESET_LINK_MINUTES * 60 * 1000;
  return signToken([KIND, userId, passwordStamp(passwordHash, secret), expires], secret);
}

// What a genuine, unexpired link claims: whose it is, and the password it
// was sent for. Whether that's still the password is checked with
// stampMatches against the account.
export function readResetToken(
  token: string,
  secret: string,
  now = Date.now(),
): { userId: string; stamp: string } | null {
  const parts = readToken(token, secret);
  if (!parts || parts.length !== 4) return null;
  const [kind, userId, stamp, expires] = parts;
  if (kind !== KIND || typeof userId !== "string" || typeof stamp !== "string") return null;
  if (typeof expires !== "number" || expires <= now) return null;
  return { userId, stamp };
}

export function stampMatches(stamp: string, passwordHash: string, secret: string) {
  return sameString(passwordStamp(passwordHash, secret), stamp);
}
