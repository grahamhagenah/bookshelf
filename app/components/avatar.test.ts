import {
  isAvatarIcon,
  isPicture,
  isPlateColor,
  pictureOf,
  plateColorFor,
  plateColorOf,
} from "./avatar";

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
  const names = [
    "Jordan Avery",
    "Priya Patel",
    "Maya Chen",
    "Sam Okafor",
    "Lena Fischer",
  ];
  for (const name of names) {
    const [first, last] = name.split(" ");
    expect(plateColorFor(first, last)).not.toBe("ink");
    expect(plateColorFor(first, last)).toBe(plateColorFor(first, last));
  }
});

test("an icon can carry a color; the page takes its color from either", () => {
  expect(pictureOf("cat")).toEqual({ icon: "cat", color: null });
  expect(pictureOf("cat:plum")).toEqual({ icon: "cat", color: "plum" });
  expect(pictureOf("plate:navy")).toEqual({ icon: null, color: "navy" });
  // An unknown color leaves the icon grey; an unknown icon is nothing
  expect(pictureOf("cat:neon")).toEqual({ icon: "cat", color: null });
  expect(pictureOf("dragon:plum")).toEqual({ icon: null, color: null });
  expect(plateColorOf("cat:plum")).toBe("plum");
  expect(isPicture("cat:plum")).toBe(true);
  expect(isPicture("plate:plum")).toBe(true);
  expect(isPicture("dragon")).toBe(false);
  expect(isPicture(null)).toBe(false);
});
