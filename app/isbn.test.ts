import { cleanIsbn, isbnForms } from "./isbn";

test("an ISBN is its digits, however it was typed", () => {
  expect(cleanIsbn("978-0-14-303943-3")).toBe("9780143039433");
  expect(cleanIsbn("0 8044 2957 x")).toBe("080442957X");
  expect(cleanIsbn("Piranesi")).toBeNull();
  expect(cleanIsbn("12345")).toBeNull();
});

test("the barcode's 13 digits and the older 10 find each other", () => {
  expect(isbnForms("9780143039433")).toEqual(["9780143039433", "0143039431"]);
  expect(isbnForms("0143039431")).toEqual(["0143039431", "9780143039433"]);
  // An X for a check digit
  expect(isbnForms("9780804429573")).toEqual(["9780804429573", "080442957X"]);
  // A 979 number has no 10-digit form
  expect(isbnForms("9791032305690")).toEqual(["9791032305690"]);
  expect(isbnForms("not one")).toEqual([]);
});
