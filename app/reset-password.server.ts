import { hash } from "bcryptjs";

import { prisma } from "~/db.server";
import { sendPasswordResetEmail } from "~/email.server";
import { sendLoanInvite } from "~/models/loan-invite.server";
import { makeResetToken, readResetToken, stampMatches } from "~/reset-password";
import { normalizeEmail } from "~/utils";
import { canResend } from "~/verify-email";

const secret = () => process.env.SESSION_SECRET as string;

// Emails a reset link. Nothing about the account changes until the link
// is used, so anyone typing your address in can't lock you out. Says
// nothing about whether the address has an account.
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: {
      id: true,
      email: true,
      firstname: true,
      demoGroup: true,
      passwordResetSentAt: true,
      invitedAt: true,
      password: { select: { hash: true } },
    },
  });
  // Lent a book before they joined: the loan email's link sets a password
  if (user?.invitedAt) {
    await sendLoanInvite(user.id);
    return;
  }
  if (!user?.password || user.demoGroup) return;
  if (!canResend(user.passwordResetSentAt)) return;
  await prisma.user.update({ where: { id: user.id }, data: { passwordResetSentAt: new Date() } });
  await sendPasswordResetEmail({
    toEmail: user.email,
    toName: user.firstname || "there",
    token: makeResetToken(user.id, user.password.hash, secret()),
  });
}

// Whose link this is, if it still works
export async function checkResetToken(token: string) {
  const claim = readResetToken(token, secret());
  if (!claim) return null;
  const password = await prisma.password.findUnique({
    where: { userId: claim.userId },
    select: { hash: true },
  });
  if (!password || !stampMatches(claim.stamp, password.hash, secret())) return null;
  return claim.userId;
}

// Sets the new password if the link still works, and returns the account.
// Using the link proves the address is theirs, so it's confirmed too.
export async function resetPasswordWithToken(token: string, newPassword: string) {
  const userId = await checkResetToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: { update: { hash: await hash(newPassword, 10) } },
      passwordResetSentAt: null,
      ...(user.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }),
    },
  });
  return userId;
}
