import { favoritesTip, shelfPath } from "./profile";

test("a shelf is shared by its handle, else its link, and not at all when sharing is off", () => {
  expect(shelfPath({ handle: "maya", shareToken: "abc" })).toBe("/@maya");
  expect(shelfPath({ handle: null, shareToken: "abc" })).toBe("/share/abc");
  expect(shelfPath({ handle: "maya", shareToken: null })).toBeNull();
});

test("the favorites tip shows until something's pinned, offering a book only when there are no favorites", () => {
  const dune = { id: "dune", title: "Dune" };
  // Nothing pinned or loved: pin one, starting with a book from the shelf
  expect(favoritesTip({ pinned: false, favorites: [] }, dune)).toEqual({
    text: expect.stringMatching(/^Pin up to five books/),
    link: { label: "Start with Dune", to: "/books/dune" },
  });
  expect(favoritesTip({ pinned: false, favorites: [] })?.link).toBeNull();
  // Hearts fill the row: how to choose instead, and no book to start with
  expect(favoritesTip({ pinned: false, favorites: [{}] }, dune)).toEqual({
    text: expect.stringMatching(/^Your favorites show the books you've loved/),
    link: null,
  });
  // Pinned: nothing more to say
  expect(favoritesTip({ pinned: true, favorites: [{}] }, dune)).toBeNull();
});
