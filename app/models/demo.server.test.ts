// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { getReadAt } from "./book.server";
import {
  canInteract,
  createDemoSandbox,
  deleteDemoGroup,
  respondAsDemoPersona,
} from "./demo.server";
import { shelfIds } from "./household.server";
import { createNotification } from "./user.server";

describe("createDemoSandbox", () => {
  test("builds a lived-in library for the visitor", async () => {
    const visitorId = await createDemoSandbox();
    const visitor = await prisma.user.findUniqueOrThrow({
      where: { id: visitorId },
      select: {
        demoGroup: true,
        shareToken: true,
        following: { select: { firstname: true } },
      },
    });

    expect(visitor.demoGroup).not.toBeNull();
    // No link yet, so the demo shows the "Share your bookshelf" prompt
    expect(visitor.shareToken).toBeNull();
    expect(visitor.following.map((f) => f.firstname).sort()).toEqual([
      "Maya",
      "Priya",
      "Sam",
    ]);

    const own = await prisma.book.count({ where: { userId: visitorId } });
    const lentOut = await prisma.book.count({
      where: { userId: visitorId, borrowerId: { not: null } },
    });
    const borrowed = await prisma.book.count({ where: { borrowerId: visitorId } });
    expect(own).toBe(14);
    expect(lentOut).toBe(5);
    expect(borrowed).toBe(4);

    const loved = await prisma.readerNote.count({
      where: { userId: visitorId, loved: true },
    });
    expect(loved).toBeGreaterThan(10);

    // Noah shares the visitor's shelf, so it holds both their books
    const shelf = await shelfIds(visitorId);
    const housemates = await prisma.user.findMany({
      where: { id: { in: shelf, not: visitorId } },
      select: { firstname: true },
    });
    expect(housemates.map((person) => person.firstname)).toEqual(["Noah"]);
    expect(await prisma.book.count({ where: { userId: { in: shelf } } })).toBe(19);

    // A book the visitor both hearted and read shows as read
    const circe = await prisma.book.findFirstOrThrow({
      where: { userId: visitorId, title: "Circe" },
      select: { id: true, userId: true, readAt: true },
    });
    expect(await getReadAt(visitorId, circe)).not.toBeNull();
  });

  test("deleteDemoGroup removes the whole sandbox", async () => {
    const visitorId = await createDemoSandbox();
    const { demoGroup } = await prisma.user.findUniqueOrThrow({
      where: { id: visitorId },
    });

    await deleteDemoGroup(demoGroup!);

    expect(await prisma.user.count({ where: { demoGroup } })).toBe(0);
    expect(await prisma.book.count({ where: { user: { demoGroup } } })).toBe(0);
  });
});

test("canInteract keeps demo and real accounts apart", async () => {
  const real = await makeUser("Real");
  const otherReal = await makeUser("Other");
  const demo = await makeUser("Demo", { demoGroup: "group-a" });
  const sameDemo = await makeUser("Same", { demoGroup: "group-a" });
  const otherDemo = await makeUser("Elsewhere", { demoGroup: "group-b" });

  expect(await canInteract(real.id, otherReal.id)).toBe(true);
  expect(await canInteract(demo.id, sameDemo.id)).toBe(true);
  expect(await canInteract(real.id, demo.id)).toBe(false);
  expect(await canInteract(demo.id, otherDemo.id)).toBe(false);
});

describe("respondAsDemoPersona", () => {
  test("demo friends accept friend requests straight away", async () => {
    const visitor = await makeUser("Visitor", { demoGroup: "group-c" });
    const persona = await makeUser("Persona", { demoGroup: "group-c" });
    const request = await createNotification(visitor.id, persona.id, "Visitor Reader");

    await respondAsDemoPersona(request.id);

    const friends = await prisma.user.count({
      where: { id: visitor.id, following: { some: { id: persona.id } } },
    });
    expect(friends).toBe(1);
  });

  test("demo friends lend a requested book", async () => {
    const visitor = await makeUser("Visitor", { demoGroup: "group-d" });
    const persona = await makeUser("Persona", { demoGroup: "group-d" });
    const book = await makeBook(persona.id, "The Martian");
    const request = await prisma.notification.create({
      data: {
        type: "BOOK_REQUEST",
        senderId: visitor.id,
        receiverId: persona.id,
        senderName: "Visitor Reader",
        bookId: book.id,
        bookTitle: book.title,
      },
    });

    await respondAsDemoPersona(request.id);

    const lent = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(lent.borrowerId).toBe(visitor.id);
    const approved = await prisma.notification.count({
      where: { type: "BOOK_APPROVED", receiverId: visitor.id },
    });
    expect(approved).toBe(1);
  });

  test("real people are never answered for", async () => {
    const sender = await makeUser("Sender");
    const real = await makeUser("Real");
    const request = await createNotification(sender.id, real.id, "Sender Reader");

    await respondAsDemoPersona(request.id);

    const friends = await prisma.user.count({
      where: { id: sender.id, following: { some: { id: real.id } } },
    });
    expect(friends).toBe(0);
  });
});
