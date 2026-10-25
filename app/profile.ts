// The rules for a shelf's handle and bio, shared by Settings and the server

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;
export const BIO_MAX = 160;
// Books pinned to the top of a public page
export const PIN_MAX = 5;

// Lowercase letters, numbers and underscores; what's typed is tidied first
export const normalizeHandle = (text: string) =>
  text.trim().replace(/^@/, "").toLowerCase();

// Words that read like part of Stacks, not a person
const RESERVED = new Set([
  "admin",
  "api",
  "about",
  "account",
  "help",
  "support",
  "stacks",
  "bookstacks",
  "share",
  "settings",
  "login",
  "join",
  "signup",
  "logout",
  "pricing",
  "terms",
  "privacy",
  "faq",
  "feedback",
  "dashboard",
  "search",
  "books",
  "friends",
  "official",
  "team",
  "staff",
]);

// Why a handle can't be used, or null if it can
export function handleProblem(handle: string): string | null {
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) {
    return `Use ${HANDLE_MIN} to ${HANDLE_MAX} characters.`;
  }
  if (!/^[a-z0-9_]+$/.test(handle))
    return "Use only letters, numbers and underscores.";
  if (RESERVED.has(handle)) return "That one's reserved. Try another.";
  return null;
}

// Where a shelf can be seen without signing in: its handle once it has
// one, else the share link. Null while sharing is off.
export function shelfPath(user: { handle?: string | null; shareToken?: string | null }) {
  if (!user.shareToken) return null;
  return user.handle ? `/@${user.handle}` : `/share/${user.shareToken}`;
}
