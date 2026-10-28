// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { createFriendship } from "./user.server";
import {
  addWantToRead,
  getWantToRead,
  getWish,
  moveToShelf,
  notifyWanters,
  removeWantedWork,
  sameWork,
  setWishWork,
  workKeyFromFriends,
} from "./wish.server";

const wish = (title: string) => ({ title, author: "Someone", cover: "" });

test("sameWork goes by work key, then ISBN, then title", () => {
  expect(sameWork({ title: "A", openLibraryKey: "/works/1" }, { title: "B", openLibraryKey: "/works/1" })).toBe(true);
  expect(sameWork({ title: "A", openLibraryKey: "/works/1" }, { title: "A", openLibraryKey: "/works/2" })).toBe(false);
  expect(sameWork({ title: "A", isbn: "1" }, { title: "B", isbn: "1" })).toBe(true);
  // Two editions of one book
  expect(sameWork({ title: "Hamnet", isbn: "9780525657606" }, { title: "Hamnet", isbn: "9781432892494" })).toBe(true);
  expect(sameWork({ title: "Hamnet", isbn: "1" }, { title: "Circe", isbn: "2" })).toBe(false);
  expect(sameWork({ title: "Dune (Dune, #1)" }, { title: "dune" })).toBe(true);
  expect(sameWork({ title: "Dune" }, { title: "Dune Messiah" })).toBe(false);
});

test("the list shows which friends have a copy", async () => {
  const me = await makeUser("Me");
  const priya = await makeUser("Priya");
  const stranger = await makeUser("Stranger");
  await createFriendship(me.id, priya.id);
  await makeBook(priya.id, "Piranesi");
  await makeBook(stranger.id, "Dune");

  await addWantToRead(me.id, wish("piranesi"));
  await addWantToRead(me.id, wish("Dune"));
  // Already there: nothing new
  expect(await addWantToRead(me.id, wish("Piranesi"))).toBeNull();

  const items = await getWantToRead(me.id);
  const byTitle = (title: string) => items.find((item) => item.title === title)!;
  expect(items.map((item) => item.title).sort()).toEqual(["Dune", "piranesi"]);
  expect(byTitle("piranesi").copies).toEqual([
    expect.objectContaining({ owner: expect.objectContaining({ firstname: "Priya" }), available: true }),
  ]);
  // Strangers' shelves don't count
  expect(byTitle("Dune").copies).toEqual([]);
});

test("a friend adding a book you want tells you, once", async () => {
  const me = await makeUser("Me");
  const priya = await makeUser("Priya");
  await createFriendship(me.id, priya.id);
  await addWantToRead(me.id, wish("Piranesi"));

  const book = await makeBook(priya.id, "Piranesi");
  await notifyWanters(priya.id, [book]);
  await notifyWanters(priya.id, [book]);

  const notifications = await prisma.notification.findMany({
    where: { type: "WANT_MATCH", receiverId: me.id },
  });
  expect(notifications).toHaveLength(1);
  expect(notifications[0]).toMatchObject({ senderId: priya.id, bookId: book.id, bookTitle: "Piranesi" });
});

test("getting a copy moves it from the list to your shelf", async () => {
  const me = await makeUser("Me");
  const other = await makeUser("Other");
  const item = await addWantToRead(me.id, { ...wish("Dune"), isbn: "9780441172719" });

  // Only your own list
  expect(await moveToShelf(item!.id, other.id)).toBeNull();

  const book = await moveToShelf(item!.id, me.id);
  expect(book).toMatchObject({ title: "Dune", userId: me.id, isbn: "9780441172719" });
  expect(await getWantToRead(me.id)).toEqual([]);
});

test("a book on the list without a work borrows a friend's copy's, and keeps it", async () => {
  const me = await makeUser("Me");
  const priya = await makeUser("Priya");
  const stranger = await makeUser("Stranger");
  await createFriendship(me.id, priya.id);
  const theirs = await makeBook(priya.id, "Piranesi (Hardcover)");
  await prisma.book.update({ where: { id: theirs.id }, data: { openLibraryKey: "/works/OL1W" } });
  // A stranger's copy, under another work, doesn't count
  const strangers = await makeBook(stranger.id, "Circe");
  await prisma.book.update({ where: { id: strangers.id }, data: { openLibraryKey: "/works/OL2W" } });

  const piranesi = (await addWantToRead(me.id, wish("Piranesi")))!;
  const circe = (await addWantToRead(me.id, wish("Circe")))!;
  expect(await workKeyFromFriends(me.id, piranesi)).toBe("/works/OL1W");
  expect(await workKeyFromFriends(me.id, circe)).toBeNull();

  // Saved, it's asked once, and the friend's copy still matches
  await setWishWork(piranesi.id, me.id, "/works/OL1W");
  expect((await getWish(piranesi.id, me.id))?.openLibraryKey).toBe("/works/OL1W");
  const [item] = (await getWantToRead(me.id)).filter((entry) => entry.title === "Piranesi");
  expect(item.copies.map((copy) => copy.bookId)).toEqual([theirs.id]);

  // Someone else's list isn't yours to look at or change
  expect(await getWish(piranesi.id, stranger.id)).toBeNull();
  await setWishWork(piranesi.id, stranger.id, "/works/OL9W");
  expect((await getWish(piranesi.id, me.id))?.openLibraryKey).toBe("/works/OL1W");
});

test("a book comes off the list from its own page, by its work or its title", async () => {
  const dana = await makeUser("Dana");
  await addWantToRead(dana.id, { ...wish("Martyr!"), openLibraryKey: "/works/OL1W" });
  // On the list from an import, with no work yet
  await addWantToRead(dana.id, wish("Hamnet"));
  await addWantToRead(dana.id, wish("Circe"));

  expect(await removeWantedWork(dana.id, { title: "Martyr!", openLibraryKey: "/works/OL1W" })).toBe(1);
  expect(await removeWantedWork(dana.id, { title: "Hamnet", openLibraryKey: "/works/OL2W" })).toBe(1);
  expect((await getWantToRead(dana.id)).map((item) => item.title)).toEqual(["Circe"]);

  // Only your own list
  const kim = await makeUser("Kim");
  expect(await removeWantedWork(kim.id, { title: "Circe" })).toBe(0);
  expect(await getWantToRead(dana.id)).toHaveLength(1);
});
