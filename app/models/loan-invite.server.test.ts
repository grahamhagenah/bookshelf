// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";
import { makeInviteToken } from "../loan-invite";
import { requestPasswordReset } from "../reset-password.server";

import {
  claimInvite,
  getInvite,
  lendByEmail,
} from "./loan-invite.server";
import { getFriendStatus, searchUsers, verifyLogin } from "./user.server";

process.env.SESSION_SECRET ??= "test-secret";
const secret = () => process.env.SESSION_SECRET!;

const address = () => `maya.${crypto.randomUUID()}@example.test`;

test("lending to someone new makes a waiting account and lends it the book", async () => {
  const jordan = await makeUser("Jordan");
  const book = await makeBook(jordan.id, "Piranesi");
  const email = address();

  const result = await lendByEmail(jordan.id, book, { name: "Maya Chen", email: ` ${email.toUpperCase()} `, weeks: 3 });
  expect(result).toMatchObject({ ok: true, invited: true });
  if (!result.ok) throw new Error("not lent");

  const maya = await prisma.user.findUniqueOrThrow({ where: { email }, include: { password: true } });
  expect(maya).toMatchObject({ firstname: "Maya", surname: "Chen", discoverable: false, password: null });
  expect(maya.invitedAt).not.toBe(null);
  // A loan like any other
  const lent = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
  expect(lent.borrowerId).toBe(maya.id);
  expect(lent.dueDate).not.toBe(null);
  // Out of search, and no one's friend yet
  expect((await searchUsers("Maya", jordan.id)).map((user) => user.id)).not.toContain(maya.id);
  expect(await getFriendStatus(jordan.id, maya.id)).toBe("none");

  // A second book to the same address uses the same account
  const another = await makeBook(jordan.id, "Klara and the Sun");
  expect(await lendByEmail(jordan.id, another, { name: "Maya", email, weeks: 2 })).toMatchObject({
    ok: true,
    borrowerId: maya.id,
  });
});

test("claiming the account sets a password, confirms the address and makes friends", async () => {
  const jordan = await makeUser("Jordan");
  const book = await makeBook(jordan.id, "Piranesi");
  const email = address();
  const result = await lendByEmail(jordan.id, book, { name: "Maya", email, weeks: 3 });
  if (!result.ok) throw new Error("not lent");
  const token = makeInviteToken(result.borrowerId, email, secret());

  const invite = await getInvite(token);
  expect(invite && invite !== "claimed" ? invite.borrowedBooks.map((b) => b.title) : null).toEqual(["Piranesi"]);

  const claimed = await claimInvite(token, { firstname: "Maya", surname: "Chen", password: "a-good-password" });
  expect(claimed).toMatchObject({ userId: result.borrowerId, bookId: book.id, lenderName: "Jordan Reader" });

  const maya = await prisma.user.findUniqueOrThrow({ where: { id: result.borrowerId } });
  expect(maya).toMatchObject({ invitedAt: null, discoverable: true, surname: "Chen" });
  expect(maya.emailVerifiedAt).not.toBe(null);
  expect((await verifyLogin(email, "a-good-password"))?.id).toBe(maya.id);
  expect(await getFriendStatus(maya.id, jordan.id)).toBe("friends");
  expect(
    await prisma.notification.count({ where: { type: "FRIEND_JOINED", receiverId: jordan.id, senderId: maya.id } }),
  ).toBe(1);

  // The link works once
  expect(await getInvite(token)).toBe("claimed");
  expect(await claimInvite(token, { firstname: "X", surname: "", password: "another-password" })).toBe(null);
});

test("a link for an address that's since changed, or made up, doesn't claim anything", async () => {
  const jordan = await makeUser("Jordan");
  const result = await lendByEmail(jordan.id, await makeBook(jordan.id), { name: "Maya", email: address(), weeks: 3 });
  if (!result.ok) throw new Error("not lent");
  expect(await getInvite(makeInviteToken(result.borrowerId, "someone-else@example.test", secret()))).toBe(null);
  expect(await getInvite("not-a-token")).toBe(null);
});

test("lending by email to someone already on Stacks lends it and asks to be friends", async () => {
  const jordan = await makeUser("Jordan");
  const sam = await makeUser("Sam");
  const book = await makeBook(jordan.id);
  expect(await lendByEmail(jordan.id, book, { name: "Sam", email: sam.email, weeks: 3 })).toEqual({
    ok: true,
    borrowerId: sam.id,
    invited: false,
  });
  expect(await getFriendStatus(jordan.id, sam.id)).toBe("requested");
});

test("only confirmed, real accounts lend by email, and only a few new people a day", async () => {
  const unconfirmed = await makeUser("Unconfirmed", { emailVerifiedAt: null });
  expect(
    await lendByEmail(unconfirmed.id, await makeBook(unconfirmed.id), { name: "Maya", email: address(), weeks: 3 }),
  ).toMatchObject({ ok: false });

  const demo = await makeUser("Demo", { demoGroup: "loan-invite-test" });
  expect(
    await lendByEmail(demo.id, await makeBook(demo.id), { name: "Maya", email: address(), weeks: 3 }),
  ).toMatchObject({ ok: false });

  const busy = await makeUser("Busy");
  for (let i = 0; i < 5; i++) {
    expect(
      await lendByEmail(busy.id, await makeBook(busy.id, `Book ${i}`), { name: "Friend", email: address(), weeks: 3 }),
    ).toMatchObject({ ok: true });
  }
  expect(
    await lendByEmail(busy.id, await makeBook(busy.id, "One more"), { name: "Friend", email: address(), weeks: 3 }),
  ).toMatchObject({ ok: false });
  expect(
    await lendByEmail(busy.id, await makeBook(busy.id, "Bad address"), { name: "Friend", email: "nope", weeks: 3 }),
  ).toMatchObject({ ok: false });
});

test("a password reset for a waiting account sends the loan link instead", async () => {
  const jordan = await makeUser("Jordan");
  const email = address();
  const result = await lendByEmail(jordan.id, await makeBook(jordan.id), { name: "Maya", email, weeks: 3 });
  if (!result.ok) throw new Error("not lent");
  await prisma.user.update({ where: { id: result.borrowerId }, data: { verificationSentAt: null } });
  await requestPasswordReset(email);
  const maya = await prisma.user.findUniqueOrThrow({ where: { id: result.borrowerId } });
  expect(maya.verificationSentAt).not.toBe(null);
  expect(maya.passwordResetSentAt).toBe(null);
});
