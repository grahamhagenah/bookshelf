import { useMemo } from "react";
import { useLoaderData, useMatches } from "react-router";

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
  return route?.loaderData as Record<string, unknown>;
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

export function validateEmail(email: unknown): email is string {
  return typeof email === "string" && email.length > 3 && email.includes("@");
}

// How every address is stored and looked up: "Jane@Gmail.com " and
// "jane@gmail.com" are the same person, and the database compares exactly
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
// Signup bot checks: a hidden field people never see but form-filling bots
// do, and a minimum time between the form loading and being sent
export const HONEYPOT_FIELD = "website";
export const MIN_SIGNUP_MS = 2000;

// Whether a form's hidden field was filled in, which only bots do
export function filledHoneypot(formData: FormData) {
  const trap = formData.get(HONEYPOT_FIELD);
  return typeof trap === "string" && trap.length > 0;
}

export function looksLikeBot(
  formData: FormData,
  now = Date.now(),
): "honeypot" | "too-fast" | null {
  if (filledHoneypot(formData)) return "honeypot";
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
// The page for a book that's on no shelf yet, from its Open Library work
// key ("/works/OL45804W"); null when there's no key or it isn't a work
export function workPath(openLibraryKey: string | null | undefined) {
  const olid = openLibraryKey?.match(/^\/works\/(OL\d+W)$/)?.[1];
  return olid ? `/works/${olid}` : null;
}

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
export const isLatin = (text: string) =>
  /^[\p{Script=Latin}\p{M}\p{N}\p{P}\p{S}\s]*$/u.test(text);

const shouting = (name: string) =>
  name
    .split(/\s+/)
    .some((word) => word.length > 1 && word === word.toUpperCase());

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
    (other) =>
      isLatin(other) &&
      !other.includes(",") &&
      !shouting(other) &&
      other.trim().includes(" "),
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
  editions?: {
    docs?: { title?: string; language?: string[]; publisher?: string[] }[];
  };
}

// Audiobook houses, whose edition isn't the copy on the shelf
const AUDIO_HOUSE =
  /audio|audible|blackstone|brilliance|tantor|recorded books/i;
// A large-print imprint names the usual publisher with a suffix
const LARGE_PRINT = /\s*large print\s*$/i;

export function editionPublisher(doc: WithEnglishEdition): string | null {
  // Only an English edition's publisher: no publisher beats a translation's
  const named = (doc.editions?.docs ?? []).filter(
    (edition) =>
      (!edition.language || edition.language.includes("eng")) &&
      edition.publisher?.[0],
  );
  const house = (edition: { publisher?: string[] }) =>
    edition.publisher?.[0] ?? "";
  // The usual print edition; failing that, the large-print one's imprint
  const usual =
    named.find(
      (e) => !AUDIO_HOUSE.test(house(e)) && !LARGE_PRINT.test(house(e)),
    ) ?? named.find((e) => !AUDIO_HOUSE.test(house(e)));
  const raw = usual ? house(usual).replace(LARGE_PRINT, "") : "";
  if (!raw) return null;
  // Some arrive with library catalog codes: "#bVintage, #c2009." is Vintage
  const parts = raw
    .replace(/#[a-z]/g, "")
    .split(",")
    .map((part) => part.trim().replace(/[.;:]+$/, ""))
    .filter((part) => part && !/^\[?c?\d{4}\]?$/.test(part));
  return parts.join(", ") || null;
}

// Open Library's search mixes in what gets sold around a book: summaries,
// study guides, workbooks, journals, box sets, and copycat listings of the
// title itself. Those go, or go to the end, so the book people mean comes
// first.
export interface SearchDoc {
  title?: string;
  author_name?: string[];
  publisher?: string[];
  edition_count?: number;
  cover_i?: number;
}

// Words that are the whole point of such a listing
const KNOCKOFF_TITLE =
  /\b(summary|summaries|summarized|study guide|key takeaways|conversation starters|resumen|instaread|sparknotes|cliffsnotes|readtrepreneur)\b/i;
// Words that only mean one when the listing is thin: no cover, or self-published
const THIN_TITLE =
  /\b(workbook|work book|journal|tracker|analysis|notes on|trivia|quiz|sidekick|companion)\b/i;
const KNOCKOFF_AUTHOR =
  /\b(summary|summaries|editorial|key notes|instaread|readtrepreneur|sparknotes|cliffsnotes|book summary)\b/i;
const SELF_PUBLISHED =
  /independently published|createspace|lulu\.com|irb media|supersummary|kdp/i;
const COLLECTION =
  /\b(box(ed)? set|collection set|\d+[- ]book|omnibus|complete (series|collection|set))\b|\s\/\s/i;

const selfPublished = (doc: SearchDoc) =>
  (doc.publisher ?? []).some((p) => SELF_PUBLISHED.test(p));
const thin = (doc: SearchDoc) => !doc.cover_i || selfPublished(doc);

export function isKnockoff(doc: SearchDoc): boolean {
  const title = doc.title ?? "";
  const author = doc.author_name?.[0] ?? "";
  if (KNOCKOFF_TITLE.test(title) || KNOCKOFF_AUTHOR.test(author)) return true;
  return THIN_TITLE.test(title) && thin(doc);
}

export const isCollection = (doc: SearchDoc) =>
  COLLECTION.test(doc.title ?? "");

// The same title twice: a real book and a thin listing of its name. The
// thin one goes.
const titleKey = (title: string) =>
  title
    .split(":")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function tidySearchResults<T extends SearchDoc>(docs: T[]): T[] {
  const kept = docs.filter((doc) => !isKnockoff(doc));
  const strongest = new Map<string, number>();
  for (const doc of kept) {
    const key = titleKey(doc.title ?? "");
    strongest.set(
      key,
      Math.max(strongest.get(key) ?? 0, doc.edition_count ?? 0),
    );
  }
  const real = kept.filter((doc) => {
    const best = strongest.get(titleKey(doc.title ?? "")) ?? 0;
    const copycat = (doc.edition_count ?? 0) <= 1 && thin(doc) && best >= 5;
    return !copycat;
  });
  // Box sets and omnibus editions after the books themselves
  return [
    ...real.filter((doc) => !isCollection(doc)),
    ...real.filter(isCollection),
  ];
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
    if (match && match[1].toLowerCase() !== "english")
      languages.add(match[1].toLowerCase());
  }
  return [...languages];
}

export function cleanSubjects(
  subjects: string[] | string | null | undefined,
  max = 5,
) {
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
  return (
    text
      .replace(/\r/g, "")
      .replace(/\s*\(\[[^\]]*\]\[\d+\]\)/g, "")
      .replace(/^\s*\[\d+\]:.*$/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Italics first, so bold text that contains italics unwraps cleanly
      .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,;:!?]|$)/g, "$1$2")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// Appearance settings, kept on the account so they follow you between devices
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const COVER_SIZES = ["large", "small"] as const;
export type CoverSize = (typeof COVER_SIZES)[number];

function oneOf<T extends string>(
  options: readonly T[],
  value: unknown,
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

// Accounts from before the theme setting go by their old dark mode switch
export function themeOf(
  user: { theme?: string | null; darkMode?: boolean } | null | undefined,
): Theme {
  if (!user) return "light";
  return oneOf(THEMES, user.theme, user.darkMode ? "dark" : "light");
}

export function coverSizeOf(
  user: { coverSize?: string } | null | undefined,
): CoverSize {
  return oneOf(COVER_SIZES, user?.coverSize, "large");
}

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}
export function isCoverSize(value: unknown): value is CoverSize {
  return COVER_SIZES.includes(value as CoverSize);
}

// How long ago, in words: "today", "yesterday", "3 days ago", "2 months ago"
export function agoInWords(date: string | Date) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// What a page gets from its loader, as useLoaderData gives it: the data as
// the loader returned it, dates and all
export type LoaderData<T> = ReturnType<typeof useLoaderData<T>>;
