// @vitest-environment node
import { lendToFriend } from "~/models/book.server";
import { lendByName } from "~/models/loan-invite.server";
import { createFriendship } from "~/models/user.server";

import { makeBook, makeUser, prisma } from "../../test/db";
import { routeArgs } from "../../test/route";

import { loader } from "./api.check-overdue";

const DAY = 24 * 60 * 60 * 1000;

test("a late book lent by name reminds its owner; one lent to a friend reminds the friend", async () => {
  process.env.CRON_SECRET_KEY = "cron-test";
  const walt = await makeUser("Walt");
  const maya = await makeUser("Maya");
  await createFriendship(walt.id, maya.id);
  const dove = await makeBook(walt.id, "Lonesome Dove");
  const circe = await makeBook(walt.id, "Circe");
  const lent = await lendByName(walt.id, dove, { name: "Bob Next Door", weeks: 1 });
  if (!lent.ok) throw new Error("not lent");
  await lendToFriend(circe.id, walt.id, maya.id, 1);
  // Both a week late
  await prisma.book.updateMany({
    where: { id: { in: [dove.id, circe.id] } },
    data: { dueDate: new Date(Date.now() - 7 * DAY) },
  });

  const run = () =>
    loader(
      routeArgs(
        new Request("http://localhost/api/check-overdue", {
          headers: { authorization: "Bearer cron-test" },
        }),
      ),
    );
  await run();

  const about = (bookId: string) =>
    prisma.notification.findMany({ where: { bookId }, select: { type: true, receiverId: true, senderName: true } });
  expect(await about(dove.id)).toEqual([
    { type: "LOAN_OVERDUE", receiverId: walt.id, senderName: "Bob Next Door" },
  ]);
  expect(await about(circe.id)).toEqual([
    expect.objectContaining({ type: "OVERDUE_REMINDER", receiverId: maya.id }),
  ]);

  // Once, until it's read
  await run();
  expect(await about(dove.id)).toHaveLength(1);
});
