// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import {
  createFriendship,
  createNotification,
  createReminderNotification,
  generateShareToken,
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
