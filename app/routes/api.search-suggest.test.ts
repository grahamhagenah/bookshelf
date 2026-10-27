// @vitest-environment node
import { rememberBooks } from "~/models/catalog.server";
import { sessionStorage } from "~/session.server";

import { makeUser, prisma } from "../../test/db";
import { bodyOf, routeArgs } from "../../test/route";

import { loader } from "./api.search-suggest";
import type { SuggestResponse } from "./api.search-suggest";

// The search box asking, signed in as someone
async function suggest(userId: string, query: string, source?: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  const params = new URLSearchParams({ q: query, ...(source ? { source } : {}) });
  const result = await loader(
    routeArgs(
      new Request(`http://localhost/api/search-suggest?${params}`, {
        headers: { Cookie: await sessionStorage.commitSession(session) },
      }),
    ),
  );
  return (await bodyOf(result)) as SuggestResponse;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("books Stacks knows come back at once; Open Library's join after them", async () => {
  const me = await makeUser("Me");
  // A word no other test uses, so only these books match
  const word = `Zq${crypto.randomUUID().slice(0, 6)}`;
  const known = `/works/OL${crypto.randomUUID().slice(0, 8)}W`;
  const fresh = `/works/OL${crypto.randomUUID().slice(0, 8)}W`;
  await rememberBooks([
    { key: known, title: `${word} Halls`, author: "Susanna Clarke", coverId: 1, year: 2020, pages: null, subjects: null, publisher: null, editions: null },
  ]);
  let asked = 0;
  vi.stubGlobal("fetch", async () => {
    asked++;
    return new Response(
      JSON.stringify({ docs: [{ key: fresh, title: `${word} Tides`, author_name: ["Someone"], cover_i: 2 }] }),
      { status: 200 },
    );
  });

  // At once: only what's known, and Open Library isn't asked
  const quick = await suggest(me.id, word.toLowerCase());
  expect(quick.openLibrary.map((book) => book.key)).toEqual([known]);
  expect(asked).toBe(0);

  // Then: the known book still first, Open Library's after it
  const full = await suggest(me.id, word.toLowerCase(), "openLibrary");
  expect(full.openLibrary.map((book) => book.key)).toEqual([known, fresh]);

  // And what Open Library found is known from now on
  expect(await prisma.catalogBook.findUnique({ where: { key: fresh } })).toMatchObject({ title: `${word} Tides` });
});

test("when Open Library is down, the known books are still the answer", async () => {
  const me = await makeUser("Me");
  const word = `Zq${crypto.randomUUID().slice(0, 6)}`;
  const known = `/works/OL${crypto.randomUUID().slice(0, 8)}W`;
  await rememberBooks([
    { key: known, title: `${word} Moon`, author: null, coverId: null, year: null, pages: null, subjects: null, publisher: null, editions: null },
  ]);
  vi.stubGlobal("fetch", async () => {
    throw new Error("down");
  });

  const full = await suggest(me.id, word, "openLibrary");
  expect(full.openLibrary.map((book) => book.key)).toEqual([known]);
});

test("the most widely read lead, whether known already or just found", async () => {
  const me = await makeUser("Me");
  const word = `Zq${crypto.randomUUID().slice(0, 6)}`;
  const study = `/works/OL${crypto.randomUUID().slice(0, 8)}W`;
  const novel = `/works/OL${crypto.randomUUID().slice(0, 8)}W`;
  // A book about the author, seen in an earlier search
  await rememberBooks([
    { key: study, title: `Reading ${word}`, author: "A Scholar", coverId: null, year: null, pages: null, subjects: null, publisher: null, editions: 2 },
  ]);
  vi.stubGlobal("fetch", async () =>
    new Response(
      JSON.stringify({ docs: [{ key: novel, title: `${word} Remains`, author_name: ["Novelist"], edition_count: 87 }] }),
      { status: 200 },
    ),
  );

  const full = await suggest(me.id, word, "openLibrary");
  expect(full.openLibrary.map((book) => book.key)).toEqual([novel, study]);
});

test("a title's leading The doesn't keep it from matching what's typed", async () => {
  const me = await makeUser("Me");
  const word = `zq${crypto.randomUUID().slice(0, 6)}`;
  const guide = `/works/OL${crypto.randomUUID().slice(0, 8)}W`;
  const novel = `/works/OL${crypto.randomUUID().slice(0, 8)}W`;
  await rememberBooks([
    { key: guide, title: `${word} of the Day, a study guide`, author: "A Tutor", coverId: null, year: null, pages: null, subjects: null, publisher: null, editions: 1 },
    { key: novel, title: `The ${word} of the Day`, author: "Novelist", coverId: null, year: null, pages: null, subjects: null, publisher: null, editions: 87 },
  ]);
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ docs: [] }), { status: 200 }));

  const quick = await suggest(me.id, `${word} of`);
  expect(quick.openLibrary.map((book) => book.key)).toEqual([novel, guide]);
});
