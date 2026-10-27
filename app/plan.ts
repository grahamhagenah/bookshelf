// The free plan's limits and Plus's prices, shared by the server and the
// pages that explain them

// A shelf shared with someone you live with holds two people's books
export const FREE_LIMITS = { books: 100, sharedBooks: 200 };

export const freeBookLimit = (shared: boolean) =>
  shared ? FREE_LIMITS.sharedBooks : FREE_LIMITS.books;

export const PLUS_PRICES = { monthly: 3, yearly: 24 };

// What someone sees when they reach a limit
export const LIMIT_MESSAGES = {
  books: `Your shelf holds ${FREE_LIMITS.books} books on the free plan, ${FREE_LIMITS.sharedBooks} when you share it with someone you live with. Stacks Plus lifts the limit.`,
};

export const UPGRADE_PATH = "/account#plan";
