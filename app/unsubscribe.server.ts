import { createHmac, timingSafeEqual } from "node:crypto";

import type { EmailKind } from "~/models/user.server";

// Links that turn off one kind of email without signing in. Each is signed
// with the session secret, so only the address it was sent to can use it.

const APP_URL = process.env.APP_URL || "http://localhost:3000";

const isKind = (kind: unknown): kind is EmailKind => kind === "requests" || kind === "weekly";

function signature(userId: string, kind: EmailKind) {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "")
    .update(`unsubscribe:${userId}:${kind}`)
    .digest("base64url");
}

export function unsubscribeUrl(userId: string, kind: EmailKind) {
  const params = new URLSearchParams({ u: userId, k: kind, s: signature(userId, kind) });
  return `${APP_URL}/unsubscribe?${params}`;
}

// The person and kind from a link, or null if it's been tampered with
export function readUnsubscribe(params: URLSearchParams) {
  const userId = params.get("u");
  const kind = params.get("k");
  const given = params.get("s");
  if (!userId || !isKind(kind) || !given) return null;
  const expected = Buffer.from(signature(userId, kind));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { userId, kind };
}
