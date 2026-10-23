import { shelfPath } from "./profile";

test("a shelf is shared by its handle, else its link, and not at all when sharing is off", () => {
  expect(shelfPath({ handle: "maya", shareToken: "abc" })).toBe("/@maya");
  expect(shelfPath({ handle: null, shareToken: "abc" })).toBe("/share/abc");
  expect(shelfPath({ handle: "maya", shareToken: null })).toBeNull();
});
