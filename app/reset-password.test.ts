import { makeResetToken, readResetToken, RESET_LINK_MINUTES, stampMatches } from "./reset-password";
import { makeVerifyToken } from "./verify-email";

const SECRET = "test-secret";
const NOW = Date.UTC(2026, 10, 1);
const MINUTE = 60 * 1000;

test("a reset link reads back as its account, for the password it was sent for", () => {
  const token = makeResetToken("user1", "hash-a", SECRET, NOW);
  const claim = readResetToken(token, SECRET, NOW + MINUTE);
  expect(claim?.userId).toBe("user1");
  expect(stampMatches(claim!.stamp, "hash-a", SECRET)).toBe(true);
  // Once the password has changed, the link no longer matches it
  expect(stampMatches(claim!.stamp, "hash-b", SECRET)).toBe(false);
});

test("a reset link stops working after an hour", () => {
  const token = makeResetToken("user1", "hash-a", SECRET, NOW);
  expect(readResetToken(token, SECRET, NOW + (RESET_LINK_MINUTES + 1) * MINUTE)).toBe(null);
});

test("forged, foreign and confirmation links aren't reset links", () => {
  const token = makeResetToken("user1", "hash-a", SECRET, NOW);
  expect(readResetToken(token, "another-secret", NOW)).toBe(null);
  expect(readResetToken(`${token}x`, SECRET, NOW)).toBe(null);
  expect(readResetToken(makeVerifyToken("user1", "a@example.com", SECRET, NOW), SECRET, NOW)).toBe(
    null,
  );
});
