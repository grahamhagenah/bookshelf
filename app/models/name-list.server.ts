import { prisma } from "~/db.server";
import type { User } from "~/generated/prisma/client";
import { splitName } from "~/loan-invite";

import { shelfIds } from "./household.server";

// A shelf's list of names to lend to by name only: a class, a reading
// group, the neighbors' children. Each is a name-only person (no email,
// no sign-in) the shelf can lend to in one tap, from a book's page or the
// check-out desk.

export const NAME_ONLY_DOMAIN = "stacks.invalid";

// Long enough for any class; a list past this is something else
export const NAME_LIST_MAX = 200;
const NAME_MAX = 60;

const person = { id: true, firstname: true, surname: true } as const;

export async function nameList(userId: User["id"]) {
  return prisma.user.findMany({
    where: { nameOnly: true, listedById: { in: await shelfIds(userId) } },
    select: person,
    orderBy: [{ firstname: "asc" }, { surname: "asc" }],
  });
}

// However it's typed this time
const sameName = (a: { firstname: string; surname: string }, b: { firstname: string; surname: string }) =>
  `${a.firstname} ${a.surname}`.trim().toLowerCase() === `${b.firstname} ${b.surname}`.trim().toLowerCase();

// The names in what was pasted: one a line, or separated by commas
export function readNames(text: string) {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const line of text.split(/[\n,;]+/)) {
    const name = line.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

// The name-only person by this name: on the list, or lent to from this
// shelf before and since taken off it (they go back on). Made new if
// there's no one by that name yet.
export async function findOrAddName(userId: User["id"], name: string) {
  const typed = splitName(name.replace(/\s+/g, " ").slice(0, NAME_MAX));
  if (!typed.firstname) return null;
  const shelf = await shelfIds(userId);
  const known = await prisma.user.findMany({
    where: {
      nameOnly: true,
      OR: [
        { listedById: { in: shelf } },
        { lendingHistory: { some: { book: { userId: { in: shelf } } } } },
      ],
    },
    select: { ...person, listedById: true },
  });
  const found = known.find((someone) => sameName(someone, typed));
  if (found) {
    if (!found.listedById) {
      await prisma.user.update({ where: { id: found.id }, data: { listedById: userId } });
    }
    return { id: found.id, firstname: found.firstname, surname: found.surname };
  }

  const owner = await prisma.user.findUnique({ where: { id: userId }, select: { demoGroup: true } });
  return prisma.user.create({
    data: {
      email: `name-only-${crypto.randomUUID()}@${NAME_ONLY_DOMAIN}`,
      ...typed,
      nameOnly: true,
      listedById: userId,
      discoverable: false,
      emailNotifications: false,
      weeklyDigest: false,
      theme: "system",
      // In the demo, they go when the demo is cleared
      demoGroup: owner?.demoGroup ?? null,
    },
    select: person,
  });
}

// Puts names on the list, leaving off any already there. Returns how many
// went on, or that the list is full.
export async function addNames(userId: User["id"], names: string[]) {
  const listed = await nameList(userId);
  const fresh = names.filter((name) => !listed.some((someone) => sameName(someone, splitName(name))));
  if (listed.length + fresh.length > NAME_LIST_MAX) {
    return { added: 0, full: true };
  }
  for (const name of fresh) await findOrAddName(userId, name);
  return { added: fresh.length, full: false };
}

// Off the list. Anything they have out stays with them, and their past
// loans stay in the history.
export async function unlistName(userId: User["id"], personId: User["id"]) {
  await prisma.user.updateMany({
    where: { id: personId, nameOnly: true, listedById: { in: await shelfIds(userId) } },
    data: { listedById: null },
  });
}
