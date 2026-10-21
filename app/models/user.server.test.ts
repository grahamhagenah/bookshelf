// @vitest-environment node
import { makeUser, prisma } from "../../test/db";

import {
  createFriendship,
  createNotification,
  generateShareToken,
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
        select: { following: { select: { id: true } }, followedBy: { select: { id: true } } },
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

    const request = await createNotification(viewer.id, owner.id, "Viewer Reader");
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
    const request = await createNotification(viewer.id, owner.id, "Viewer Reader");
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
