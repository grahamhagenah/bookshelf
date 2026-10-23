// @vitest-environment node
import bcrypt from "bcryptjs";

import { makeUser, prisma } from "../test/db";

import { verifyLogin } from "./models/user.server";
import { makeResetToken } from "./reset-password";
import {
  checkResetToken,
  requestPasswordReset,
  resetPasswordWithToken,
} from "./reset-password.server";

process.env.SESSION_SECRET ??= "test-secret";
const secret = () => process.env.SESSION_SECRET!;

async function userWithPassword(name: string, data: Parameters<typeof makeUser>[1] = {}) {
  const user = await makeUser(name, data);
  const hash = await bcrypt.hash("old-password", 4);
  await prisma.password.create({ data: { userId: user.id, hash } });
  return { ...user, hash };
}

const sentAt = async (id: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id } })).passwordResetSentAt;

test("asking for a reset changes nothing but sends a link", async () => {
  const user = await userWithPassword("Asker");
  await requestPasswordReset(` ${user.email.toUpperCase()} `);
  expect(await sentAt(user.id)).not.toBe(null);
  // The old password still works until the link is used
  expect((await verifyLogin(user.email, "old-password"))?.id).toBe(user.id);
});

test("a second request straight away is held back", async () => {
  const user = await userWithPassword("Eager");
  await requestPasswordReset(user.email);
  const first = await sentAt(user.id);
  await requestPasswordReset(user.email);
  expect(await sentAt(user.id)).toEqual(first);
});

test("unknown and demo addresses are quietly ignored", async () => {
  await expect(requestPasswordReset("nobody@example.test")).resolves.toBeUndefined();
  const demo = await userWithPassword("Demo", { demoGroup: "reset-test" });
  await requestPasswordReset(demo.email);
  expect(await sentAt(demo.id)).toBe(null);
});

test("a link sets the new password once, and confirms the address", async () => {
  const user = await userWithPassword("Resetter", { emailVerifiedAt: null });
  const token = makeResetToken(user.id, user.hash, secret());
  expect(await checkResetToken(token)).toBe(user.id);

  expect(await resetPasswordWithToken(token, "new-password")).toBe(user.id);
  expect(await verifyLogin(user.email, "new-password")).not.toBe(null);
  expect(await verifyLogin(user.email, "old-password")).toBe(null);
  const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(after.emailVerifiedAt).not.toBe(null);

  // Used once: the password it was sent for is gone
  expect(await checkResetToken(token)).toBe(null);
  expect(await resetPasswordWithToken(token, "third-password")).toBe(null);
  expect(await verifyLogin(user.email, "new-password")).not.toBe(null);
});
