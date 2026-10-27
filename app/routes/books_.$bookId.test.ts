// @vitest-environment node
import { createFriendship } from "~/models/user.server";
import { sessionStorage } from "~/session.server";

import { makeBook, makeUser, prisma } from "../../test/db";
import { routeArgs, statusOf } from "../../test/route";

import { action } from "./books_.$bookId";

// A post to a book's page, signed in as someone
async function post(userId: string, bookId: string, fields: Record<string, string>) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return action(
    routeArgs(
      new Request(`http://localhost/books/${bookId}`, {
        method: "POST",
        body,
        headers: { Cookie: await sessionStorage.commitSession(session) },
      }),
      { bookId },
    ),
  ).catch((error: unknown) => error);
}

test("on a friend's copy you've never had, your marks go on the book itself", async () => {
  const me = await makeUser("Me");
  const sam = await makeUser("Sam");
  await createFriendship(me.id, sam.id);
  const theirs = await makeBook(sam.id, "Exhalation");
  await prisma.book.update({ where: { id: theirs.id }, data: { openLibraryKey: "/works/OL20149336W" } });

  await post(me.id, theirs.id, { intent: "toggleRead", read: "true" });
  await post(me.id, theirs.id, { intent: "toggleLove", loved: "true" });
  await post(me.id, theirs.id, { intent: "saveNote", body: "Read it at the library." });

  const note = await prisma.workNote.findUnique({
    where: { userId_workKey: { userId: me.id, workKey: "/works/OL20149336W" } },
  });
  expect(note).toMatchObject({ loved: true, body: "Read it at the library.", title: "Exhalation" });
  expect(note?.readAt).not.toBeNull();
  // Their copy is untouched
  expect(await prisma.readerNote.count({ where: { bookId: theirs.id } })).toBe(0);
});

test("readers of the copy still note the copy, and a copy without a work can't take a stranger's note", async () => {
  const me = await makeUser("Me");
  const mine = await makeBook(me.id, "Dune");
  await prisma.book.update({ where: { id: mine.id }, data: { openLibraryKey: "/works/OL893415W" } });
  await post(me.id, mine.id, { intent: "toggleLove", loved: "true" });
  expect(await prisma.readerNote.count({ where: { bookId: mine.id, userId: me.id, loved: true } })).toBe(1);
  expect(await prisma.workNote.count({ where: { userId: me.id } })).toBe(0);

  // No Open Library work to put it on, and not a reader: refused as before
  const sam = await makeUser("Sam");
  const theirs = await makeBook(sam.id, "Circe");
  const refused = await post(me.id, theirs.id, { intent: "toggleLove", loved: "true" });
  expect(statusOf(refused)).toBe(403);
});
