import { compare, hash } from "bcryptjs";

import { cancelBilling } from "~/billing.server";
import { prisma } from "~/db.server";
import type { Password, User, Notification } from "~/generated/prisma/client";
import { REQUEST_NOTE_MAX } from "~/lending";
import { shelfIds } from "~/models/household.server";
import { HANDLE_MAX, HANDLE_MIN, handleProblem } from "~/profile";
import type { CoverSize, Theme } from "~/utils";
import { normalizeEmail } from "~/utils";

export type { User } from "~/generated/prisma/client";

export async function getUserById(id: User["id"]) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstname: true,
      surname: true,
      shareToken: true,
      handle: true,
      bio: true,
      isAdmin: true,
      darkMode: true,
      theme: true,
      coverSize: true,
      profileEmoji: true,
      emailNotifications: true,
      weeklyDigest: true,
      discoverable: true,
      emailVerifiedAt: true,
      demoGroup: true,
      demoExploredAt: true,
      notificationsReceived: {
        where: { read: false },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          senderId: true,
          senderName: true,
          bookId: true,
          bookTitle: true,
          message: true,
          groupId: true,
          createdAt: true,
          sender: { select: { profileEmoji: true } },
        },
      },
      following: {
        select: {
          id: true,
          email: true,
          firstname: true,
          surname: true,
          profileEmoji: true,
          _count: {
            select: { books: true },
          },
        },
        orderBy: {
          books: { _count: "desc" },
        },
      },
    },
  });
}

export async function getUserByEmail(email: User["email"]) {
  return prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { id: true, firstname: true, surname: true, demoGroup: true, invitedAt: true },
  });
}

export async function getUserEmailById(id: User["id"]) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstname: true,
      surname: true,
      emailNotifications: true,
      emailVerifiedAt: true,
    },
  });
}

export async function updateUser(
  id: User["id"],
  data: {
    email?: string;
    firstname?: string;
    surname?: string;
    profileEmoji?: string | null;
  },
) {
  if (data.email !== undefined) data = { ...data, email: normalizeEmail(data.email) };
  // A new address has to be confirmed again
  const current = data.email
    ? await prisma.user.findUnique({ where: { id }, select: { email: true } })
    : null;
  const emailChanged = Boolean(current && current.email !== data.email);
  const user = await prisma.user.update({
    where: { id },
    data: emailChanged
      ? { ...data, emailVerifiedAt: null, verificationSentAt: null }
      : data,
    select: {
      id: true,
      email: true,
      firstname: true,
      surname: true,
      profileEmoji: true,
    },
  });
  return { ...user, emailChanged };
}

export async function markNotificationAsRead(
  notificationId: Notification["id"],
  actionTaken: string,
) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      read: true,
      actionTaken,
    },
  });
}

export async function getNotificationHistory(userId: string, limit = 10) {
  return prisma.notification.findMany({
    where: {
      receiverId: userId,
      read: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      senderId: true,
      senderName: true,
      bookId: true,
      bookTitle: true,
      message: true,
      groupId: true,
      actionTaken: true,
      createdAt: true,
    },
  });
}

// A word from Stacks to everyone with a real account, as a notification
// each. Demo sandboxes are left out; they reset anyway.
export async function createAnnouncement(senderId: User["id"], message: string) {
  const people = await prisma.user.findMany({
    where: { demoGroup: null, invitedAt: null },
    select: { id: true },
  });
  await prisma.$transaction(
    people.map((person) =>
      prisma.notification.create({
        data: {
          type: "ANNOUNCEMENT",
          senderId,
          receiverId: person.id,
          senderName: "Stacks",
          message,
        },
      }),
    ),
  );
  return people.length;
}

// Who an announcement is also emailed to: people who've confirmed their
// address and kept email notifications on. Demo visitors never are.
export function getAnnouncementRecipients() {
  return prisma.user.findMany({
    where: { demoGroup: null, emailNotifications: true, emailVerifiedAt: { not: null } },
    select: { id: true, email: true, firstname: true },
    orderBy: { createdAt: "asc" },
  });
}

// A notification, only if it was sent to this person
export function getReceivedNotification(userId: string, notificationId: string) {
  return prisma.notification.findFirst({
    where: { id: notificationId, receiverId: userId },
    select: { id: true, type: true, senderId: true, bookId: true, bookTitle: true },
  });
}

// Clears every unread update at once, leaving requests and reminders that
// still need an answer
export async function dismissUpdates(userId: string, keepTypes: string[]) {
  await prisma.notification.updateMany({
    where: { receiverId: userId, read: false, type: { notIn: keepTypes } },
    data: { read: true, actionTaken: "dismissed" },
  });
}

export async function createNotification(
  senderId: User["id"],
  receiverId: User["id"],
  senderName: string,
) {
  return prisma.notification.create({
    data: {
      type: "FRIEND_REQUEST",
      receiver: {
        connect: { id: receiverId },
      },
      sender: {
        connect: { id: senderId },
      },
      senderName: senderName,
    },
    select: {
      id: true,
      sender: true,
      receiver: true,
      senderId: true,
      receiverId: true,
    },
  });
}

// How much a borrower can say with their request; shared with the pages
export { REQUEST_NOTE_MAX };

export async function createBookRequestNotification(
  senderId: User["id"],
  receiverId: User["id"],
  senderName: string,
  bookId: string,
  bookTitle: string,
  // A word from the borrower: when they'd pick it up, how long they'd like it
  message: string | null = null,
) {
  return prisma.notification.create({
    data: {
      type: "BOOK_REQUEST",
      message: message?.trim().slice(0, REQUEST_NOTE_MAX) || null,
      receiver: {
        connect: { id: receiverId },
      },
      sender: {
        connect: { id: senderId },
      },
      senderName: senderName,
      book: {
        connect: { id: bookId },
      },
      bookTitle: bookTitle,
    },
    select: {
      id: true,
      sender: true,
      receiver: true,
      senderId: true,
      receiverId: true,
      bookId: true,
      bookTitle: true,
      message: true,
    },
  });
}

// The owner said no to a borrow request, with their reason if they gave one
export function createBookDeclinedNotification(
  senderId: User["id"],
  receiverId: User["id"],
  senderName: string,
  bookTitle: string,
  bookId: string,
  message: string | null = null,
) {
  return prisma.notification.create({
    data: {
      type: "BOOK_DECLINED",
      message: message?.trim().slice(0, REQUEST_NOTE_MAX) || null,
      book: { connect: { id: bookId } },
      receiver: { connect: { id: receiverId } },
      sender: { connect: { id: senderId } },
      senderName,
      bookTitle,
    },
    select: { id: true },
  });
}

// The lender's reply when they said yes, for the borrower's book page
export async function getLoanReply(bookId: string, borrowerId: User["id"]) {
  const approval = await prisma.notification.findFirst({
    where: { type: "BOOK_APPROVED", bookId, receiverId: borrowerId, message: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { message: true, senderName: true, createdAt: true },
  });
  return approval;
}

export async function createBookApprovedNotification(
  senderId: User["id"],
  receiverId: User["id"],
  senderName: string,
  bookTitle: string,
  bookId?: string,
  // The lender's reply to the request: where, when
  message: string | null = null,
) {
  return prisma.notification.create({
    data: {
      type: "BOOK_APPROVED",
      message: message?.trim().slice(0, REQUEST_NOTE_MAX) || null,
      ...(bookId ? { book: { connect: { id: bookId } } } : {}),
      receiver: {
        connect: { id: receiverId },
      },
      sender: {
        connect: { id: senderId },
      },
      senderName: senderName,
      bookTitle: bookTitle,
    },
    select: {
      id: true,
      sender: true,
      receiver: true,
      senderId: true,
      receiverId: true,
      bookTitle: true,
    },
  });
}

export async function createBookReturnedNotification(
  senderId: User["id"],
  receiverId: User["id"],
  senderName: string,
  bookTitle: string,
  // So the owner can say it never actually came back
  bookId?: string,
) {
  return prisma.notification.create({
    data: {
      type: "BOOK_RETURNED",
      receiver: {
        connect: { id: receiverId },
      },
      sender: {
        connect: { id: senderId },
      },
      senderName: senderName,
      bookTitle: bookTitle,
      ...(bookId ? { book: { connect: { id: bookId } } } : {}),
    },
    select: {
      id: true,
      sender: true,
      receiver: true,
      senderId: true,
      receiverId: true,
      bookTitle: true,
    },
  });
}

// A nudge to the borrower: that the book is late, or only that it's due
// (an owner can send one any time; it mustn't say "overdue" before it is)
export async function createReminderNotification(
  ownerId: User["id"],
  borrowerId: User["id"],
  ownerName: string,
  bookId: string,
  bookTitle: string,
  overdue: boolean,
) {
  return prisma.notification.create({
    data: {
      type: overdue ? "OVERDUE_REMINDER" : "DUE_SOON_REMINDER",
      receiver: {
        connect: { id: borrowerId },
      },
      sender: {
        connect: { id: ownerId },
      },
      senderName: ownerName,
      book: {
        connect: { id: bookId },
      },
      bookTitle: bookTitle,
    },
    select: {
      id: true,
      senderId: true,
      receiverId: true,
      bookId: true,
      bookTitle: true,
    },
  });
}

export async function createFriendship(
  userId: User["id"],
  friendId: User["id"],
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      following: {
        connect: { id: friendId },
      },
      followedBy: {
        connect: { id: friendId },
      },
    },
  });

  await prisma.user.update({
    where: { id: friendId },
    data: {
      following: {
        connect: { id: userId },
      },
      followedBy: {
        connect: { id: userId },
      },
    },
  });
}

export async function createUser(
  email: User["email"],
  password: string,
  firstname: string,
  surname: string,
) {
  const hashedPassword = await hash(password, 10);

  return prisma.user.create({
    data: {
      email: normalizeEmail(email),
      password: {
        create: {
          hash: hashedPassword,
        },
      },
      firstname,
      surname,
      theme: "system",
    },
  });
}

export async function deleteUserByEmail(email: User["email"]) {
  return prisma.user.delete({ where: { email: normalizeEmail(email) } });
}

// Remove accounts and everything that points at them. Their own books,
// notes, holds and passwords cascade; notifications and borrowing records
// don't, and books they'd borrowed go back to their owners.
export async function deleteUsers(accountIds: User["id"][]) {
  if (accountIds.length === 0) return;
  // Stop any subscription first, so nobody is billed for a deleted account
  await cancelBilling(accountIds);
  // The names someone lent to by name go with them, unless someone they
  // shared a shelf with stays, who keeps the list
  const named = await prisma.user.findMany({
    where: { nameOnly: true, listedById: { in: accountIds } },
    select: {
      id: true,
      listedBy: { select: { household: { select: { members: { select: { id: true } } } } } },
    },
  });
  const ids = [...accountIds];
  for (const person of named) {
    const keeper = person.listedBy?.household?.members.find((member) => !accountIds.includes(member.id));
    if (keeper) await prisma.user.update({ where: { id: person.id }, data: { listedById: keeper.id } });
    else ids.push(person.id);
  }
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { senderId: { in: ids } },
        { receiverId: { in: ids } },
        { book: { userId: { in: ids } } },
      ],
    },
  });
  await prisma.lendingHistory.deleteMany({
    where: { borrowerId: { in: ids } },
  });
  await prisma.book.updateMany({
    where: { borrowerId: { in: ids } },
    data: { borrowerId: null, borrowedAt: null, dueDate: null },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  // A group with nobody left in it goes too, with its "joined" notices
  const empty = (
    await prisma.group.findMany({ where: { members: { none: {} } }, select: { id: true } })
  ).map((group) => group.id);
  await prisma.notification.deleteMany({ where: { groupId: { in: empty } } });
  await prisma.group.deleteMany({ where: { id: { in: empty } } });
}

// Real users only see real users; demo users only see their own sandbox
async function getVisibleGroup(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { demoGroup: true },
  });
  return user?.demoGroup ?? null;
}

export async function searchUsers(query: string, currentUserId: string) {
  // Everyone who can be found, except the person searching
  const users = await prisma.user.findMany({
    where: {
      id: { not: currentUserId },
      demoGroup: await getVisibleGroup(currentUserId),
      discoverable: true,
    },
    select: {
      id: true,
      firstname: true,
      surname: true,
      email: true,
    },
  });

  // Filter by firstname, surname, or email containing query (case-insensitive)
  const lowerQuery = query.toLowerCase();
  const matches = users.filter((user) => {
    const firstname = user.firstname?.toLowerCase() || "";
    const surname = user.surname?.toLowerCase() || "";
    const email = user.email.toLowerCase();
    return (
      firstname.includes(lowerQuery) ||
      surname.includes(lowerQuery) ||
      email.includes(lowerQuery)
    );
  });

  // Return top 10 matches
  return matches.slice(0, 10);
}

export async function generateShareToken(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  await prisma.user.update({
    where: { id: userId },
    data: { shareToken: token },
  });
  // A public page starts out at an address with their name in it
  await giveDefaultHandle(userId);
  return token;
}

// A handle made from a name: "Jordan Avery" is "jordanavery", "Zoë" is
// "zoe". Letters and numbers only, short enough to take a number after it
export function handleFromName(firstname: string, surname: string) {
  const base = `${firstname}${surname}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, HANDLE_MAX - 3);
  return base || "reader";
}

// Gives a public page its address from the owner's name when it has none
// yet: "jordanavery", or "jordanavery2" and on when that's taken. Not for
// demo accounts, whose sample names would use up real people's. Gives back
// the handle it has now, if any.
export async function giveDefaultHandle(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { handle: true, shareToken: true, demoGroup: true, firstname: true, surname: true },
  });
  if (!user) return null;
  if (user.handle || !user.shareToken || user.demoGroup) return user.handle;
  const base = handleFromName(user.firstname, user.surname);
  for (let n = 1; n < 1000; n++) {
    const handle = n === 1 ? base : `${base}${n}`;
    if (handle.length < HANDLE_MIN || handleProblem(handle)) continue;
    try {
      // Only while they still have none, so one they just picked stays
      const { count } = await prisma.user.updateMany({
        where: { id: userId, handle: null },
        data: { handle },
      });
      if (count === 1) return handle;
      return (await prisma.user.findUnique({ where: { id: userId }, select: { handle: true } }))?.handle ?? null;
    } catch (error) {
      // Someone else has it: try the next number
      if ((error as { code?: string }).code === "P2002") continue;
      throw error;
    }
  }
  return null;
}

export async function getUserByShareToken(token: string) {
  return prisma.user.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      firstname: true,
      surname: true,
      demoGroup: true,
      handle: true,
    },
  });
}

export async function revokeShareToken(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { shareToken: null },
  });
}

export async function setAppearance(
  userId: string,
  appearance: { theme?: Theme; coverSize?: CoverSize },
) {
  await prisma.user.update({ where: { id: userId }, data: appearance });
}

// The two kinds of email, each with its own switch
export type EmailKind = "requests" | "weekly";

export async function setEmailSetting(userId: string, kind: EmailKind, on: boolean) {
  await prisma.user.update({
    where: { id: userId },
    data: kind === "requests" ? { emailNotifications: on } : { weeklyDigest: on },
  });
}

// Whether other people can find them in search and among new people
export async function setDiscoverable(userId: User["id"], on: boolean) {
  await prisma.user.update({ where: { id: userId }, data: { discoverable: on } });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const userWithPassword = await prisma.user.findUnique({
    where: { id: userId },
    include: { password: true },
  });

  if (!userWithPassword || !userWithPassword.password) {
    return { success: false, error: "User not found" };
  }

  const isValid = await compare(
    currentPassword,
    userWithPassword.password.hash,
  );
  if (!isValid) {
    return { success: false, error: "Current password is incorrect" };
  }

  const hashedPassword = await hash(newPassword, 10);
  await prisma.password.update({
    where: { userId },
    data: { hash: hashedPassword },
  });

  return { success: true };
}

export async function getPendingBookRequests(userId: string) {
  // Get book requests sent by this user that haven't been responded to yet
  const pendingRequests = await prisma.notification.findMany({
    where: {
      senderId: userId,
      type: "BOOK_REQUEST",
      read: false,
    },
    select: {
      id: true,
      receiverId: true,
      createdAt: true,
      bookId: true,
      bookTitle: true,
      receiver: {
        select: {
          id: true,
          firstname: true,
          surname: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return pendingRequests;
}

// Everyone this person has ever sent a friend request to
export async function getFriendRequestReceiverIds(userId: string) {
  const sent = await prisma.notification.findMany({
    where: { senderId: userId, type: "FRIEND_REQUEST" },
    select: { receiverId: true },
  });
  return sent.map((request) => request.receiverId);
}

export async function getPendingFriendRequests(userId: string) {
  // Get friend requests sent by this user that haven't been accepted yet
  const pendingRequests = await prisma.notification.findMany({
    where: {
      senderId: userId,
      type: "FRIEND_REQUEST",
      OR: [{ read: false }, { actionTaken: null }],
    },
    select: {
      id: true,
      receiverId: true,
      createdAt: true,
      receiver: {
        select: {
          id: true,
          firstname: true,
          surname: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return pendingRequests;
}

export async function getSuggestedFriends(userId: string, limit = 5) {
  // Get the current user's friend list
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      following: { select: { id: true } },
    },
  });

  const friendIds = currentUser?.following.map((f) => f.id) || [];
  // Nor anyone you already share a shelf with
  const housemates = await shelfIds(userId);

  // Recently joined people who've chosen to be findable, leaving out the
  // current user and existing friends
  const suggestedUsers = await prisma.user.findMany({
    where: {
      id: {
        notIn: [userId, ...friendIds, ...housemates],
      },
      demoGroup: await getVisibleGroup(userId),
      discoverable: true,
    },
    select: {
      id: true,
      firstname: true,
      surname: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return suggestedUsers;
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  return user?.isAdmin ?? false;
}

export async function verifyLogin(
  email: User["email"],
  password: Password["hash"],
) {
  const userWithPassword = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    include: {
      password: true,
    },
  });

  if (!userWithPassword || !userWithPassword.password) {
    return null;
  }

  const isValid = await compare(
    password,
    userWithPassword.password.hash,
  );

  if (!isValid) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _password, ...userWithoutPassword } = userWithPassword;

  return userWithoutPassword;
}

// Tells a book's owner that someone left a note or heart on it, once per
// reader until the owner dismisses it
export async function createReaderNoteNotification(
  senderId: User["id"],
  receiverId: User["id"],
  senderName: string,
  bookId: string,
  bookTitle: string,
) {
  const existing = await prisma.notification.findFirst({
    where: { type: "READER_NOTE", senderId, receiverId, bookId, read: false },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.notification.create({
    data: {
      type: "READER_NOTE",
      receiver: { connect: { id: receiverId } },
      sender: { connect: { id: senderId } },
      senderName,
      book: { connect: { id: bookId } },
      bookTitle,
    },
    select: { id: true },
  });
}

// Tells a borrower the owner gave them more time with a book
export function createLoanExtendedNotification(
  senderId: User["id"],
  receiverId: User["id"],
  senderName: string,
  bookId: string,
  bookTitle: string,
) {
  return prisma.notification.create({
    data: {
      type: "LOAN_EXTENDED",
      receiver: { connect: { id: receiverId } },
      sender: { connect: { id: senderId } },
      senderName,
      book: { connect: { id: bookId } },
      bookTitle,
    },
    select: { id: true },
  });
}

// How someone looking at a shelf relates to its owner, for the invite on
// a shared shelf
export type FriendStatus =
  | "self"
  | "friends"
  | "requested" // the viewer asked; waiting on the owner
  | "invited" // the owner asked; waiting on the viewer
  | "none";

export async function getFriendStatus(
  viewerId: User["id"],
  ownerId: User["id"],
): Promise<FriendStatus> {
  if (viewerId === ownerId) return "self";

  const [friends, request] = await Promise.all([
    prisma.user.count({
      where: { id: viewerId, following: { some: { id: ownerId } } },
    }),
    prisma.notification.findFirst({
      where: {
        type: "FRIEND_REQUEST",
        actionTaken: null,
        OR: [
          { senderId: viewerId, receiverId: ownerId },
          { senderId: ownerId, receiverId: viewerId },
        ],
      },
      select: { senderId: true },
    }),
  ]);

  if (friends > 0) return "friends";
  if (!request) return "none";
  return request.senderId === viewerId ? "requested" : "invited";
}
