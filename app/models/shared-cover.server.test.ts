// @vitest-environment node
import { makeUser, prisma } from "../../test/db";

import { createBook } from "./book.server";
import {
  shareCover,
  sharedCoverFor,
  sharedCoversForWorks,
  withSharedCover,
} from "./shared-cover.server";
import { addWantToRead } from "./wish.server";

// Every test gets its own work and edition, so they don't share covers
let next = Math.floor(Math.random() * 1e6) * 1000;
const work = () => `/works/OL${++next}W`;
const isbn13 = (core: string) => {
  const sum = [...core].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return core + ((10 - (sum % 10)) % 10);
};
const isbn = () => isbn13(`978${String(++next).padStart(9, "0").slice(-9)}`);

const openLibrary = "https://covers.openlibrary.org/b/id/1-L.jpg";
const picked = (name: string) => `/covers/custom/${name.padEnd(40, "0")}-L.jpg`;

const book = (userId: string, key: string, cover = openLibrary, edition?: string) =>
  createBook({ title: "Dune", author: "Frank Herbert", body: "", cover, openLibraryKey: key, isbn: edition, userId });

test("a cover picked by hand goes to other copies still showing Open Library's", async () => {
  const me = await makeUser("Me");
  const other = await makeUser("Other");
  const key = work();
  const mine = await book(me.id, key);
  const theirs = await book(other.id, key);
  // Theirs was picked by hand already, and stays
  const chosen = await book(other.id, key, picked("b"));
  await addWantToRead(other.id, { title: "Dune", author: "Frank Herbert", cover: openLibrary, openLibraryKey: key });

  await shareCover(mine.id, picked("a"), me.id);

  const cover = async (id: string) => (await prisma.book.findUnique({ where: { id } }))?.cover;
  expect(await cover(theirs.id)).toBe(picked("a"));
  expect(await cover(chosen.id)).toBe(picked("b"));
  expect(
    (await prisma.wantToRead.findFirst({ where: { userId: other.id, openLibraryKey: key } }))?.cover,
  ).toBe(picked("a"));
  // And anyone adding it later gets it
  expect((await book(other.id, key)).cover).toBe(picked("a"));
  expect(await sharedCoversForWorks([key, undefined])).toEqual({ [key]: picked("a") });
});

test("an edition's cover wins over its work's, and either ISBN form finds it", async () => {
  const me = await makeUser("Me");
  const key = work();
  const edition = isbn();
  const first = await book(me.id, key);
  const second = await book(me.id, key, openLibrary, edition);
  await shareCover(first.id, picked("work"), me.id);
  await shareCover(second.id, picked("edition"), me.id);

  // The ISBN-10 of the same edition
  const core = edition.slice(3, 12);
  const sum = [...core].reduce((total, digit, index) => total + Number(digit) * (10 - index), 0);
  const check = (11 - (sum % 11)) % 11;
  const isbn10 = core + (check === 10 ? "X" : String(check));

  expect(await sharedCoverFor({ isbn: isbn10, openLibraryKey: key })).toBe(picked("edition"));
  expect(await sharedCoverFor({ openLibraryKey: key })).toBe(picked("edition"));
  expect(await sharedCoverFor({ openLibraryKey: work() })).toBeNull();
});

test("a cover someone picked themselves is never replaced", async () => {
  const me = await makeUser("Me");
  const key = work();
  const first = await book(me.id, key);
  await shareCover(first.id, picked("a"), me.id);
  expect(await withSharedCover(picked("mine"), { openLibraryKey: key })).toBe(picked("mine"));
  expect(await withSharedCover("", { openLibraryKey: key })).toBe(picked("a"));
});

test("a demo sandbox keeps its covers to itself", async () => {
  const demo = await makeUser("Demo", { demoGroup: `shared-cover-${next}` });
  const other = await makeUser("Other");
  const key = work();
  const theirs = await book(demo.id, key);
  const mine = await book(other.id, key);
  await shareCover(theirs.id, picked("demo"), demo.id);
  expect(await sharedCoverFor({ openLibraryKey: key })).toBeNull();
  expect((await prisma.book.findUnique({ where: { id: mine.id } }))?.cover).toBe(openLibrary);
});
