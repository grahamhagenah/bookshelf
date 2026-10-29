import { describe, expect, it } from "vitest";

import { trimOpening } from "./opening-line";

describe("trimOpening", () => {
  it("keeps a short first line whole", () => {
    expect(trimOpening("Nothing is harder to do than nothing.")).toBe(
      "Nothing is harder to do than nothing.",
    );
  });

  it("ends a long one at its first semicolon", () => {
    const persuasion =
      "Sir Walter Elliot, of Kellynch Hall, in Somersetshire, was a man who, for his own amusement, never took up any book but the Baronetage; there he found occupation for an idle hour, and consolation in a distressed one; there his faculties were roused into admiration and respect.";
    expect(trimOpening(persuasion)).toBe(
      "Sir Walter Elliot, of Kellynch Hall, in Somersetshire, was a man who, for his own amusement, never took up any book but the Baronetage…",
    );
  });

  it("ends before a dash that stands alone", () => {
    const sentence =
      "one two three four five six seven eight nine ten eleven twelve thirteen — fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six twenty-seven twenty-eight twenty-nine.";
    expect(trimOpening(sentence)).toBe(
      "one two three four five six seven eight nine ten eleven twelve thirteen…",
    );
  });

  it("falls back to a comma, and keeps one with no pause whole", () => {
    const words = Array.from({ length: 34 }, (_, index) => `w${index}`);
    const withComma = [...words];
    withComma[15] = "w15,";
    expect(trimOpening(withComma.join(" "))).toBe(`${words.slice(0, 16).join(" ")}…`);
    expect(trimOpening(words.join(" "))).toBe(words.join(" "));
  });
});
