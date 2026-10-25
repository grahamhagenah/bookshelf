// @vitest-environment node
import { makeBook, makeUser, prisma } from "../test/db";

import { getPublicBookListItems } from "./models/book.server";
import { generateShareToken } from "./models/user.server";
import { handleProblem, normalizeHandle } from "./profile";
import { getShelfProfile, movePin, pinBook, saveProfile, setHiddenFromPage, unpinBook } from "./profile.server";
import { loader as profilePage } from "./routes/$profile";
import { loader as sharePage } from "./routes/share.$token";

vi.hoisted(() => {
  process.env.SESSION_SECRET ??= "test-secret";
});

const visit = (loader: typeof profilePage, path: string, params: Record<string, string>) =>
  loader({ request: new Request(`http://localhost${path}`), params, context: {} });

test("handles are tidied, and refused when they're odd, reserved or taken", async () => {
  expect(normalizeHandle("  @Graham_H ")).toBe("graham_h");
  expect(handleProblem("ab")).toMatch(/3 to 24/);
  expect(handleProblem("no spaces")).toMatch(/letters, numbers/);
  expect(handleProblem("admin")).toMatch(/reserved/);
  expect(handleProblem("bookworm_42")).toBeNull();

  const first = await makeUser("First");
  const second = await makeUser("Second");
  const handle = `reader${Date.now().toString(36)}`;
  expect(await saveProfile(first.id, { handle: `@${handle.toUpperCase()}`, bio: "  Loves   sci-fi  " })).toEqual({ ok: true });
  expect(await prisma.user.findUnique({ where: { id: first.id }, select: { handle: true, bio: true } })).toEqual({
    handle,
    bio: "Loves sci-fi",
  });
  expect(await saveProfile(second.id, { handle, bio: "" })).toEqual({ ok: false, error: `@${handle} is taken. Try another.` });

  // Clearing both is allowed
  expect(await saveProfile(first.id, { handle: "", bio: "" })).toEqual({ ok: true });
  expect(await prisma.user.findUnique({ where: { id: first.id }, select: { handle: true, bio: true } })).toEqual({
    handle: null,
    bio: null,
  });
});

test("favorites are the shelf's books you've hearted; stats count books and lends", async () => {
  const me = await makeUser("Me");
  const dune = await makeBook(me.id, "Dune");
  const circe = await makeBook(me.id, "Circe");
  await makeBook(me.id, "Piranesi");
  await prisma.readerNote.create({ data: { bookId: dune.id, userId: me.id, loved: true } });
  await prisma.readerNote.create({ data: { bookId: circe.id, userId: me.id, readAt: new Date() } });
  await prisma.book.update({ where: { id: dune.id }, data: { lendCount: 3, readAt: new Date() } });

  const profile = await getShelfProfile(me.id);
  expect(profile.favorites.map((book) => book.title)).toEqual(["Dune"]);
  // Reads stay private: the numbers are about lending
  expect(profile.stats).toEqual({ books: 3, timesLent: 3, mostLent: { title: "Dune", times: 3 } });
});

test("a shelf is at /@handle only while sharing is on, and its old link moves there", async () => {
  const me = await makeUser("Me");
  const handle = `shelf${Date.now().toString(36)}`;
  await saveProfile(me.id, { handle, bio: "" });

  // Not shared yet: nothing at the handle
  await expect(visit(profilePage, `/@${handle}`, { profile: `@${handle}` })).rejects.toMatchObject({ status: 404 });

  const token = await generateShareToken(me.id);
  const page = (await visit(profilePage, `/@${handle}`, { profile: `@${handle}` })) as Response;
  expect(page.status).toBe(200);
  expect(await page.json()).toMatchObject({ ownerId: me.id, profile: { handle } });

  const moved = (await visit(sharePage, `/share/${token}`, { token })) as Response;
  expect(moved.status).toBe(302);
  expect(moved.headers.get("Location")).toBe(`/@${handle}`);

  // Only @ addresses are profiles
  await expect(visit(profilePage, `/${handle}`, { profile: handle })).rejects.toMatchObject({ status: 404 });
});

test("pinned books replace hearts on the page, in their order, with their lines", async () => {
  const owner = await makeUser("Maya");
  const [dune, circe, gilead] = await Promise.all([
    makeBook(owner.id, "Dune"),
    makeBook(owner.id, "Circe"),
    makeBook(owner.id, "Gilead"),
  ]);
  // A heart alone fills the row until something's pinned
  await prisma.readerNote.create({ data: { userId: owner.id, bookId: gilead.id, loved: true } });
  expect((await getShelfProfile(owner.id)).favorites.map((b) => b.title)).toEqual(["Gilead"]);

  // What a pin says is the owner's own note on the book
  await prisma.readerNote.create({ data: { userId: owner.id, bookId: circe.id, body: "Read it every winter." } });
  expect(await pinBook(owner.id, circe.id)).toEqual({ ok: true });
  expect(await pinBook(owner.id, dune.id)).toEqual({ ok: true });
  let profile = await getShelfProfile(owner.id);
  expect(profile.pinned).toBe(true);
  expect(profile.favorites.map((b) => [b.title, b.note])).toEqual([
    ["Circe", "Read it every winter."],
    ["Dune", null],
  ]);

  await movePin(owner.id, dune.id, "earlier");
  profile = await getShelfProfile(owner.id);
  expect(profile.favorites.map((b) => b.title)).toEqual(["Dune", "Circe"]);

  await unpinBook(owner.id, dune.id);
  expect((await getShelfProfile(owner.id)).favorites.map((b) => b.title)).toEqual(["Circe"]);
});

test("a page holds five pins, and only books from your own shelf", async () => {
  const owner = await makeUser("Maya");
  const other = await makeUser("Sam");
  const books = await Promise.all(["A", "B", "C", "D", "E", "F"].map((t) => makeBook(owner.id, t)));
  for (const book of books.slice(0, 5)) expect((await pinBook(owner.id, book.id)).ok).toBe(true);
  const sixth = await pinBook(owner.id, books[5].id);
  expect(sixth.ok).toBe(false);
  const notMine = await makeBook(other.id, "Theirs");
  expect((await pinBook(owner.id, notMine.id)).ok).toBe(false);
});

test("a book kept off the page leaves its list, its favorites and its numbers", async () => {
  const owner = await makeUser("Maya");
  const shown = await makeBook(owner.id, "Shown");
  const kept = await makeBook(owner.id, "Kept");
  await prisma.book.update({ where: { id: kept.id }, data: { lendCount: 4 } });
  await prisma.readerNote.create({ data: { userId: owner.id, bookId: kept.id, body: "Secret favorite" } });
  await pinBook(owner.id, kept.id);
  await setHiddenFromPage(owner.id, kept.id, true);

  const profile = await getShelfProfile(owner.id);
  expect(profile.stats.books).toBe(1);
  expect(profile.stats.timesLent).toBe(0);
  expect(profile.stats.mostLent).toBeNull();
  expect(profile.favorites).toEqual([]);
  expect((await getPublicBookListItems([owner.id])).map((b) => b.title)).toEqual([shown.title]);

  // Back on, and its pin with it
  await setHiddenFromPage(owner.id, kept.id, false);
  expect((await getShelfProfile(owner.id)).favorites.map((b) => b.note)).toEqual(["Secret favorite"]);
});

test("the page wears the owner's bookplate color, or the one their name gives", async () => {
  const chose = await makeUser("Maya");
  await prisma.user.update({ where: { id: chose.id }, data: { profileEmoji: "plate:plum" } });
  expect((await getShelfProfile(chose.id)).color).toBe("plum");
  const didnt = await makeUser("Sam");
  expect(["forest", "oxblood", "navy", "ochre", "plum"]).toContain((await getShelfProfile(didnt.id)).color);
});

test("only the owner's own note shows with a pin, not someone else's", async () => {
  const owner = await makeUser("Maya");
  const friend = await makeUser("Sam");
  const book = await makeBook(owner.id, "Dune");
  await prisma.readerNote.create({ data: { userId: friend.id, bookId: book.id, body: "Loved it, thanks!" } });
  await pinBook(owner.id, book.id);
  await pinBook(owner.id, book.id);
  expect((await getShelfProfile(owner.id)).favorites.map((b) => b.note)).toEqual([null]);
});
