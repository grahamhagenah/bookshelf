// @vitest-environment node
import { prisma } from "../../test/db";

import { clearOutOld, openLibraryJson } from "./openlibrary-cache.server";

const DAY = 24 * 60 * 60 * 1000;

// A fresh address for each test, so they never share an answer
const anAddress = () =>
  `https://openlibrary.org/works/OL${crypto.randomUUID()}W.json`;

// A stand-in Open Library that counts its calls and answers with the
// given body, or fails
function stubOpenLibrary(answer: () => unknown) {
  let calls = 0;
  vi.stubGlobal("fetch", async () => {
    calls++;
    const body = answer();
    if (body instanceof Error) throw body;
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return () => calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("asks Open Library once, then answers from what's kept", async () => {
  const url = anAddress();
  const calls = stubOpenLibrary(() => ({ title: "Piranesi" }));

  expect(await openLibraryJson(url, { timeoutMs: 1000 })).toEqual({ title: "Piranesi" });
  expect(await openLibraryJson(url, { timeoutMs: 1000 })).toEqual({ title: "Piranesi" });
  expect(calls()).toBe(1);
});

test("the same question asked twice at once is one call", async () => {
  const url = anAddress();
  const calls = stubOpenLibrary(() => ({ title: "Circe" }));

  await Promise.all([
    openLibraryJson(url, { timeoutMs: 1000 }),
    openLibraryJson(url, { timeoutMs: 1000 }),
  ]);
  expect(calls()).toBe(1);
});

test("a stale answer comes back at once and is fetched again behind it", async () => {
  const url = anAddress();
  await prisma.openLibraryResponse.create({
    data: { url, body: JSON.stringify({ edition: "old" }), fetchedAt: new Date(Date.now() - 8 * DAY) },
  });
  const calls = stubOpenLibrary(() => ({ edition: "new" }));

  expect(await openLibraryJson(url, { timeoutMs: 1000 })).toEqual({ edition: "old" });
  await vi.waitFor(async () => {
    const kept = await prisma.openLibraryResponse.findUniqueOrThrow({ where: { url } });
    expect(JSON.parse(kept.body)).toEqual({ edition: "new" });
  });
  expect(calls()).toBe(1);
});

test("when Open Library fails, the last good answer stands in", async () => {
  const url = anAddress();
  await prisma.openLibraryResponse.create({
    data: { url, body: JSON.stringify({ title: "Kept" }), fetchedAt: new Date() },
  });
  stubOpenLibrary(() => new Error("down"));

  // Even when asked to go straight to Open Library
  expect(await openLibraryJson(url, { timeoutMs: 1000, fresh: true })).toEqual({ title: "Kept" });
  // With nothing kept, the failure is the caller's to handle
  await expect(openLibraryJson(anAddress(), { timeoutMs: 1000 })).rejects.toThrow("down");
});

test("a dropped connection or a busy answer gets one more try", async () => {
  const dropped = anAddress();
  let tries = 0;
  const calls = stubOpenLibrary(() => (++tries === 1 ? new TypeError("fetch failed") : { title: "Holes" }));
  expect(await openLibraryJson(dropped, { timeoutMs: 2000 })).toEqual({ title: "Holes" });
  expect(calls()).toBe(2);

  const busy = anAddress();
  let asked = 0;
  vi.stubGlobal("fetch", async () =>
    ++asked === 1
      ? new Response("Busy", { status: 503 })
      : new Response(JSON.stringify({ title: "Wonder" }), { status: 200 }),
  );
  expect(await openLibraryJson(busy, { timeoutMs: 2000 })).toEqual({ title: "Wonder" });
  expect(asked).toBe(2);
});

test("an answer that it isn't there is believed, not asked again", async () => {
  const url = anAddress();
  let asked = 0;
  vi.stubGlobal("fetch", async () => {
    asked++;
    return new Response("Not found", { status: 404 });
  });
  await expect(openLibraryJson(url, { timeoutMs: 1000 })).rejects.toThrow("Open Library answered 404");
  expect(asked).toBe(1);
});

test("an error answer isn't kept", async () => {
  const url = anAddress();
  vi.stubGlobal("fetch", async () => new Response("Not found", { status: 404 }));

  await expect(openLibraryJson(url, { timeoutMs: 1000 })).rejects.toThrow("Open Library answered 404");
  expect(await prisma.openLibraryResponse.findUnique({ where: { url } })).toBeNull();
});

// A fresh search address, as anAddress is for a record
const aSearch = () =>
  `https://openlibrary.org/search.json?q=${crypto.randomUUID()}`;

test("searches older than a month are cleared out, records after a year", async () => {
  const oldSearch = aSearch();
  const recentSearch = aSearch();
  const monthOldRecord = anAddress();
  const yearOldRecord = anAddress();
  await prisma.openLibraryResponse.createMany({
    data: [
      { url: oldSearch, body: "{}", fetchedAt: new Date(Date.now() - 31 * DAY) },
      { url: recentSearch, body: "{}", fetchedAt: new Date(Date.now() - DAY) },
      { url: monthOldRecord, body: "{}", fetchedAt: new Date(Date.now() - 31 * DAY) },
      { url: yearOldRecord, body: "{}", fetchedAt: new Date(Date.now() - 366 * DAY) },
    ],
  });

  await clearOutOld();

  const kept = async (url: string) =>
    (await prisma.openLibraryResponse.findUnique({ where: { url } })) !== null;
  expect(await kept(oldSearch)).toBe(false);
  expect(await kept(recentSearch)).toBe(true);
  expect(await kept(monthOldRecord)).toBe(true);
  expect(await kept(yearOldRecord)).toBe(false);
});

test("an answer too slow for the caller is still kept for the next one", async () => {
  const url = anAddress();
  vi.stubGlobal("fetch", async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return new Response(JSON.stringify({ title: "Slow" }), { status: 200 });
  });

  await expect(openLibraryJson(url, { timeoutMs: 10 })).rejects.toThrow("took too long");
  await vi.waitFor(async () => {
    expect(await prisma.openLibraryResponse.findUnique({ where: { url } })).not.toBeNull();
  });
  expect(await openLibraryJson(url, { timeoutMs: 10 })).toEqual({ title: "Slow" });
});
