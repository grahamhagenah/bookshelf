// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { demoCover, isbnCover, resolveDemoCovers } from "./demo-covers.server";

// Open Library, as these tests need it: a picture for some ISBNs, a work
// cover for some titles, and nothing for the rest
const pictures = new Set<string>();
const workCovers = new Map<string, string>();
vi.mock("~/covers.server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  loadCover: async (path: string) =>
    pictures.has(path) ? Buffer.from("a real picture") : null,
}));
vi.mock("./openlibrary.server", () => ({
  lookupWork: async ({ title }: { title: string }) => {
    const cover = workCovers.get(title);
    return cover ? { cover } : null;
  },
}));

// Fresh ISBNs each run: the answers are remembered on disk
const isbn = () => `978${String(Math.random()).slice(2, 12)}`;

test("blank ISBN covers in demo sandboxes give way to the work's cover", async () => {
  const [blank, good, unknown] = [isbn(), isbn(), isbn()];
  pictures.add(`b/isbn/${good}-L.jpg`);
  const workCover = "https://covers.openlibrary.org/b/id/12345-L.jpg";
  workCovers.set("Blank Edition", workCover);
  pictures.add("b/id/12345-L.jpg");

  const demo = await makeUser("Demo");
  await prisma.user.update({
    where: { id: demo.id },
    data: { demoGroup: "test-group" },
  });
  const real = await makeUser("Real");
  const make = async (userId: string, title: string, number: string) => {
    const book = await makeBook(userId, title);
    return prisma.book.update({
      where: { id: book.id },
      data: { cover: isbnCover(number) },
    });
  };
  const inDemo = await make(demo.id, "Blank Edition", blank);
  const outside = await make(real.id, "Blank Edition", blank);
  const fine = await make(demo.id, "Good Edition", good);
  const lost = await make(demo.id, "Nowhere", unknown);

  await resolveDemoCovers([
    { isbn: blank, title: "Blank Edition", author: "A" },
    { isbn: good, title: "Good Edition", author: "B" },
    { isbn: unknown, title: "Nowhere", author: "C" },
  ]);

  const cover = async (id: string) =>
    (await prisma.book.findUniqueOrThrow({ where: { id } })).cover;
  expect(await cover(inDemo.id)).toBe(workCover);
  // Only demo books are touched
  expect(await cover(outside.id)).toBe(isbnCover(blank));
  expect(await cover(fine.id)).toBe(isbnCover(good));
  // Nothing found: left as it was, to be tried again
  expect(await cover(lost.id)).toBe(isbnCover(unknown));

  // And the next sandbox starts with what was found
  expect(await demoCover(blank)).toBe(workCover);
  expect(await demoCover(unknown)).toBe(isbnCover(unknown));
});
