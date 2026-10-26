// @vitest-environment node
import { prisma } from "../../test/db";
import { routeArgs } from "../../test/route";

import { action } from "./demo";

const BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function press(fields: Record<string, string>, userAgent = BROWSER) {
  const body = new FormData();
  body.set("intent", "start");
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return action(
    routeArgs(
      new Request("http://localhost/demo", {
        method: "POST",
        body,
        headers: { "user-agent": userAgent },
      }),
    ),
  );
}

const sandboxes = async () =>
  (await prisma.user.findMany({ where: { demoGroup: { not: null } }, select: { demoGroup: true }, distinct: ["demoGroup"] })).length;

test("the demo button turns away a bot that says it's one", async () => {
  const before = await sandboxes();
  const response = await press({ website: "" }, "Googlebot/2.1 (+http://www.google.com/bot.html)");
  expect(response.headers.get("Location")).toBe("/");
  expect(response.headers.get("Set-Cookie")).toBeNull();
  expect(await sandboxes()).toBe(before);
});

test("the demo button turns away a form that filled in the hidden field", async () => {
  const before = await sandboxes();
  const response = await press({ website: "http://spam.example" });
  expect(response.headers.get("Set-Cookie")).toBeNull();
  expect(await sandboxes()).toBe(before);
});

test(
  "the demo button starts a sandbox for a person",
  async () => {
    const before = await sandboxes();
    const response = await press({ website: "" });
    expect(response.headers.get("Set-Cookie")).toContain("__session");
    expect(await sandboxes()).toBe(before + 1);
  },
  30_000,
);
