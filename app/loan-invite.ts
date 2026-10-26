import { readToken, signToken } from "~/signed-token";

// Lending a book to someone who isn't on Stacks yet. They get an email
// with a link that's theirs alone: it carries their account and address,
// signed, and lets them set a password and step into the loan.

export const INVITE_LINK_DAYS = 60;
// How many loans a shelf can make to people not on Stacks in a day, so the
// form can't be used to send email to strangers
export const INVITES_PER_DAY = 5;

const KIND = "lent";

export function makeInviteToken(
  userId: string,
  email: string,
  secret: string,
  now = Date.now(),
) {
  const expires = now + INVITE_LINK_DAYS * 24 * 60 * 60 * 1000;
  return signToken([KIND, userId, email, expires], secret);
}

export function readInviteToken(
  token: string,
  secret: string,
  now = Date.now(),
): { userId: string; email: string } | null {
  const parts = readToken(token, secret);
  if (!parts || parts.length !== 4) return null;
  const [kind, userId, email, expires] = parts;
  if (kind !== KIND || typeof userId !== "string" || typeof email !== "string") return null;
  if (typeof expires !== "number" || expires <= now) return null;
  return { userId, email };
}

// "Maya Chen" as a first name and the rest; one word is just a first name
export function splitName(name: string) {
  const [firstname = "", ...rest] = name.trim().split(/\s+/);
  return { firstname, surname: rest.join(" ") };
}
