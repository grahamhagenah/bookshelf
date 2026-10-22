// @vitest-environment node
import { makeUser, prisma } from "../../test/db";

import { getFeedback, saveFeedback, setFeedbackDone } from "./feedback.server";
import { deleteUsers } from "./user.server";

test("feedback is saved, listed open-first, and outlives the account that sent it", async () => {
  const reader = await makeUser("Feedbacker");
  const first = await saveFeedback({ userId: reader.id, body: "  Love it, but search is slow.  ", page: "/search" });
  const second = await saveFeedback({ userId: null, body: "Can I export my shelf?", email: "visitor@example.test" });
  expect(first.body).toBe("Love it, but search is slow.");

  await setFeedbackDone(first.id, true);
  const ids = (await getFeedback()).map((item) => item.id);
  expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));

  await deleteUsers([reader.id]);
  const kept = await prisma.feedback.findUniqueOrThrow({ where: { id: first.id } });
  expect(kept).toMatchObject({ userId: null, body: "Love it, but search is slow.", done: true });
});
