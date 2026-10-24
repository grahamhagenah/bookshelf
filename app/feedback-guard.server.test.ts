// @vitest-environment node
import { clientIp, formAge, formToken, looksLikeSpam, tooMany } from "~/feedback-guard.server";

test("the form token says how long ago the form was served, and spots tampering", () => {
  const token = formToken(1_000_000);
  expect(formAge(token, 1_006_500)).toBeCloseTo(6.5);
  expect(formAge(token.replace(/\.(.)/, ".x"), 1_006_500)).toBeNull();
  expect(formAge("1000000.", 1_006_500)).toBeNull();
  expect(formAge(undefined)).toBeNull();
});

test("a visitor's mailshot is spam; a person's feedback with one link is not", () => {
  const mailshot = `Hey team,

As soon as a visitor asks for a call on your site, we call them in about 30 seconds.
Hear it for yourself: go to https://amazingleadgen.com and type in your number.

Not a fit? Unsubscribe here: https://amazingleadgen.com/unsubscribe.aspx?d=bookstacks.app`;
  expect(looksLikeSpam(mailshot, { signedIn: false })).toBe(true);
  expect(looksLikeSpam("Try our tool at www.example.com, opt out any time.", { signedIn: false })).toBe(true);
  expect(
    looksLikeSpam("The cover on https://bookstacks.app/books/abc doesn't load for me.", { signedIn: false }),
  ).toBe(false);
  expect(looksLikeSpam("Love it. Could want-to-read sort by author?", { signedIn: false })).toBe(false);
  // Signed-in people are trusted with their links
  expect(looksLikeSpam(mailshot, { signedIn: true })).toBe(false);
});

test("the fourth message in an hour from one address is too many", () => {
  const ip = `203.0.113.${Math.floor(Math.random() * 255)}`;
  const t = 5_000_000;
  expect(tooMany(ip, t)).toBe(false);
  expect(tooMany(ip, t + 1000)).toBe(false);
  expect(tooMany(ip, t + 2000)).toBe(false);
  expect(tooMany(ip, t + 3000)).toBe(true);
  // An hour on, the slate is clean
  expect(tooMany(ip, t + 61 * 60 * 1000)).toBe(false);
  expect(tooMany(null)).toBe(false);
});

test("the client address comes from Fly's header, then the forwarded one", () => {
  expect(clientIp(new Request("http://x", { headers: { "fly-client-ip": "198.51.100.7" } }))).toBe("198.51.100.7");
  expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "198.51.100.8, 10.0.0.1" } }))).toBe(
    "198.51.100.8",
  );
  expect(clientIp(new Request("http://x"))).toBeNull();
});
