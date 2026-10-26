import { emailsIn } from "./find-friends";

test("every address in a paste, however it's separated, once each", () => {
  expect(
    emailsIn(`maya@example.com, Sam Okafor <SAM@example.org>; lee@mail.example.net
maya@example.com "Ana" <ana@example.co.uk>`),
  ).toEqual(["maya@example.com", "sam@example.org", "lee@mail.example.net", "ana@example.co.uk"]);
  expect(emailsIn("no addresses here, just @mentions")).toEqual([]);
});
