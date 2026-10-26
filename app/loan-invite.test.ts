import { makeInviteToken, readInviteToken, splitName } from "./loan-invite";
import { makeResetToken } from "./reset-password";
import { makeVerifyToken } from "./verify-email";

const secret = "test-secret";

test("an invite link carries its account and address until it expires", () => {
  const now = Date.now();
  const token = makeInviteToken("user-1", "maya@example.test", secret, now);
  expect(readInviteToken(token, secret, now)).toEqual({
    userId: "user-1",
    email: "maya@example.test",
  });
  expect(readInviteToken(token, "other-secret", now)).toBe(null);
  expect(readInviteToken(token, secret, now + 61 * 24 * 60 * 60 * 1000)).toBe(null);
});

test("other signed links don't work as invite links", () => {
  expect(readInviteToken(makeVerifyToken("user-1", "a@example.test", secret), secret)).toBe(null);
  expect(readInviteToken(makeResetToken("user-1", "hash", secret), secret)).toBe(null);
});

test("a name splits into a first name and the rest", () => {
  expect(splitName("  Maya  Chen ")).toEqual({ firstname: "Maya", surname: "Chen" });
  expect(splitName("Maya van der Berg")).toEqual({ firstname: "Maya", surname: "van der Berg" });
  expect(splitName("Maya")).toEqual({ firstname: "Maya", surname: "" });
});
