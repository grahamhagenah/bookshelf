// @vitest-environment node
import { nameList } from "~/models/name-list.server";
import { sessionStorage } from "~/session.server";

import { makeBook, makeUser, prisma } from "../../test/db";
import { bodyOf, routeArgs, statusOf } from "../../test/route";

import { action, loader } from "./checkout";

async function cookieFor(userId: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return sessionStorage.commitSession(session);
}

async function post(userId: string, fields: Record<string, string>) {
  const result = await action(
    routeArgs(
      new Request("http://localhost/checkout", {
        method: "POST",
        headers: { Cookie: await cookieFor(userId) },
        body: new URLSearchParams(fields),
      }),
    ),
  );
  return { status: statusOf(result), body: (await bodyOf(result)) as { done?: string | null; error?: string } };
}

test("scan, lend to a new name, and they're on the list; scan again and take it back", async () => {
  const dana = await makeUser("Dana");
  const book = await makeBook(dana.id, "Wonder");
  await prisma.book.update({ where: { id: book.id }, data: { isbn: "0375869026" } });

  const scanned = (await bodyOf(
    await loader(
      routeArgs(new Request("http://localhost/checkout?q=9780375869020", { headers: { Cookie: await cookieFor(dana.id) } })),
    ),
  )) as { found: { id: string }[] };
  expect(scanned.found.map((copy) => copy.id)).toEqual([book.id]);

  const lent = await post(dana.id, { intent: "lend", bookId: book.id, name: "Theo Park", weeks: "2" });
  expect(lent.body.done).toBe("Wonder is out to Theo Park, due in 2 weeks.");
  const [theo] = await nameList(dana.id);
  expect(theo).toMatchObject({ firstname: "Theo", surname: "Park" });
  expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).borrowerId).toBe(theo.id);

  const back = await post(dana.id, { intent: "return", bookId: book.id });
  expect(back.body.done).toBe("Wonder is back from Theo Park.");

  // Lending with no name says so
  expect(await post(dana.id, { intent: "lend", bookId: book.id, name: " " })).toMatchObject({
    status: 400,
    body: { error: "Add their name." },
  });
});
