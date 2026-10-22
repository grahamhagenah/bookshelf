import { canResend, makeVerifyToken, readVerifyToken, RESEND_WAIT_MS } from "./verify-email";

const SECRET = "test-secret";
const NOW = Date.UTC(2026, 9, 22);
const DAY = 24 * 60 * 60 * 1000;

test("a confirmation link reads back as its account and address", () => {
  const token = makeVerifyToken("user1", "a@example.com", SECRET, NOW);
  expect(readVerifyToken(token, SECRET, NOW + DAY)).toEqual({
    userId: "user1",
    email: "a@example.com",
  });
});

test("a confirmation link stops working after a week", () => {
  const token = makeVerifyToken("user1", "a@example.com", SECRET, NOW);
  expect(readVerifyToken(token, SECRET, NOW + 8 * DAY)).toBe(null);
});

test("a tampered or foreign link is refused", () => {
  const token = makeVerifyToken("user1", "a@example.com", SECRET, NOW);
  const [, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify(["user2", "b@example.com", NOW + DAY])).toString(
    "base64url",
  );
  expect(readVerifyToken(`${forged}.${signature}`, SECRET, NOW)).toBe(null);
  expect(readVerifyToken(token, "another-secret", NOW)).toBe(null);
  expect(readVerifyToken("nonsense", SECRET, NOW)).toBe(null);
  expect(readVerifyToken(`${token}.extra`, SECRET, NOW)).toBe(null);
});

test("the confirmation email can only be resent after a short wait", () => {
  expect(canResend(null, NOW)).toBe(true);
  expect(canResend(new Date(NOW - 1000), NOW)).toBe(false);
  expect(canResend(new Date(NOW - RESEND_WAIT_MS), NOW)).toBe(true);
});
