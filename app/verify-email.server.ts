import { prisma } from "~/db.server";
import { sendVerificationEmail } from "~/email.server";
import { canResend, makeVerifyToken, readVerifyToken } from "~/verify-email";

const secret = () => process.env.SESSION_SECRET as string;

// Emails a confirmation link, unless one went out a moment ago
export async function sendVerification(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstname: true,
      demoGroup: true,
      emailVerifiedAt: true,
      verificationSentAt: true,
    },
  });
  if (!user || user.demoGroup || user.emailVerifiedAt) return { sent: false };
  if (!canResend(user.verificationSentAt)) return { sent: false, wait: true };
  await prisma.user.update({ where: { id: user.id }, data: { verificationSentAt: new Date() } });
  const result = await sendVerificationEmail({
    toEmail: user.email,
    toName: user.firstname,
    token: makeVerifyToken(user.id, user.email, secret()),
  });
  return { sent: result.success };
}

// Marks the address confirmed, if the link is good and still matches it
export async function confirmEmail(token: string) {
  const claim = readVerifyToken(token, secret());
  if (!claim) return false;
  const user = await prisma.user.findUnique({
    where: { id: claim.userId },
    select: { email: true, emailVerifiedAt: true },
  });
  if (!user || user.email !== claim.email) return false;
  if (!user.emailVerifiedAt) {
    await prisma.user.update({ where: { id: claim.userId }, data: { emailVerifiedAt: new Date() } });
  }
  return true;
}
