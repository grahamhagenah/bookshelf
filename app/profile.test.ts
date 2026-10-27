import { noteTip, shelfPath } from "./profile";

test("a shelf is shared by its handle, else its link, and not at all when sharing is off", () => {
  expect(shelfPath({ handle: "maya", shareToken: "abc" })).toBe("/@maya");
  expect(shelfPath({ handle: null, shareToken: "abc" })).toBe("/share/abc");
  expect(shelfPath({ handle: "maya", shareToken: null })).toBeNull();
});

test("the note tip shows until a favorite has a note, pointing to one on the shelf", () => {
  const book = (id: string, onShelf: boolean, note: string | null = null) => ({
    id,
    title: `Book ${id}`,
    onShelf,
    note,
  });

  // Pinned, no notes: to the first one from the shelf
  const tip = noteTip({ pinned: true, favorites: [book("a", false), book("b", true)] });
  expect(tip?.text).toMatch(/^Add a note to a pinned book/);
  expect(tip?.link).toEqual({ label: "Write one on Book b", to: "/books/b" });
  // Not pinned yet: pin one first
  expect(noteTip({ pinned: false, favorites: [] })).toEqual({
    text: expect.stringMatching(/^Pin a book/),
    link: null,
  });
  expect(noteTip({ pinned: false, favorites: [book("c", true)] })?.link?.label).toBe("Start with Book c");
  // A note on any favorite: no tip
  expect(noteTip({ pinned: true, favorites: [book("a", true), book("b", true, "Loved it")] })).toBeNull();
});
