// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { getAdminUsers, getDataQuality, getHealth, getLending } from "./admin.server";
import { lendBook } from "./book.server";
import { createFriendship, deleteUsers } from "./user.server";

const DAY = 24 * 60 * 60 * 1000;

test("health counts real accounts and leaves demo sandboxes out", async () => {
  const before = await getHealth();
  const owner = await makeUser("Olive");
  const borrower = await makeUser("Sam");
  const demo = await makeUser("Maya", { demoGroup: "admin-test" });
  const book = await makeBook(owner.id, "Piranesi");
  await makeBook(demo.id, "Demo book");
  await lendBook(book.id, borrower.id);
  await createFriendship(owner.id, borrower.id);

  const after = await getHealth();
  expect(after.users - before.users).toBe(2);
  expect(after.books - before.books).toBe(1);
  expect(after.onLoan - before.onLoan).toBe(1);
  expect(after.friendships - before.friendships).toBe(1);
  expect(after.signupsPerDay).toHaveLength(30);
  expect(after.signupsPerDay.at(-1)!.count - before.signupsPerDay.at(-1)!.count).toBe(2);
  expect(after.loansPerDay.at(-1)!.count - before.loansPerDay.at(-1)!.count).toBe(1);
});

test("lending lists overdue loans, most overdue first", async () => {
  const owner = await makeUser("Olive");
  const borrower = await makeUser("Sam");
  const book = await makeBook(owner.id, "Overdue Piranesi");
  await lendBook(book.id, borrower.id);
  await prisma.book.update({
    where: { id: book.id },
    data: { dueDate: new Date(Date.now() - 3 * DAY) },
  });

  const { overdue, topLenders } = await getLending();
  expect(overdue.find((loan) => loan.id === book.id)).toMatchObject({
    user: { firstname: "Olive" },
    borrower: { firstname: "Sam" },
  });
  const dueDates = overdue.map((loan) => loan.dueDate!.getTime());
  expect(dueDates).toEqual([...dueDates].sort((a, b) => a - b));
  // Other tests lend books too, so only the shape is certain here
  const loans = topLenders.map((lender) => lender.loans);
  expect(loans).toEqual([...loans].sort((a, b) => b - a));
  expect(loans.length).toBeLessThanOrEqual(5);
});

test("people show counts and their latest activity", async () => {
  const reader = await makeUser("Priya");
  await prisma.user.update({
    where: { id: reader.id },
    data: { createdAt: new Date(Date.now() - 30 * DAY) },
  });
  await makeBook(reader.id, "Middlemarch");

  const user = (await getAdminUsers()).find((u) => u.id === reader.id);
  expect(user).toMatchObject({ bookCount: 1, bookTitles: ["Middlemarch"] });
  // Adding the book just now counts as activity, not the old sign-up
  expect(Date.now() - user!.lastActive.getTime()).toBeLessThan(DAY);
});

test("data quality lists books missing details", async () => {
  const owner = await makeUser("Olive");
  const book = await makeBook(owner.id, "Bare book");
  await prisma.book.update({ where: { id: book.id }, data: { cover: "" } });

  const { books } = await getDataQuality();
  // makeBook leaves the description and subjects empty too
  expect(books.find((b) => b.id === book.id)?.missing).toEqual([
    "cover",
    "description",
    "subjects",
  ]);
});

test("deleting an account returns their borrowed books and keeps everyone else's", async () => {
  const owner = await makeUser("Olive");
  const borrower = await makeUser("Sam");
  const book = await makeBook(owner.id, "Piranesi");
  const theirs = await makeBook(borrower.id, "Sam's book");
  await lendBook(book.id, borrower.id);
  await createFriendship(owner.id, borrower.id);

  await deleteUsers([borrower.id]);

  expect(await prisma.user.findUnique({ where: { id: borrower.id } })).toBeNull();
  expect(await prisma.book.findUnique({ where: { id: theirs.id } })).toBeNull();
  expect(await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).toMatchObject({
    borrowerId: null,
    dueDate: null,
  });
  expect(await prisma.notification.count({ where: { senderId: borrower.id } })).toBe(0);
});
