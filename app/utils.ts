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
// Signup bot checks: a hidden field people never see but form-filling bots
// do, and a minimum time between the form loading and being sent
export const HONEYPOT_FIELD = "website";
export const MIN_SIGNUP_MS = 2000;

export function looksLikeBot(
  formData: FormData,
  now = Date.now(),
): "honeypot" | "too-fast" | null {
  const trap = formData.get(HONEYPOT_FIELD);
  if (typeof trap === "string" && trap.length > 0) return "honeypot";
  const renderedAt = Number(formData.get("renderedAt"));
  if (!Number.isFinite(renderedAt) || renderedAt <= 0) return "too-fast";
  if (now - renderedAt < MIN_SIGNUP_MS) return "too-fast";
  return null;
}

// Demo sandbox accounts use this reserved, undeliverable domain
export const DEMO_EMAIL_DOMAIN = "demo.stacks.invalid";

export function isDemoEmail(email: string) {
  return email.endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

// Open Library covers are served through this site's /covers route, which
// caches them; other cover URLs (pasted by hand) are used as they are.
// Open Library keeps each cover in three sizes, S (~45px wide), M (~180px)
// and L (~400px+): thumbnails ask for M, which is a fraction of L's weight.
export function coverSrc(url: string, size?: "M" | "L") {
  if (!url.startsWith("https://covers.openlibrary.org/")) return url;
  const local = url.replace("https://covers.openlibrary.org/", "/covers/");
  return size ? local.replace(/-[SML]\.jpg$/, `-${size}.jpg`) : local;
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

// Open Library names some authors in their own script (村上春樹) and some
// works by their original title (海辺のカフカ). These pick the English.

// Written in the Latin alphabet, accents and all
export const isLatin = (text: string) => /^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{S}\s]*$/u.test(text);

const shouting = (name: string) => name.split(/\s+/).some((word) => word.length > 1 && word === word.toUpperCase());

// An author's name in English: their own when it's already in the Latin
// alphabet; else "Murakami, Haruki" turned round; else the first plainly
// written Latin form among their other names
export function readableName(author: {
  name?: string | null;
  personal_name?: string | null;
  alternate_names?: string[] | null;
}): string {
  const name = author.name?.trim() ?? "";
  if (name && isLatin(name)) return name;
  const personal = author.personal_name?.trim();
  if (personal && isLatin(personal)) {
    const [last, first] = personal.split(/\s*,\s*/);
    return first ? `${first} ${last}` : personal;
  }
  const alternate = author.alternate_names?.find(
    (other) => isLatin(other) && !other.includes(",") && !shouting(other) && other.trim().includes(" "),
  );
  return alternate?.trim() || name;
}

// A translated book's title as its English edition has it. Only when they
// really differ, so "Sapiens" keeps its short title and its capitals.
export function englishTitle(
  workTitle: string,
  edition: { title?: string; language?: string[] } | undefined,
): string {
  const title = edition?.title?.trim();
  if (!title || !edition?.language?.includes("eng")) return workTitle;
  const main = (text: string) => text.split(":")[0].trim().toLowerCase();
  return main(title) === main(workTitle) ? workTitle : title;
}

// A work's publisher list mixes in every translation's, in no useful order
// (a Basque publisher first for Raymond Carver). Searching with these asks
// for the English edition too, whose publisher matches the copy people own.
export const ENGLISH_EDITION_PARAMS = "lang=en";
export const ENGLISH_EDITION_FIELDS =
  "editions,editions.key,editions.title,editions.language,editions.publisher";

export interface WithEnglishEdition {
  editions?: { docs?: { title?: string; language?: string[]; publisher?: string[] }[] };
}

export function editionPublisher(doc: WithEnglishEdition): string | null {
  const raw = doc.editions?.docs?.[0]?.publisher?.[0];
  if (!raw) return null;
  // Some arrive with library catalog codes: "#bVintage, #c2009." is Vintage
  const parts = raw
    .replace(/#[a-z]/g, "")
    .split(",")
    .map((part) => part.trim().replace(/[.;:]+$/, ""))
    .filter((part) => part && !/^\[?c?\d{4}\]?$/.test(part));
  return parts.join(", ") || null;
}

// Open Library lists every translation's subjects alongside the book's own:
// "Translations into Korean", "Korean short stories", "Chinese language
// materials". Those notes go, and so does any subject led by a language the
// book was translated into (English aside, since that's the copy people own).
const TRANSLATION_NOTE = /^translations? (into|from) |\blanguage materials$/i;

// Whether a stored list still carries those notes, from before they were
// filtered out
export const hasTranslationSubjects = (subjects: string) =>
  subjects.split(",").some((subject) => TRANSLATION_NOTE.test(subject.trim()));

function translatedInto(list: string[]) {
  const languages = new Set<string>();
  for (const subject of list) {
    const match = subject.trim().match(/^translations? into (.+?)\.?$/i);
    if (match && match[1].toLowerCase() !== "english") languages.add(match[1].toLowerCase());
  }
  return [...languages];
}

export function cleanSubjects(subjects: string[] | string | null | undefined, max = 5) {
  const list = Array.isArray(subjects) ? subjects : (subjects ?? "").split(",");
  const translations = translatedInto(list);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of list) {
    let subject = raw.trim().replace(/\.$/, "");
    const lower = subject.toLowerCase();
    if (
      TRANSLATION_NOTE.test(subject) ||
      translations.some((language) => lower.startsWith(`${language} `))
    ) {
      continue;
    }
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

// Appearance settings, kept on the account so they follow you between devices
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const LIBRARY_VIEWS = ["cover", "list"] as const;
export type LibraryView = (typeof LIBRARY_VIEWS)[number];
export const COVER_SIZES = ["large", "small"] as const;
export type CoverSize = (typeof COVER_SIZES)[number];

function oneOf<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

// Accounts from before the theme setting go by their old dark mode switch
export function themeOf(user: { theme?: string | null; darkMode?: boolean } | null | undefined): Theme {
  if (!user) return "light";
  return oneOf(THEMES, user.theme, user.darkMode ? "dark" : "light");
}

export function libraryViewOf(user: { libraryView?: string } | null | undefined): LibraryView {
  return oneOf(LIBRARY_VIEWS, user?.libraryView, "cover");
}

export function coverSizeOf(user: { coverSize?: string } | null | undefined): CoverSize {
  return oneOf(COVER_SIZES, user?.coverSize, "large");
}

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}
export function isLibraryView(value: unknown): value is LibraryView {
  return LIBRARY_VIEWS.includes(value as LibraryView);
}
export function isCoverSize(value: unknown): value is CoverSize {
  return COVER_SIZES.includes(value as CoverSize);
}
