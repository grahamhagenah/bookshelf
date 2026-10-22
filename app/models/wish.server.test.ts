// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { createFriendship } from "./user.server";
import {
  addWantToRead,
  getWantToRead,
  moveToShelf,
  notifyWanters,
  sameWork,
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
