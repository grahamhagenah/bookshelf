// @vitest-environment node
import crypto from "node:crypto";

import { makeBook, makeUser, prisma } from "../../test/db";

import {
  createFriendship,
  createNotification,
  createUser,
  getUserByEmail,
  updateUser,
  verifyLogin,
  createReminderNotification,
  getAnnouncementRecipients,
  createBookApprovedNotification,
  createBookDeclinedNotification,
  getLoanReply,
  generateShareToken,
  giveDefaultHandle,
  handleFromName,
  getSuggestedFriends,
  searchUsers,
  getFriendStatus,
  getUserByShareToken,
  markNotificationAsRead,
  revokeShareToken,
} from "./user.server";

describe("createFriendship", () => {
  test("makes both people friends with each other", async () => {
    const a = await makeUser("Ada");
    const b = await makeUser("Ben");
    await createFriendship(a.id, b.id);

    for (const [me, them] of [
      [a, b],
      [b, a],
    ]) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: me.id },
        select: {
          following: { select: { id: true } },
          followedBy: { select: { id: true } },
        },
      });
      expect(user.following.map((u) => u.id)).toEqual([them.id]);
      expect(user.followedBy.map((u) => u.id)).toEqual([them.id]);
    }
  });
});

describe("getFriendStatus", () => {
  test("knows you're looking at your own shelf", async () => {
    const me = await makeUser("Me");
    expect(await getFriendStatus(me.id, me.id)).toBe("self");
  });

  test("walks from strangers to friends", async () => {
    const viewer = await makeUser("Viewer");
    const owner = await makeUser("Owner");
    expect(await getFriendStatus(viewer.id, owner.id)).toBe("none");

    const request = await createNotification(
      viewer.id,
      owner.id,
      "Viewer Reader",
    );
    expect(await getFriendStatus(viewer.id, owner.id)).toBe("requested");
    // From the owner's side, someone is waiting on them
    expect(await getFriendStatus(owner.id, viewer.id)).toBe("invited");

    await createFriendship(owner.id, viewer.id);
    await markNotificationAsRead(request.id, "accepted");
    expect(await getFriendStatus(viewer.id, owner.id)).toBe("friends");
    expect(await getFriendStatus(owner.id, viewer.id)).toBe("friends");
  });

  test("a declined request no longer counts as pending", async () => {
    const viewer = await makeUser("Viewer");
    const owner = await makeUser("Owner");
    const request = await createNotification(
      viewer.id,
      owner.id,
      "Viewer Reader",
    );
    await markNotificationAsRead(request.id, "declined");
    expect(await getFriendStatus(viewer.id, owner.id)).toBe("none");
  });
});

describe("share links", () => {
  test("a token finds its owner until it's revoked", async () => {
    const owner = await makeUser("Owner");
    const token = await generateShareToken(owner.id);

    expect(await getUserByShareToken(token)).toMatchObject({
      id: owner.id,
      firstname: "Owner",
      demoGroup: null,
    });

    await revokeShareToken(owner.id);
    expect(await getUserByShareToken(token)).toBeNull();
  });

  test("making a new link retires the old one", async () => {
    const owner = await makeUser("Owner");
    const first = await generateShareToken(owner.id);
    const second = await generateShareToken(owner.id);
    expect(second).not.toBe(first);
    expect(await getUserByShareToken(first)).toBeNull();
    expect(await getUserByShareToken(second)).not.toBeNull();
  });
});

describe("createReminderNotification", () => {
  test("says the book is due soon until it's actually overdue", async () => {
    const owner = await makeUser("Ada");
    const borrower = await makeUser("Ben");
    const book = await makeBook(owner.id);

    const nudge = await createReminderNotification(
      owner.id,
      borrower.id,
      "Ada Lovelace",
      book.id,
      book.title,
      false,
    );
    const late = await createReminderNotification(
      owner.id,
      borrower.id,
      "Ada Lovelace",
      book.id,
      book.title,
      true,
    );

    const types = await prisma.notification.findMany({
      where: { id: { in: [nudge.id, late.id] } },
      orderBy: { createdAt: "asc" },
      select: { type: true, receiverId: true },
    });
    expect(types.map((n) => n.type)).toEqual([
      "DUE_SOON_REMINDER",
      "OVERDUE_REMINDER",
    ]);
    expect(types.every((n) => n.receiverId === borrower.id)).toBe(true);
  });
});

describe("discoverable", () => {
  test("someone who turned it off is found neither by search nor among new people", async () => {
    const me = await makeUser("Ada");
    const open = await makeUser("Ben");
    const hidden = await makeUser("Cal");
    await prisma.user.update({
      where: { id: hidden.id },
      data: { discoverable: false },
    });

    const found = await searchUsers(hidden.email.split("@")[0], me.id);
    expect(found.map((u) => u.id)).not.toContain(hidden.id);

    const suggested = await getSuggestedFriends(me.id, 50);
    const ids = suggested.map((u) => u.id);
    expect(ids).toContain(open.id);
    expect(ids).not.toContain(hidden.id);
  });
});

test("an address typed with capitals or spaces still logs in", async () => {
  const typed = `  Jane.${crypto.randomUUID()}@Example.TEST `;
  const user = await createUser(typed, "password123", "Jane", "Reader");
  const stored = typed.trim().toLowerCase();
  expect(user.email).toBe(stored);
  expect((await verifyLogin(stored, "password123"))?.id).toBe(user.id);
  expect((await verifyLogin(typed, "password123"))?.id).toBe(user.id);
  expect((await getUserByEmail(stored.toUpperCase()))?.id).toBe(user.id);
});

test("a changed address is stored the same way", async () => {
  const user = await makeUser("Mover");
  const updated = await updateUser(user.id, { email: ` NEW.${user.email.toUpperCase()}` });
  expect(updated.email).toBe(`new.${user.email}`);
  // The same address in other capitals isn't a change
  const again = await updateUser(user.id, { email: updated.email.toUpperCase() });
  expect(again.emailChanged).toBe(false);
});

describe("getAnnouncementRecipients", () => {
  test("only people who confirmed their email and kept notifications on, never demo visitors", async () => {
    const yes = await makeUser("Yes");
    const unverified = await makeUser("Unverified", { emailVerifiedAt: null });
    const demo = await makeUser("Demo", { demoGroup: crypto.randomUUID() });
    const off = await makeUser("Off");
    await prisma.user.update({ where: { id: off.id }, data: { emailNotifications: false } });

    const ids = (await getAnnouncementRecipients()).map((person) => person.id);
    expect(ids).toContain(yes.id);
    expect(ids).not.toContain(unverified.id);
    expect(ids).not.toContain(demo.id);
    expect(ids).not.toContain(off.id);
  });
});

describe("answering a borrow request", () => {
  test("a decline reaches the borrower with the owner's note", async () => {
    const owner = await makeUser("Maya");
    const borrower = await makeUser("Sam");
    const book = await makeBook(owner.id, "Piranesi");
    await createBookDeclinedNotification(owner.id, borrower.id, "Maya Reader", "Piranesi", book.id, "  My sister has it until December.  ");
    const notice = await prisma.notification.findFirstOrThrow({ where: { receiverId: borrower.id, type: "BOOK_DECLINED" } });
    expect(notice.bookId).toBe(book.id);
    expect(notice.message).toBe("My sister has it until December.");
  });

  test("the lender's reply is found for the borrower, and only theirs", async () => {
    const owner = await makeUser("Maya");
    const borrower = await makeUser("Sam");
    const other = await makeUser("Ada");
    const book = await makeBook(owner.id, "Circe");
    await createBookApprovedNotification(owner.id, borrower.id, "Maya Reader", "Circe", book.id, "On the porch Saturday.");
    expect((await getLoanReply(book.id, borrower.id))?.message).toBe("On the porch Saturday.");
    expect(await getLoanReply(book.id, other.id)).toBeNull();
    // A yes with nothing said leaves nothing to show
    const quiet = await makeBook(owner.id, "Dune");
    await createBookApprovedNotification(owner.id, borrower.id, "Maya Reader", "Dune", quiet.id, "   ");
    expect(await getLoanReply(quiet.id, borrower.id)).toBeNull();
  });
});

describe("default handles", () => {
  test("a name becomes letters and numbers", () => {
    expect(handleFromName("Jordan", "Avery")).toBe("jordanavery");
    expect(handleFromName("Zoë", "O'Brien-Smith")).toBe("zoeobriensmith");
    expect(handleFromName("李", "")).toBe("reader");
    expect(handleFromName("Bartholomew", "Featherstonehaugh").length).toBeLessThanOrEqual(21);
  });

  test("sharing gives the page an address from the name, numbered when taken", async () => {
    const surname = `Q${crypto.randomUUID().slice(0, 6).replace(/[^a-z]/g, "q")}`;
    const name = (first: string) =>
      prisma.user.create({
        data: {
          email: `${crypto.randomUUID()}@example.test`,
          firstname: first,
          surname,
          emailVerifiedAt: new Date(),
        },
      });
    const first = await name("Robin");
    const second = await name("Robin");
    await generateShareToken(first.id);
    await generateShareToken(second.id);
    const base = handleFromName("Robin", surname);
    const handles = await prisma.user.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { id: true, handle: true },
    });
    expect(handles.find((u) => u.id === first.id)?.handle).toBe(base);
    expect(handles.find((u) => u.id === second.id)?.handle).toBe(`${base}2`);
  });

  test("a reserved or too-short name takes a number", async () => {
    const admin = await prisma.user.create({
      data: { email: `${crypto.randomUUID()}@example.test`, firstname: "Ad", surname: "Min", shareToken: crypto.randomUUID() },
    });
    expect(await giveDefaultHandle(admin.id)).toMatch(/^admin\d+$/);
  });

  test("not for demo accounts, nor without sharing, nor over one picked", async () => {
    const demo = await makeUser("Demo", { demoGroup: "g1", shareToken: crypto.randomUUID() });
    expect(await giveDefaultHandle(demo.id)).toBeNull();

    const quiet = await makeUser("Quiet");
    expect(await giveDefaultHandle(quiet.id)).toBeNull();

    const picked = await makeUser("Picked", { shareToken: crypto.randomUUID() });
    await prisma.user.update({ where: { id: picked.id }, data: { handle: `mine_${picked.id.slice(-6)}` } });
    expect(await giveDefaultHandle(picked.id)).toBe(`mine_${picked.id.slice(-6)}`);
  });
});
