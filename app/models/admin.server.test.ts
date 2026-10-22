// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import {
  getAdminUsers,
  getDataQuality,
  getFunnel,
  getHealth,
  getLending,
  getRevenue,
} from "./admin.server";
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

test("the funnel follows real people from sign-up to their first loan", async () => {
  const before = await getFunnel();
  const reader = await makeUser("Funnel");
  const friend = await makeUser("FunnelFriend");
  await makeUser("Demo", { demoGroup: "funnel-test" });
  await createFriendship(reader.id, friend.id);
  for (let i = 0; i < 10; i++) await makeBook(reader.id, `Book ${i}`);
  const lent = await makeBook(friend.id, "Lent");
  await lendBook(lent.id, reader.id);

  const after = await getFunnel();
  const grew = after.last30.map((step, index) => step.count - before.last30[index].count);
  // Two people signed up (the demo doesn't count); the reader got all the
  // way, and the friend has a book and a friend and lent something
  // Nobody here has paid for Plus
  expect(grew).toEqual([2, 2, 1, 2, 2, 0]);
});

test("revenue counts paying subscribers, a yearly plan as a twelfth a month", async () => {
  const before = await getRevenue();
  const plus = (name: string, data: Record<string, unknown>) =>
    makeUser(name).then((user) =>
      prisma.user.update({ where: { id: user.id }, data: { plan: "plus", ...data } }),
    );
  const paid = { subscriptionStatus: "active", planStartedAt: new Date(), planRenewsAt: new Date(Date.now() + 30 * DAY) };
  await plus("Monthly", { ...paid, stripeSubscriptionId: "sub_m", planInterval: "month", planAmount: 300 });
  await plus("Yearly", { ...paid, stripeSubscriptionId: "sub_y", planInterval: "year", planAmount: 2400, planEndsAt: new Date(Date.now() + 30 * DAY) });
  await plus("Failing", { ...paid, stripeSubscriptionId: "sub_f", planInterval: "month", planAmount: 300, subscriptionStatus: "past_due" });
  await plus("Gift", {});
  // Paid once, then canceled
  const ended = await makeUser("Ended");
  await prisma.user.update({ where: { id: ended.id }, data: { stripeSubscriptionId: "sub_e", subscriptionStatus: "canceled" } });
  // The demo never counts
  const demo = await makeUser("Demo", { demoGroup: "revenue-test" });
  await prisma.user.update({ where: { id: demo.id }, data: { plan: "plus" } });

  const after = await getRevenue();
  expect(after.paying - before.paying).toBe(3);
  expect(after.monthly - before.monthly).toBe(2);
  expect(after.yearly - before.yearly).toBe(1);
  expect(after.gifted - before.gifted).toBe(1);
  // $3 + $3 + $24 / 12
  expect(after.mrr - before.mrr).toBe(800);
  expect(after.canceling - before.canceling).toBe(1);
  expect(after.pastDue - before.pastDue).toBe(1);
  expect(after.ended - before.ended).toBe(1);
  expect(after.subscribers.find((user) => user.name.startsWith("Gift"))).toMatchObject({ gift: true });
});
