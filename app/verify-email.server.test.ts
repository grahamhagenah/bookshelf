// @vitest-environment node
import { makeUser, prisma } from "../test/db";

import { updateUser } from "./models/user.server";
import { makeVerifyToken } from "./verify-email";
import { confirmEmail, sendVerification } from "./verify-email.server";

process.env.SESSION_SECRET ??= "test-secret";

const verifiedAt = async (id: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id } })).emailVerifiedAt;

test("a good link confirms the address it was sent to", async () => {
  const user = await makeUser("New", { emailVerifiedAt: null });
  expect(await confirmEmail(makeVerifyToken(user.id, user.email, process.env.SESSION_SECRET!))).toBe(
    true,
  );
  expect(await verifiedAt(user.id)).not.toBe(null);
});

test("a link for an old address confirms nothing", async () => {
  const user = await makeUser("Mover", { emailVerifiedAt: null });
  const token = makeVerifyToken(user.id, "old@example.test", process.env.SESSION_SECRET!);
  expect(await confirmEmail(token)).toBe(false);
  expect(await verifiedAt(user.id)).toBe(null);
});

test("changing your email asks you to confirm again", async () => {
  const user = await makeUser("Changer");
  const same = await updateUser(user.id, { email: user.email, firstname: "Changer" });
  expect(same.emailChanged).toBe(false);
  expect(await verifiedAt(user.id)).not.toBe(null);

  const moved = await updateUser(user.id, { email: `moved.${user.email}` });
  expect(moved.emailChanged).toBe(true);
  expect(await verifiedAt(user.id)).toBe(null);
});

test("the confirmation email can't be sent twice in a row", async () => {
  const user = await makeUser("Eager", { emailVerifiedAt: null });
  await sendVerification(user.id);
  const sentAt = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).verificationSentAt;
  expect(sentAt).not.toBe(null);
  expect(await sendVerification(user.id)).toEqual({ sent: false, wait: true });
});

test("confirmed and demo accounts are never sent one", async () => {
  const done = await makeUser("Done");
  const demo = await makeUser("Demo", { demoGroup: "verify-test", emailVerifiedAt: null });
  expect(await sendVerification(done.id)).toEqual({ sent: false });
  expect(await sendVerification(demo.id)).toEqual({ sent: false });
});
