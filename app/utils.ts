import { useMatches } from "@remix-run/react";
import { useMemo } from "react";

import type { User } from "~/models/user.server";

const DEFAULT_REDIRECT = "/";

/**
 * This should be used any time the redirect path is user-provided
 * (Like the query string on our login/signup pages). This avoids
 * open-redirect vulnerabilities.
 * @param {string} to The redirect destination
 * @param {string} defaultRedirect The redirect to use if the to is unsafe.
 */
export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  defaultRedirect: string = DEFAULT_REDIRECT,
) {
  if (!to || typeof to !== "string") {
    return defaultRedirect;
  }

  if (!to.startsWith("/") || to.startsWith("//")) {
    return defaultRedirect;
  }

  return to;
}

/**
 * This base hook is used in other hooks to quickly search for specific data
 * across all loader data using useMatches.
 * @param {string} id The route id
 * @returns {JSON|undefined} The router data or undefined if not found
 */
export function useMatchesData(
  id: string,
): Record<string, unknown> | undefined {
  const matchingRoutes = useMatches();
  const route = useMemo(
    () => matchingRoutes.find((route) => route.id === id),
    [matchingRoutes, id],
  );
  return route?.data as Record<string, unknown>;
}

function isUser(user: unknown): user is User {
  return (
    user != null &&
    typeof user === "object" &&
    "email" in user &&
    typeof user.email === "string"
  );
}

export function useOptionalUser(): User | undefined {
  const data = useMatchesData("root");
  if (!data || !isUser(data.user)) {
    return undefined;
  }
  return data.user;
}

export function useUser(): User {
  const maybeUser = useOptionalUser();
  if (!maybeUser) {
    throw new Error(
      "No user found in root loader, but user is required by useUser. If user is optional, try useOptionalUser instead.",
    );
  }
  return maybeUser;
}

export function validateEmail(email: unknown): email is string {
  return typeof email === "string" && email.length > 3 && email.includes("@");
}
// Demo sandbox accounts use this reserved, undeliverable domain
export const DEMO_EMAIL_DOMAIN = "demo.stacks.invalid";

export function isDemoEmail(email: string) {
  return email.endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

// Open Library covers are served through this site's /covers route, which
// caches them; other cover URLs (pasted by hand) are used as they are
export function coverSrc(url: string) {
  return url.startsWith("https://covers.openlibrary.org/")
    ? url.replace("https://covers.openlibrary.org/", "/covers/")
    : url;
}

// Open Library subjects mix real topics with catalog codes and library
// labels. Keep a few readable topics.
const SUBJECT_NOISE = new Set([
  "accessible book",
  "protected daisy",
  "in library",
  "lending library",
  "large type books",
  "new york times bestseller",
  "new york times reviewed",
  "open library staff picks",
  "long now manual for civilization",
  "internet archive wishlist",
  "overdrive",
  "fiction",
  "general",
  "nonfiction",
  "juvenile fiction",
  "translations into english",
  "english language",
]);

export function cleanSubjects(subjects: string[] | string | null | undefined, max = 5) {
  const list = Array.isArray(subjects) ? subjects : (subjects ?? "").split(",");
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of list) {
    let subject = raw.trim().replace(/\.$/, "");
    // "genre:fantasy" carries a real topic; other "code:value" tags don't
    const genre = subject.match(/^genre:(.+)$/i);
    if (genre) subject = genre[1].replace(/[_-]+/g, " ");
    if (
      !subject ||
      /[:=_]|--|\(|\d/.test(subject) ||
      subject.length > 30 ||
      SUBJECT_NOISE.has(subject.toLowerCase())
    ) {
      continue;
    }
    subject = subject.charAt(0).toUpperCase() + subject.slice(1);
    // "Science fiction" and "Science-fiction" are the same topic
    const key = subject.toLowerCase().replace(/[^a-z]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(subject);
    if (kept.length === max) break;
  }
  return kept;
}

// Open Library descriptions and bios sometimes carry Markdown; show prose
export function stripMarkdown(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/\s*\(\[[^\]]*\]\[\d+\]\)/g, "")
    .replace(/^\s*\[\d+\]:.*$/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Italics first, so bold text that contains italics unwraps cleanly
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
