import { isAvatarIcon, isPlateColor, plateColorFor, plateColorOf } from "./avatar";

test("a stored bookplate gives its color; anything else gives none", () => {
  expect(plateColorOf("plate:oxblood")).toBe("oxblood");
  expect(plateColorOf("plate:neon")).toBeNull();
  expect(plateColorOf("oxblood")).toBeNull();
  expect(plateColorOf(null)).toBeNull();
  expect(isPlateColor("navy")).toBe(true);
  // Icons and bookplates don't overlap
  expect(isAvatarIcon("plate:navy")).toBe(false);
});

test("everyone gets a real color by default, never grey ink, and keeps it", () => {
  const names = ["Jordan Avery", "Priya Patel", "Maya Chen", "Sam Okafor", "Lena Fischer"];
  for (const name of names) {
    const [first, last] = name.split(" ");
    expect(plateColorFor(first, last)).not.toBe("ink");
    expect(plateColorFor(first, last)).toBe(plateColorFor(first, last));
  }
});
