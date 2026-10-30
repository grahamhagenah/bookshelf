// @vitest-environment node
import { makeBook, makeUser, prisma } from "../test/db";
import { bodyOf, routeArgs, statusOf } from "../test/route";

import { getPublicBookListItems } from "./models/book.server";
import { createFriendship, generateShareToken } from "./models/user.server";
import { handleProblem, normalizeHandle } from "./profile";
import {
  getShelfProfile,
  movePin,
  pinBook,
  saveProfile,
  setHiddenFromPage,
  unpinBook,
} from "./profile.server";
import { loader as profilePage } from "./routes/$profile";
import { loader as sharePage } from "./routes/share.$token";
import { sessionStorage } from "./session.server";

vi.hoisted(() => {
  process.env.SESSION_SECRET ??= "test-secret";
});

const visit = (
  loader: typeof profilePage,
  path: string,
  params: Record<string, string>,
) =>
  loader(routeArgs(new Request(`http://localhost${path}`), params));

test("handles are tidied, and refused when they're odd, reserved or taken", async () => {
  expect(normalizeHandle("  @Graham_H ")).toBe("graham_h");
  expect(handleProblem("ab")).toMatch(/3 to 24/);
  expect(handleProblem("no spaces")).toMatch(/letters, numbers/);
  expect(handleProblem("admin")).toMatch(/reserved/);
  expect(handleProblem("bookworm_42")).toBeNull();

  const first = await makeUser("First");
  const second = await makeUser("Second");
  const handle = `reader${Date.now().toString(36)}`;
  expect(
    await saveProfile(first.id, {
      handle: `@${handle.toUpperCase()}`,
      bio: "  Loves   sci-fi  ",
    }),
  ).toEqual({ ok: true });
  expect(
    await prisma.user.findUnique({
      where: { id: first.id },
      select: { handle: true, bio: true },
    }),
  ).toEqual({
    handle,
    bio: "Loves sci-fi",
  });
  expect(await saveProfile(second.id, { handle, bio: "" })).toEqual({
    ok: false,
    error: `@${handle} is taken. Try another.`,
  });

  // Clearing both is allowed
  expect(await saveProfile(first.id, { handle: "", bio: "" })).toEqual({
    ok: true,
  });
  expect(
    await prisma.user.findUnique({
      where: { id: first.id },
      select: { handle: true, bio: true },
    }),
  ).toEqual({
    handle: null,
    bio: null,
  });
});

test("favorites are the shelf's books you've hearted; stats count books and lends", async () => {
  const me = await makeUser("Me");
  const dune = await makeBook(me.id, "Dune");
  const circe = await makeBook(me.id, "Circe");
  await makeBook(me.id, "Piranesi");
  await prisma.readerNote.create({
    data: { bookId: dune.id, userId: me.id, loved: true },
  });
  await prisma.readerNote.create({
    data: { bookId: circe.id, userId: me.id, readAt: new Date() },
  });
  await prisma.book.update({
    where: { id: dune.id },
    data: { lendCount: 3, readAt: new Date() },
  });

  const profile = await getShelfProfile(me.id);
  expect(profile.favorites.map((book) => book.title)).toEqual(["Dune"]);
  // Reads stay private: the numbers are about lending
  expect(profile.stats).toEqual({
    books: 3,
    timesLent: 3,
    mostLent: { title: "Dune", times: 3 },
  });
});

test("a shelf is at /@handle only while sharing is on, and its old link moves there", async () => {
  const me = await makeUser("Me");
  const handle = `shelf${Date.now().toString(36)}`;
  await saveProfile(me.id, { handle, bio: "" });

  // Not shared yet: nothing at the handle
  await expect(
    visit(profilePage, `/@${handle}`, { profile: `@${handle}` }),
  ).rejects.toMatchObject({ status: 404 });

  const token = await generateShareToken(me.id);
  const page = await visit(profilePage, `/@${handle}`, {
    profile: `@${handle}`,
  });
  expect(statusOf(page)).toBe(200);
  expect(await bodyOf(page)).toMatchObject({
    ownerId: me.id,
    profile: { handle },
  });

  const moved = (await visit(sharePage as typeof profilePage, `/share/${token}`, {
    token,
  })) as unknown as Response;
  expect(moved.status).toBe(302);
  expect(moved.headers.get("Location")).toBe(`/@${handle}`);

  // Only @ addresses are profiles
  await expect(
    visit(profilePage, `/${handle}`, { profile: handle }),
  ).rejects.toMatchObject({ status: 404 });
});

test("pinned books replace hearts on the page, in their order, with their lines", async () => {
  const owner = await makeUser("Maya");
  const [dune, circe, gilead] = await Promise.all([
    makeBook(owner.id, "Dune"),
    makeBook(owner.id, "Circe"),
    makeBook(owner.id, "Gilead"),
  ]);
  // A heart alone fills the row until something's pinned
  await prisma.readerNote.create({
    data: { userId: owner.id, bookId: gilead.id, loved: true },
  });
  expect(
    (await getShelfProfile(owner.id)).favorites.map((b) => b.title),
  ).toEqual(["Gilead"]);

  // What a pin says is the owner's own note on the book
  await prisma.readerNote.create({
    data: { userId: owner.id, bookId: circe.id, body: "Read it every winter." },
  });
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
  expect(
    (await getShelfProfile(owner.id)).favorites.map((b) => b.title),
  ).toEqual(["Circe"]);
});

test("a page holds five pins, and only books from your shelf or borrowed", async () => {
  const owner = await makeUser("Maya");
  const other = await makeUser("Sam");
  const books = await Promise.all(
    ["A", "B", "C", "D", "E", "F"].map((t) => makeBook(owner.id, t)),
  );
  for (const book of books.slice(0, 5))
    expect((await pinBook(owner.id, book.id)).ok).toBe(true);
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
  await prisma.readerNote.create({
    data: { userId: owner.id, bookId: kept.id, body: "Secret favorite" },
  });
  await pinBook(owner.id, kept.id);
  await setHiddenFromPage(owner.id, kept.id, true);

  const profile = await getShelfProfile(owner.id);
  expect(profile.stats.books).toBe(1);
  expect(profile.stats.timesLent).toBe(0);
  expect(profile.stats.mostLent).toBeNull();
  expect(profile.favorites).toEqual([]);
  expect(
    (await getPublicBookListItems([owner.id])).map((b) => b.title),
  ).toEqual([shown.title]);

  // Back on, and its pin with it
  await setHiddenFromPage(owner.id, kept.id, false);
  expect(
    (await getShelfProfile(owner.id)).favorites.map((b) => b.note),
  ).toEqual(["Secret favorite"]);
});

test("the page wears the owner's bookplate color, or the one their name gives", async () => {
  const chose = await makeUser("Maya");
  await prisma.user.update({
    where: { id: chose.id },
    data: { profileEmoji: "plate:plum" },
  });
  expect((await getShelfProfile(chose.id)).color).toBe("plum");
  const didnt = await makeUser("Sam");
  expect(["forest", "oxblood", "navy", "ochre", "plum"]).toContain(
    (await getShelfProfile(didnt.id)).color,
  );
});

test("only the owner's own note shows with a pin, not someone else's", async () => {
  const owner = await makeUser("Maya");
  const friend = await makeUser("Sam");
  const book = await makeBook(owner.id, "Dune");
  await prisma.readerNote.create({
    data: { userId: friend.id, bookId: book.id, body: "Loved it, thanks!" },
  });
  await pinBook(owner.id, book.id);
  await pinBook(owner.id, book.id);
  expect(
    (await getShelfProfile(owner.id)).favorites.map((b) => b.note),
  ).toEqual([null]);
});

test("a borrowed book can be a favorite, with your note, no lender and no link", async () => {
  const me = await makeUser("Me");
  const sam = await makeUser("Sam");
  const gilead = await makeBook(sam.id, "Gilead");
  const neverLent = await makeBook(sam.id, "Babel");
  const mine = await makeBook(me.id, "Dune");
  await prisma.lendingHistory.create({
    data: {
      bookId: gilead.id,
      borrowerId: me.id,
      borrowedAt: new Date(),
      returnedAt: new Date(),
    },
  });

  // Hearted before any pins: the borrowed book is among the hearts
  await prisma.readerNote.create({
    data: {
      bookId: gilead.id,
      userId: me.id,
      loved: true,
      body: "Slow and kind.",
    },
  });
  await prisma.readerNote.create({
    data: { bookId: neverLent.id, userId: me.id, loved: true },
  });
  expect(
    (await getShelfProfile(me.id)).favorites.map((b) => [b.title, b.onShelf]),
  ).toEqual([["Gilead", false]]);

  // Pinned: yours and borrowed, never one you've only seen
  expect(await pinBook(me.id, mine.id)).toEqual({ ok: true });
  expect(await pinBook(me.id, gilead.id)).toEqual({ ok: true });
  expect((await pinBook(me.id, neverLent.id)).ok).toBe(false);
  const { favorites } = await getShelfProfile(me.id);
  expect(favorites.map((b) => [b.title, b.onShelf, b.note])).toEqual([
    ["Dune", true, null],
    ["Gilead", false, "Slow and kind."],
  ]);
  // Nothing about whose it is
  expect(Object.keys(favorites[1]).sort()).toEqual([
    "author",
    "cover",
    "id",
    "note",
    "onShelf",
    "title",
  ]);

  // Sam keeps it off Sam's page: it leaves this one too, and can't be pinned again
  await setHiddenFromPage(sam.id, gilead.id, true);
  expect((await getShelfProfile(me.id)).favorites.map((b) => b.title)).toEqual([
    "Dune",
  ]);
  await unpinBook(me.id, gilead.id);
  expect(await pinBook(me.id, gilead.id)).toEqual({
    ok: false,
    error: "Its owner keeps it off public shelves.",
  });
});

test("a friend sees which books are out or kept back; anyone else doesn't", async () => {
  const owner = await makeUser("Maya");
  const friend = await makeUser("Sam");
  const stranger = await makeUser("Lee");
  await createFriendship(owner.id, friend.id);
  const free = await makeBook(owner.id, "Persuasion");
  const out = await makeBook(owner.id, "Middlemarch");
  const kept = await makeBook(owner.id, "Jane Eyre");
  await prisma.book.update({ where: { id: out.id }, data: { borrowerId: friend.id } });
  await prisma.book.update({
    where: { id: kept.id },
    data: { notLendingUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });
  await generateShareToken(owner.id);
  const { handle } = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });

  const shelfAs = async (viewerId?: string) => {
    const headers = new Headers();
    if (viewerId) {
      const session = await sessionStorage.getSession();
      session.set("userId", viewerId);
      headers.set("Cookie", await sessionStorage.commitSession(session));
    }
    const page = await profilePage(
      routeArgs(new Request(`http://localhost/@${handle}`, { headers }), { profile: `@${handle}` }),
    );
    const { bookListItems } = (await bodyOf(page)) as {
      bookListItems: { id: string; isLending?: boolean; notLending?: boolean; borrowerId?: string }[];
    };
    return new Map(bookListItems.map((book) => [book.id, book]));
  };

  const asFriend = await shelfAs(friend.id);
  expect(asFriend.get(free.id)).toMatchObject({ isLending: false, notLending: false });
  expect(asFriend.get(out.id)).toMatchObject({ isLending: true, notLending: false });
  expect(asFriend.get(kept.id)).toMatchObject({ isLending: false, notLending: true });
  // Whether it's out, never who has it
  expect(asFriend.get(out.id)).not.toHaveProperty("borrowerId");

  for (const viewer of [stranger.id, undefined]) {
    for (const book of (await shelfAs(viewer)).values()) {
      expect(book).not.toHaveProperty("isLending");
      expect(book).not.toHaveProperty("notLending");
      expect(book).not.toHaveProperty("borrowerId");
    }
  }
});
