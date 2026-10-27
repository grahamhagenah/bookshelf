import { dueText } from "./due";

test("due dates read the way you'd say them", () => {
  // A Monday, midday
  const now = new Date(2026, 9, 26, 12);
  const on = (days: number) => new Date(2026, 9, 26 + days, 9);

  expect(dueText(on(0), now)).toBe("due today");
  expect(dueText(on(1), now)).toBe("due tomorrow");
  expect(dueText(on(3), now)).toBe("due Thursday");
  expect(dueText(on(6), now)).toBe("due Sunday");
  expect(dueText(on(7), now)).toBe("due in a week");
  expect(dueText(on(10), now)).toBe("due in a week");
  expect(dueText(on(14), now)).toBe("due in 2 weeks");
  expect(dueText(on(25), now)).toBe("due Nov 20");
});

test("late loans count days, then weeks", () => {
  const now = new Date(2026, 9, 26, 12);
  const on = (days: number) => new Date(2026, 9, 26 + days, 9);

  expect(dueText(on(-1), now)).toBe("due yesterday");
  expect(dueText(on(-2), now)).toBe("2 days late");
  expect(dueText(on(-6), now)).toBe("6 days late");
  expect(dueText(on(-7), now)).toBe("a week late");
  expect(dueText(on(-15), now)).toBe("2 weeks late");
});
