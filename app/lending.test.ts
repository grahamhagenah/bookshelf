import {
  NOT_LENDING_FOREVER,
  isNotLending,
  lendingAgainOn,
  notLendingEnd,
} from "./lending";

test("not lending lasts for the chosen while, or until the owner says", () => {
  const now = new Date("2026-10-25T12:00:00.000Z");
  expect(notLendingEnd("forever", now)).toEqual(NOT_LENDING_FOREVER);
  expect(notLendingEnd("7", now)).toEqual(new Date("2026-11-01T12:00:00.000Z"));
  expect(notLendingEnd("30", now)).toEqual(
    new Date("2026-11-24T12:00:00.000Z"),
  );
  // Only the offered choices
  expect(notLendingEnd("5", now)).toBeNull();
  expect(notLendingEnd(null, now)).toBeNull();

  expect(isNotLending(null, now)).toBe(false);
  expect(isNotLending("2026-11-01T12:00:00.000Z", now)).toBe(true);
  // Once the date has passed it's lending again on its own
  expect(isNotLending("2026-10-24T12:00:00.000Z", now)).toBe(false);

  expect(lendingAgainOn(NOT_LENDING_FOREVER)).toBeNull();
  expect(lendingAgainOn("2026-11-01T12:00:00.000Z")).toEqual(
    new Date("2026-11-01T12:00:00.000Z"),
  );
});
