import type { Password, User, Notification } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "~/db.server";

export type { User } from "@prisma/client";

export async function getUserById(id: User["id"]) {
  return prisma.user.findUnique({
    where: { id } ,
    select: {
      id: true,
      email: true,
      firstname: true,
      surname: true,
      shareToken: true,
      notificationsSent: true,
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
          createdAt: true,
        }
      },
      following: {
        select: {
          id: true,
          email: true,
          firstname: true,
          surname: true,
        }
      }
    }
  })
}

export async function getUserByEmail(email: User["email"]) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true }
  })
}

export async function getUserEmailById(id: User["id"]) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstname: true,
      surname: true,
    }
  })
}

export async function updateUser(
  id: User["id"],
  data: { email?: string; firstname?: string; surname?: string }
) {
  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      firstname: true,
      surname: true,
    },
  });
}

export function generateUserSlug(firstname: string, surname: string): string {
  return `${firstname}-${surname}`.toLowerCase().replace(/\s+/g, '-');
}

export async function getUserBySlug(slug: string) {
  // Fetch all users and find the one whose generated slug matches
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstname: true,
      surname: true,
      following: {
        select: {
          id: true,
          email: true,
          firstname: true,
          surname: true,
        }
      }
    }
  });

  // Find user by comparing generated slugs
  const matchingUser = users.find(user => {
    const userSlug = `${user.firstname}-${user.surname}`.toLowerCase().replace(/\s+/g, '-');
    return userSlug === slug.toLowerCase();
  });

  return matchingUser || null;
}

export async function deleteNotification(notificationId: Notification["id"]) {
  return prisma.notification.delete({
    where: {
      id: notificationId
    }
  })
}

export async function markNotificationAsRead(notificationId: Notification["id"], actionTaken: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      read: true,
      actionTaken,
    },
  });
}

export async function getNotificationHistory(userId: string, limit: number = 10) {
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
      actionTaken: true,
      createdAt: true,
    },
  });
}

export async function createNotification(senderId: User["id"], receiverId: User["id"], senderName: string) {
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
    select: { id: true, sender: true, receiver: true, senderId: true, receiverId: true}
  })
}

export async function createBookRequestNotification(
  senderId: User["id"],
  receiverId: User["id"],
  senderName: string,
  bookId: string,
  bookTitle: string
) {
  return prisma.notification.create({
    data: {
      type: "BOOK_REQUEST",
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
    select: { id: true, sender: true, receiver: true, senderId: true, receiverId: true, bookId: true, bookTitle: true }
  })
}

export async function createBookApprovedNotification(
  senderId: User["id"],
  receiverId: User["id"],
  senderName: string,
  bookTitle: string
) {
  return prisma.notification.create({
    data: {
      type: "BOOK_APPROVED",
      receiver: {
        connect: { id: receiverId },
      },
      sender: {
        connect: { id: senderId },
      },
      senderName: senderName,
      bookTitle: bookTitle,
    },
    select: { id: true, sender: true, receiver: true, senderId: true, receiverId: true, bookTitle: true }
  })
}

export async function createBookReturnedNotification(
  senderId: User["id"],
  receiverId: User["id"],
  senderName: string,
  bookTitle: string
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
    },
    select: { id: true, sender: true, receiver: true, senderId: true, receiverId: true, bookTitle: true }
  })
}

export async function createFriendship(userId: User["id"], friendId: User["id"]) {

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


export async function createUser(email: User["email"], password: string,  firstname: string, surname: string) {
  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      email,
      password: {
        create: {
          hash: hashedPassword,
        },
      },
      firstname,
      surname,
    },
  });
}

export async function deleteUserByEmail(email: User["email"]) {
  return prisma.user.delete({ where: { email } });
}

export async function searchUsers(query: string, currentUserId: string) {
  // Fetch all users except current user
  const users = await prisma.user.findMany({
    where: {
      id: { not: currentUserId },
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
  return token;
}

export async function getUserByShareToken(token: string) {
  return prisma.user.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      firstname: true,
      surname: true,
    },
  });
}

export async function revokeShareToken(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { shareToken: null },
  });
}

export async function getPendingFriendRequests(userId: string) {
  // Get friend requests sent by this user that haven't been accepted yet
  const pendingRequests = await prisma.notification.findMany({
    where: {
      senderId: userId,
      type: "FRIEND_REQUEST",
      OR: [
        { read: false },
        { actionTaken: null },
      ],
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

export async function getSuggestedFriends(userId: string, limit: number = 5) {
  // Get the current user's friend list
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      following: { select: { id: true } },
    },
  });

  const friendIds = currentUser?.following.map((f) => f.id) || [];

  // Get recently joined users, excluding current user and existing friends
  const suggestedUsers = await prisma.user.findMany({
    where: {
      id: {
        notIn: [userId, ...friendIds],
      },
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

export async function verifyLogin(
  email: User["email"],
  password: Password["hash"],
) {
  const userWithPassword = await prisma.user.findUnique({
    where: { email },
    include: {
      password: true,
    },
  });

  if (!userWithPassword || !userWithPassword.password) {
    return null;
  }

  const isValid = await bcrypt.compare(
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
