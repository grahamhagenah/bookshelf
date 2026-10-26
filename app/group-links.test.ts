import { codeFromLink, groupInvitePath, groupPath, slugify } from "./group-links";

test("a group's links carry its name ahead of the code that does the work", () => {
  expect(groupInvitePath("Thursday Book Club!", "7afb82a3d009460e")).toBe(
    "/g/thursday-book-club-7afb82a3d009460e",
  );
  expect(groupPath({ id: "cmvojyu1r0000", name: "Café Lecture" })).toBe("/groups/cafe-lecture-cmvojyu1r0000");
  // A name with nothing to spell out leaves just the code
  expect(groupInvitePath("📚📚", "abc123")).toBe("/g/abc123");
  expect(slugify("x".repeat(80))).toHaveLength(40);
});

test("the code comes back out of any link, named or not", () => {
  expect(codeFromLink("thursday-book-club-7afb82a3d009460e")).toBe("7afb82a3d009460e");
  expect(codeFromLink("old-name-cmvojyu1r0000")).toBe("cmvojyu1r0000");
  expect(codeFromLink("7afb82a3d009460e")).toBe("7afb82a3d009460e");
});
