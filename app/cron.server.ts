import { timingSafeEqual } from "node:crypto";

// The scheduled jobs (reminders, the weekly digest) run only for whoever
// holds CRON_SECRET_KEY: GitHub's scheduled workflow sends it as a bearer
// token. Without the secret set, they don't run at all.

export function cronAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET_KEY;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  // A ?key= still works, for running a job by hand
  const given = header.replace(/^Bearer\s+/i, "") || new URL(request.url).searchParams.get("key") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
