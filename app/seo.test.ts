// @vitest-environment node
import { readFileSync } from "node:fs";

import { PUBLIC_PAGES, SITE_URL, robotsTxt, sitemapXml } from "./seo";

// How Google reads robots.txt: the longest matching rule wins, Allow wins
// a tie, "*" matches anything and a trailing "$" anchors the end
function allowed(path: string) {
  const rules = robotsTxt()
    .split("\n")
    .map((line) => line.match(/^(Allow|Disallow): (.*)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(([, kind, pattern]) => ({ allow: kind === "Allow", pattern }));
  const matches = (pattern: string) => {
    const anchored = pattern.endsWith("$");
    const body = (anchored ? pattern.slice(0, -1) : pattern)
      .split("*")
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
  };
  const best = rules
    .filter((rule) => matches(rule.pattern))
    .sort(
      (a, b) =>
        b.pattern.length - a.pattern.length ||
        Number(b.allow) - Number(a.allow),
    )[0];
  return best ? best.allow : true;
}

test("every page in the sitemap is open to crawlers", () => {
  for (const page of PUBLIC_PAGES)
    expect([page, allowed(page)]).toEqual([page, true]);
  const listed = [...sitemapXml().matchAll(/<loc>(.*?)<\/loc>/g)].map(
    (m) => m[1],
  );
  expect(listed).toEqual(PUBLIC_PAGES.map((page) => `${SITE_URL}${page}`));
  expect(robotsTxt()).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
});

test("what a public page needs to render is open too", () => {
  for (const path of [
    "/build/root-ABC123.js",
    "/build/_assets/tailwind-XYZ.css",
    "/covers/b/id/8793546-M.jpg",
    "/og-image.png",
    "/favicon.svg",
    "/icon-192.png",
  ]) {
    expect([path, allowed(path)]).toEqual([path, true]);
  }
});

test("private pages stay closed", () => {
  for (const path of [
    "/books",
    "/books/abc123",
    "/friends",
    "/feed",
    "/account",
    "/dashboard",
    "/share/sometoken",
    "/maya",
    "/faq-but-not-really",
  ]) {
    expect([path, allowed(path)]).toEqual([path, false]);
  }
});

test("no public page asks not to be indexed", () => {
  for (const page of PUBLIC_PAGES.filter((page) => page !== "/")) {
    const source = readFileSync(`app/routes${page}.tsx`, "utf8");
    expect([page, /noindex:\s*true/.test(source)]).toEqual([page, false]);
  }
});
