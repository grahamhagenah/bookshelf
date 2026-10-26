// Not lending a book for a while: the choices an owner has, and whether a
// book is out of reach right now. Shared by the server and the pages.

// "Until I turn it back on" is kept as a date far enough away to never come
export const NOT_LENDING_FOREVER = new Date("9999-12-31T00:00:00.000Z");

export const NOT_LENDING_CHOICES = [
  { value: "forever", label: "Until I turn it back on" },
  { value: "7", label: "For a week" },
  { value: "30", label: "For a month" },
  { value: "90", label: "For three months" },
] as const;

const DAY = 24 * 60 * 60 * 1000;

// When a choice from the list above ends; null for one that isn't on it
export function notLendingEnd(choice: unknown, now = new Date()) {
  if (choice === "forever") return NOT_LENDING_FOREVER;
  const days = NOT_LENDING_CHOICES.find(
    (option) => option.value === choice && choice !== "forever",
  );
  return days ? new Date(now.getTime() + Number(days.value) * DAY) : null;
}

export function isNotLending(
  until: Date | string | null | undefined,
  now = new Date(),
) {
  return until != null && new Date(until).getTime() > now.getTime();
}

// When it can be borrowed again, or null when that's up to the owner
export function lendingAgainOn(until: Date | string | null | undefined) {
  if (until == null) return null;
  const date = new Date(until);
  return date.getUTCFullYear() >= 9999 ? null : date;
}
