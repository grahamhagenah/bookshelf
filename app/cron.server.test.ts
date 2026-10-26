// @vitest-environment node
import { routeArgs } from "../test/route";

import { cronAuthorized } from "./cron.server";
import { loader as checkOverdue } from "./routes/api.check-overdue";

const call = (headers: Record<string, string> = {}, query = "") =>
  new Request(`http://localhost/api/check-overdue${query}`, { headers });

afterEach(() => {
  delete process.env.CRON_SECRET_KEY;
});

test("with no key set, the jobs don't run for anyone", async () => {
  delete process.env.CRON_SECRET_KEY;
  expect(cronAuthorized(call())).toBe(false);
  expect(cronAuthorized(call({ authorization: "Bearer " }))).toBe(false);
  const response = await checkOverdue(routeArgs(call()));
  expect(response.status).toBe(401);
});

test("only the right key opens them, as a bearer token or ?key=", () => {
  process.env.CRON_SECRET_KEY = "s3cret-key";
  expect(cronAuthorized(call({ authorization: "Bearer s3cret-key" }))).toBe(true);
  expect(cronAuthorized(call({}, "?key=s3cret-key"))).toBe(true);
  expect(cronAuthorized(call({ authorization: "Bearer wrong" }))).toBe(false);
  expect(cronAuthorized(call({}, "?key=s3cret"))).toBe(false);
  expect(cronAuthorized(call())).toBe(false);
});
