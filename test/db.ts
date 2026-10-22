import crypto from "node:crypto";

import { prisma } from "~/db.server";

// Small builders for model tests. Every record gets fresh ids and emails,
// so tests never trip over each other's data.

export function makeUser(
  firstname = "Test",
  data: { demoGroup?: string; shareToken?: string; emailVerifiedAt?: Date | null } = {},
) {
  return prisma.user.create({
    data: {
      email: `${firstname.toLowerCase()}.${crypto.randomUUID()}@example.test`,
      firstname,
      surname: "Reader",
      emailVerifiedAt: new Date(),
      ...data,
    },
  });
}

export function makeBook(userId: string, title = "Dune") {
  return prisma.book.create({
    data: {
      title,
      author: "Someone",
      body: "",
      cover: "https://covers.openlibrary.org/b/isbn/9780441172719-M.jpg",
      userId,
    },
  });
}

export { prisma };
