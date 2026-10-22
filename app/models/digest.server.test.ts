// @vitest-environment node
import { renderDigest } from "~/email.server";

import { makeBook, makeUser, prisma } from "../../test/db";

import { lendBook } from "./book.server";
import { buildDigest, digestIsEmpty, getDigestRecipients } from "./digest.server";
import { createFriendship } from "./user.server";

const DAY = 24 * 60 * 60 * 1000;

test("a quiet week has nothing to send", async () => {
  const loner = await makeUser("Loner");
  expect(digestIsEmpty(await buildDigest(loner.id))).toBe(true);
});

test("the digest gathers friends' additions, due dates and want-to-read matches", async () => {
  const me = await makeUser("Me");
  const maya = await makeUser("Maya");
  await createFriendship(me.id, maya.id);
  await makeBook(maya.id, "The Overstory");
  const lent = await makeBook(me.id, "Piranesi");
  await lendBook(lent.id, maya.id);
  await prisma.book.update({ where: { id: lent.id }, data: { dueDate: new Date(Date.now() - 2 * DAY) } });
  await prisma.notification.create({
    data: {
      type: "WANT_MATCH",
      senderId: maya.id,
      receiverId: me.id,
      senderName: "Maya Reader",
      bookTitle: "The Overstory",
    },
  });

  const digest = await buildDigest(me.id);
  expect(digest.activity.map((item) => item.kind)).toEqual(["added"]);
  expect(digest.due).toEqual([
    expect.objectContaining({ bookId: lent.id, title: "Piranesi", person: "Maya Reader", direction: "lent", days: -2 }),
  ]);
  expect(digest.wanted).toEqual([{ title: "The Overstory", friend: "Maya Reader", bookId: null }]);

  const { subject, html, text } = renderDigest({ toName: "Me", digest });
  expect(subject).toContain("Stacks");
  expect(html).toContain("The Overstory");
  expect(html).toContain("2 days late");
  expect(text).toContain("Piranesi");
});

test("only real accounts who want email and have something going on get one", async () => {
  const quiet = await makeUser("Quiet");
  const social = await makeUser("Social");
  const friend = await makeUser("Friend");
  await createFriendship(social.id, friend.id);
  const optedOut = await makeUser("Out");
  await createFriendship(optedOut.id, friend.id);
  await prisma.user.update({ where: { id: optedOut.id }, data: { weeklyDigest: false } });
  // Turning off request emails leaves the roundup on
  const requestsOff = await makeUser("RequestsOff");
  await createFriendship(requestsOff.id, friend.id);
  await prisma.user.update({ where: { id: requestsOff.id }, data: { emailNotifications: false } });
  const demo = await makeUser("Demo", { demoGroup: "digest-test" });
  await createFriendship(demo.id, friend.id);
  const unconfirmed = await makeUser("Unconfirmed", { emailVerifiedAt: null });
  await createFriendship(unconfirmed.id, friend.id);

  const ids = (await getDigestRecipients()).map((user) => user.id);
  expect(ids).toContain(social.id);
  expect(ids).toContain(friend.id);
  expect(ids).toContain(requestsOff.id);
  expect(ids).not.toContain(quiet.id);
  expect(ids).not.toContain(optedOut.id);
  expect(ids).not.toContain(demo.id);
  expect(ids).not.toContain(unconfirmed.id);
});
