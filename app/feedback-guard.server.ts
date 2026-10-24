import { createHmac, timingSafeEqual } from "node:crypto";

// Keeping the feedback form for people. A hidden field catches the dumb
// bots; these catch the rest without asking anyone to prove anything:
// a form filled in faster than a person could, a visitor's message that
// reads like a mailshot, and the same address sending over and over.
// Caught messages are answered with the same thank-you and go nowhere.

// How long a person takes, at the very least, to read and write something
export const MIN_SECONDS = 4;

const secret = () => process.env.SESSION_SECRET ?? "";

function sign(issued: string) {
  return createHmac("sha256", secret()).update(`feedback:${issued}`).digest("base64url");
}

// Goes into the form when the page is served
export function formToken(now = Date.now()) {
  const issued = String(now);
  return `${issued}.${sign(issued)}`;
}

// Seconds since the form was served, or null if the token isn't ours
export function formAge(token: unknown, now = Date.now()): number | null {
  if (typeof token !== "string") return null;
  const [issued, given] = token.split(".");
  if (!issued || !given || !/^\d+$/.test(issued)) return null;
  const expected = Buffer.from(sign(issued));
  const offered = Buffer.from(given);
  if (expected.length !== offered.length || !timingSafeEqual(expected, offered)) return null;
  return (now - Number(issued)) / 1000;
}

const LINK = /https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}/gi;

// A visitor's message that is really an advertisement: links to more
// than one place, or a link plus an unsubscribe line. People signed in
// are trusted; a link to a broken page is normal feedback.
export function looksLikeSpam(body: string, { signedIn }: { signedIn: boolean }) {
  if (signedIn) return false;
  const links = body.match(LINK)?.length ?? 0;
  if (links >= 2) return true;
  if (links >= 1 && /unsubscribe|opt[ -]?out/i.test(body)) return true;
  return false;
}

// A few messages an hour from one address is plenty
const PER_HOUR = 3;
const recent = new Map<string, number[]>();

export function tooMany(ip: string | null, now = Date.now()) {
  if (!ip) return false;
  const hourAgo = now - 60 * 60 * 1000;
  const times = (recent.get(ip) ?? []).filter((t) => t > hourAgo);
  times.push(now);
  recent.set(ip, times);
  // Forget quiet addresses so the map doesn't grow forever
  if (recent.size > 1000) {
    for (const [key, list] of recent) if (!list.some((t) => t > hourAgo)) recent.delete(key);
  }
  return times.length > PER_HOUR;
}

export function clientIp(request: Request) {
  return (
    request.headers.get("fly-client-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}
