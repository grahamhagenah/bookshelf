import { hash } from "bcryptjs";

import { prisma } from "~/db.server";
import { sendLoanInviteEmail } from "~/email.server";
import type { Book, User } from "~/generated/prisma/client";
import { INVITES_PER_DAY, makeInviteToken, readInviteToken, splitName } from "~/loan-invite";
import { normalizeEmail, validateEmail } from "~/utils";
import { canResend } from "~/verify-email";

import { lendToFriend } from "./book.server";
import { canInteract } from "./demo.server";
import { shelfIds } from "./household.server";
import {
  createBookApprovedNotification,
  createFriendship,
  createNotification,
  getFriendStatus,
} from "./user.server";

// Lending a book by email address. The person may already be a friend,
// may be on Stacks without being one, or may not be on Stacks at all. In
// that last case they get an account that waits for them, with no
// password and out of search, so the loan works like any other until
// they claim it from the email.

const secret = () => process.env.SESSION_SECRET as string;
const DAY = 24 * 60 * 60 * 1000;

type LendResult =
  | { ok: true; borrowerId: string; invited: boolean }
  | { ok: false; error: string };

export async function lendByEmail(
  lenderId: User["id"],
  book: Pick<Book, "id" | "title">,
  { name, email, weeks }: { name: string; email: string; weeks: number },
): Promise<LendResult> {
  const lender = await prisma.user.findUnique({
    where: { id: lenderId },
    select: { firstname: true, surname: true, demoGroup: true, emailVerifiedAt: true },
  });
  if (!lender) return { ok: false, error: "Something went wrong. Please try again." };
  if (lender.demoGroup) {
    return { ok: false, error: "The demo can't send email. Lend to one of the demo friends instead." };
  }
  if (!lender.emailVerifiedAt) {
    return { ok: false, error: "Confirm your email first, so they know the email is really from you." };
  }
  if (!name.trim()) return { ok: false, error: "Add their name." };
  if (!validateEmail(email.trim())) return { ok: false, error: "That email address doesn't look right." };

  const address = normalizeEmail(email.trim());
  const lenderName = `${lender.firstname} ${lender.surname}`.trim();
  const shelf = await shelfIds(lenderId);
  const existing = await prisma.user.findUnique({
    where: { email: address },
    select: { id: true, invitedAt: true },
  });
  if (existing && shelf.includes(existing.id)) {
    return { ok: false, error: "That's someone on your own shelf." };
  }

  // Someone already on Stacks: lend it, and ask to be friends if you aren't
  if (existing && !existing.invitedAt) {
    if (!(await canInteract(lenderId, existing.id))) {
      return { ok: false, error: "That address can't borrow from you." };
    }
    await lendToFriend(book.id, lenderId, existing.id, weeks);
    await createBookApprovedNotification(lenderId, existing.id, lenderName, book.title, book.id);
    if ((await getFriendStatus(lenderId, existing.id)) === "none") {
      await createNotification(lenderId, existing.id, lenderName);
    }
    return { ok: true, borrowerId: existing.id, invited: false };
  }

  // Not on Stacks yet. A few a day per shelf, so this can't send email to
  // a list of strangers.
  const recentInvites = await prisma.lendingHistory.count({
    where: {
      book: { userId: { in: shelf } },
      borrowedAt: { gte: new Date(Date.now() - DAY) },
      borrower: { invitedAt: { not: null } },
    },
  });
  if (recentInvites >= INVITES_PER_DAY) {
    return {
      ok: false,
      error: `You can lend to ${INVITES_PER_DAY} people who aren't on Stacks each day. Try again tomorrow.`,
    };
  }

  const person =
    existing ??
    (await prisma.user.create({
      data: {
        email: address,
        ...splitName(name),
        invitedAt: new Date(),
        discoverable: false,
        theme: "system",
      },
      select: { id: true, invitedAt: true },
    }));
  await lendToFriend(book.id, lenderId, person.id, weeks);
  await createBookApprovedNotification(lenderId, person.id, lenderName, book.title, book.id);
  await sendLoanInvite(person.id, { throttle: false });
  return { ok: true, borrowerId: person.id, invited: true };
}

// Emails the link that claims a waiting account, with what they have on
// loan. Asked for again from sign-up or a password reset, it waits a
// moment between sends.
export async function sendLoanInvite(userId: User["id"], { throttle = true } = {}) {
  const person = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstname: true,
      invitedAt: true,
      verificationSentAt: true,
      borrowedBooks: {
        orderBy: { borrowedAt: "desc" },
        select: {
          title: true,
          author: true,
          cover: true,
          dueDate: true,
          user: { select: { firstname: true, surname: true } },
        },
      },
    },
  });
  if (!person?.invitedAt || person.borrowedBooks.length === 0) return { sent: false };
  if (throttle && !canResend(person.verificationSentAt)) return { sent: false };
  await prisma.user.update({ where: { id: person.id }, data: { verificationSentAt: new Date() } });
  const result = await sendLoanInviteEmail({
    toEmail: person.email,
    toName: person.firstname || "there",
    token: makeInviteToken(person.id, person.email, secret()),
    loans: person.borrowedBooks.map((book) => ({
      title: book.title,
      author: book.author,
      cover: book.cover,
      lenderName: `${book.user.firstname} ${book.user.surname}`.trim(),
      dueDate: book.dueDate,
    })),
  });
  return { sent: result.success };
}

// Whose waiting account a link is for, with what they've been lent. Null
// for a link that's made up, expired, or no longer matches the account;
// "claimed" once they've set it up.
export async function getInvite(token: string) {
  const claim = readInviteToken(token, secret());
  if (!claim) return null;
  const person = await prisma.user.findUnique({
    where: { id: claim.userId },
    select: {
      id: true,
      email: true,
      firstname: true,
      surname: true,
      invitedAt: true,
      borrowedBooks: {
        orderBy: { borrowedAt: "desc" },
        select: {
          id: true,
          title: true,
          author: true,
          cover: true,
          dueDate: true,
          user: { select: { firstname: true, surname: true, profileEmoji: true } },
        },
      },
    },
  });
  if (!person || person.email !== claim.email) return null;
  if (!person.invitedAt) return "claimed" as const;
  return person;
}

// They set a password and their name: the account is theirs, the address
// is confirmed (the link came to it), and everyone who lent them a book
// becomes a friend
export async function claimInvite(
  token: string,
  { firstname, surname, password }: { firstname: string; surname: string; password: string },
) {
  const invite = await getInvite(token);
  if (!invite || invite === "claimed") return null;
  const now = new Date();
  await prisma.user.update({
    where: { id: invite.id },
    data: {
      firstname,
      surname,
      password: { create: { hash: await hash(password, 10) } },
      invitedAt: null,
      emailVerifiedAt: now,
      discoverable: true,
      // Joined now, not when the book was lent
      createdAt: now,
    },
  });

  const lenders = await prisma.lendingHistory.findMany({
    where: { borrowerId: invite.id },
    select: { book: { select: { userId: true } } },
    distinct: ["bookId"],
  });
  const lenderIds = [...new Set(lenders.map((loan) => loan.book.userId))];
  for (const lenderId of lenderIds) {
    if ((await getFriendStatus(invite.id, lenderId)) === "friends") continue;
    await createFriendship(invite.id, lenderId);
    await prisma.notification.create({
      data: {
        type: "FRIEND_JOINED",
        senderId: invite.id,
        receiverId: lenderId,
        senderName: `${firstname} ${surname}`.trim(),
      },
    });
  }
  const first = invite.borrowedBooks[0];
  return {
    userId: invite.id,
    email: invite.email,
    bookId: first?.id ?? null,
    // Who brought them in, for the admins' sign-up email
    lenderName: first ? `${first.user.firstname} ${first.user.surname}`.trim() : null,
  };
}
