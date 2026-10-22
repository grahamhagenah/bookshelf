// @vitest-environment node
import { makeBook, makeUser, prisma } from "../test/db";

import { generateShareToken } from "./models/user.server";
import { handleProblem, normalizeHandle } from "./profile";
import { getShelfProfile, saveProfile } from "./profile.server";
import { loader as profilePage } from "./routes/$profile";
import { loader as sharePage } from "./routes/share.$token";

vi.hoisted(() => {
  process.env.SESSION_SECRET ??= "test-secret";
});

const visit = (loader: typeof profilePage, path: string, params: Record<string, string>) =>
  loader({ request: new Request(`http://localhost${path}`), params, context: {} });

test("handles are tidied, and refused when they're odd, reserved or taken", async () => {
  expect(normalizeHandle("  @Graham_H ")).toBe("graham_h");
  expect(handleProblem("ab")).toMatch(/3 to 24/);
  expect(handleProblem("no spaces")).toMatch(/letters, numbers/);
  expect(handleProblem("admin")).toMatch(/reserved/);
  expect(handleProblem("bookworm_42")).toBeNull();

  const first = await makeUser("First");
  const second = await makeUser("Second");
  const handle = `reader${Date.now().toString(36)}`;
  expect(await saveProfile(first.id, { handle: `@${handle.toUpperCase()}`, bio: "  Loves   sci-fi  " })).toEqual({ ok: true });
  expect(await prisma.user.findUnique({ where: { id: first.id }, select: { handle: true, bio: true } })).toEqual({
    handle,
    bio: "Loves sci-fi",
  });
  expect(await saveProfile(second.id, { handle, bio: "" })).toEqual({ ok: false, error: `@${handle} is taken. Try another.` });

  // Clearing both is allowed
  expect(await saveProfile(first.id, { handle: "", bio: "" })).toEqual({ ok: true });
  expect(await prisma.user.findUnique({ where: { id: first.id }, select: { handle: true, bio: true } })).toEqual({
    handle: null,
    bio: null,
  });
});

test("favourites are the shelf's books you've hearted; stats count books, reads and lends", async () => {
  const me = await makeUser("Me");
  const dune = await makeBook(me.id, "Dune");
  const circe = await makeBook(me.id, "Circe");
  await makeBook(me.id, "Piranesi");
  await prisma.readerNote.create({ data: { bookId: dune.id, userId: me.id, loved: true } });
  await prisma.readerNote.create({ data: { bookId: circe.id, userId: me.id, readAt: new Date() } });
  await prisma.book.update({ where: { id: dune.id }, data: { lendCount: 3, readAt: new Date() } });

  const profile = await getShelfProfile(me.id);
  expect(profile.favourites.map((book) => book.title)).toEqual(["Dune"]);
  expect(profile.stats).toEqual({ books: 3, readThisYear: 2, mostLent: { title: "Dune", times: 3 } });
});

test("a shelf is at /@handle only while sharing is on, and its old link moves there", async () => {
  const me = await makeUser("Me");
  const handle = `shelf${Date.now().toString(36)}`;
  await saveProfile(me.id, { handle, bio: "" });

  // Not shared yet: nothing at the handle
  await expect(visit(profilePage, `/@${handle}`, { profile: `@${handle}` })).rejects.toMatchObject({ status: 404 });

  const token = await generateShareToken(me.id);
  const page = (await visit(profilePage, `/@${handle}`, { profile: `@${handle}` })) as Response;
  expect(page.status).toBe(200);
  expect(await page.json()).toMatchObject({ ownerId: me.id, profile: { handle } });

  const moved = (await visit(sharePage, `/share/${token}`, { token })) as Response;
  expect(moved.status).toBe(302);
  expect(moved.headers.get("Location")).toBe(`/@${handle}`);

  // Only @ addresses are profiles
  await expect(visit(profilePage, `/${handle}`, { profile: handle })).rejects.toMatchObject({ status: 404 });
});
