import { isAvatarIcon, isPlateColor, plateColorOf } from "./avatar";

test("a stored bookplate gives its color; anything else gives none", () => {
  expect(plateColorOf("plate:oxblood")).toBe("oxblood");
  expect(plateColorOf("plate:neon")).toBeNull();
  expect(plateColorOf("oxblood")).toBeNull();
  expect(plateColorOf(null)).toBeNull();
  expect(isPlateColor("navy")).toBe(true);
  // Icons and bookplates don't overlap
  expect(isAvatarIcon("plate:navy")).toBe(false);
});
