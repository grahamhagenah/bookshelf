// How a loan's due date reads, the way you'd say it: "due today", "due
// tomorrow", the weekday while it's within the week ("due Thursday"),
// then weeks ("due in 2 weeks"), and the date once it's further off.
// Past it: "due yesterday", then days, then weeks late.

const DAY = 24 * 60 * 60 * 1000;

// Whole days from today to the date; negative once it's passed
export function daysUntil(date: string | Date, now = new Date()) {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const due = new Date(date).setHours(0, 0, 0, 0);
  return Math.round((due - startOfToday) / DAY);
}

const weeks = (days: number) => {
  const count = Math.round(days / 7);
  return count === 1 ? "a week" : `${count} weeks`;
};

export function dueText(dueDate: string | Date, now = new Date()) {
  const days = daysUntil(dueDate, now);
  if (days < -6) return `${weeks(-days)} late`;
  if (days < -1) return `${-days} days late`;
  if (days === -1) return "due yesterday";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days < 7) {
    return `due ${new Date(dueDate).toLocaleDateString("en-US", { weekday: "long" })}`;
  }
  if (days < 18) return `due in ${weeks(days)}`;
  return `due ${new Date(dueDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}
