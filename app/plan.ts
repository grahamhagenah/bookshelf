// The free plan's limits and Plus's prices, shared by the server and the
// pages that explain them

export const FREE_LIMITS = { books: 50, friends: 10 };

export const PLUS_PRICES = { monthly: 3, yearly: 24 };

// What someone sees when they reach a limit
export const LIMIT_MESSAGES = {
  books: `Your shelf holds ${FREE_LIMITS.books} books on the free plan. Stacks Plus lifts the limit.`,
  friends: `The free plan has room for ${FREE_LIMITS.friends} friends. Stacks Plus lifts the limit.`,
  theirFriends: "They've reached the free plan's friend limit, so this can't go through yet.",
};

export const UPGRADE_PATH = "/account#plan";

// The message for a friendship the limit stopped
export const friendLimitMessage = (reason: "full" | "they-are-full") =>
  reason === "full" ? LIMIT_MESSAGES.friends : LIMIT_MESSAGES.theirFriends;
