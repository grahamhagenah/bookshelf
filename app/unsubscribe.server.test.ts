// @vitest-environment node
import { makeUser, prisma } from "../test/db";
import { routeArgs, statusOf } from "../test/route";

// The route signs people in, which needs a secret; set it before the
// imports run (CI has no .env)
vi.hoisted(() => {
  process.env.SESSION_SECRET ??= "test-secret";
});


import { renderDigest } from "./email.server";
import { action } from "./routes/unsubscribe";
import { readUnsubscribe, unsubscribeUrl } from "./unsubscribe.server";

const settings = (id: string) =>
  prisma.user.findUniqueOrThrow({
    where: { id },
    select: { emailNotifications: true, weeklyDigest: true },
  });

// Posts to an unsubscribe link the way a form or an inbox would
function post(url: string, body: Record<string, string>) {
  return action(
    routeArgs(new Request(url, { method: "POST", body: new URLSearchParams(body) })),
  );
}

test("a link names its person and kind, and can't be altered", () => {
  const url = new URL(unsubscribeUrl("user-1", "weekly"));
  expect(readUnsubscribe(url.searchParams)).toEqual({ userId: "user-1", kind: "weekly" });

  const someoneElse = new URL(url);
  someoneElse.searchParams.set("u", "user-2");
  expect(readUnsubscribe(someoneElse.searchParams)).toBeNull();

  const otherKind = new URL(url);
  otherKind.searchParams.set("k", "requests");
  expect(readUnsubscribe(otherKind.searchParams)).toBeNull();
});

test("an inbox's one-click unsubscribe turns off just that kind", async () => {
  const me = await makeUser("Me");
  const response = await post(unsubscribeUrl(me.id, "weekly"), { "List-Unsubscribe": "One-Click" });
  expect(statusOf(response)).toBe(200);
  expect(await settings(me.id)).toEqual({ emailNotifications: true, weeklyDigest: false });
});

test("the page's button turns it off and back on", async () => {
  const me = await makeUser("Me");
  const url = unsubscribeUrl(me.id, "requests");
  await post(url, { on: "false" });
  expect((await settings(me.id)).emailNotifications).toBe(false);
  await post(url, { on: "true" });
  expect((await settings(me.id)).emailNotifications).toBe(true);
});

test("a tampered link changes nothing", async () => {
  const me = await makeUser("Me");
  const url = new URL(unsubscribeUrl(me.id, "weekly"));
  url.searchParams.set("s", "forged");
  const response = await post(url.toString(), { "List-Unsubscribe": "One-Click" });
  expect(statusOf(response)).toBe(400);
  expect((await settings(me.id)).weeklyDigest).toBe(true);
});

test("the digest links to its own unsubscribe", () => {
  const { html, text } = renderDigest({
    toUserId: "user-1",
    toName: "Me",
    digest: { activity: [], due: [], wanted: [{ title: "Circe", friend: "Maya", bookId: null }] },
  });
  expect(html).toContain("Stop the weekly roundup");
  expect(text).toContain("/unsubscribe?u=user-1&k=weekly");
});
