import type { Password, User, Notification } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "~/db.server";

export type { User } from "@prisma/client";

export async function getUserById(id: User["id"]) {
  return prisma.user.findUnique({ 
    where: { id } ,
    select: { id: true, email: true, firstname: true, surname: true, notificationsSent: true, notificationsReceived: true }
  });
}

export async function getUserByEmail(email: User["email"]) {
  return prisma.user.findUnique({ 
    where: { email },
    select: { id: true }
  });
}

// export async function getNotifications({ userId }: { userId: User["id"] }) {
//   return prisma.notification.findMany({
//     where: { userId },
//     select: { id: true, user: true, friend: true, friendId: true }
//   });
// }

export async function getNotifications({ userId }: { userId: User["id"] }) {
  return prisma.notification.findMany({
    where: { userId },
    select: { id: true, user: true, friend: true, friendId: true }
  });
}


export async function createNotification(senderId, receiverId) {
  return prisma.notification.create({
    data: {
      receiver: {
        connect: { id: receiverId },
      },
      sender: {
        connect: { id: senderId },
      },
    },
    select: { id: true, sender: true, receiver: true, senderId: true, receiverId: true }
  })
}

export async function createFriendship(userId: User["id"], friendId: User["id"]) {
  return prisma.user.update({
    where: { userId },
    data: {
      followedBy: friendId
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
