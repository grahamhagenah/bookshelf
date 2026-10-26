// The free plan's limits and Plus's prices, shared by the server and the
// pages that explain them

export const FREE_LIMITS = { books: 100 };

export const PLUS_PRICES = { monthly: 3, yearly: 24 };

// What someone sees when they reach a limit
export const LIMIT_MESSAGES = {
  books: `Your shelf holds ${FREE_LIMITS.books} books on the free plan. Stacks Plus lifts the limit.`,
};

export const UPGRADE_PATH = "/account#plan";
