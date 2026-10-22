import type { MetaDescriptor } from "@remix-run/node";

export const SITE_URL = "https://bookstacks.site";
const SITE_NAME = "Stacks";
// Worded the way people search: lending books to friends, keeping track of
// a home library, an alternative to Goodreads for the physical books
const DEFAULT_TITLE = "Stacks · Lend books to friends and track your home library";
const DEFAULT_DESCRIPTION =
  "A free book lending app. Catalog the books you own, lend them to friends with due-date reminders so they come back, and borrow theirs.";

// Title, description, canonical link and social card for one page.
// Private pages pass noindex so search engines leave them out.
export function seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image = `${SITE_URL}/og-image.png`,
  noindex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  // An absolute URL to a 1200x630 picture for link previews
  image?: string;
  noindex?: boolean;
} = {}): MetaDescriptor[] {
  const fullTitle = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE;
  const tags: MetaDescriptor[] = [
    { title: fullTitle },
    { name: "description", content: description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: "website" },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
  if (path) {
    tags.push(
      { property: "og:url", content: `${SITE_URL}${path}` },
      { tagName: "link", rel: "canonical", href: `${SITE_URL}${path}` },
    );
  }
  if (noindex) tags.push({ name: "robots", content: "noindex" });
  return tags;
}

// A machine-readable description of a page for search engines (JSON-LD),
// added alongside seo() in a route's meta
export function structuredData(data: Record<string, unknown>): MetaDescriptor {
  return { "script:ld+json": { "@context": "https://schema.org", ...data } };
}

// What Stacks is, for the front page
export const ABOUT_STACKS = {
  "@graph": [
    {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
    },
    {
      "@type": "WebApplication",
      name: SITE_NAME,
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires a modern web browser",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "Catalog the books you own by search, barcode scan or import from Goodreads and StoryGraph",
        "Lend books to friends with due dates and reminders",
        "See which friends own a book and ask to borrow it",
        "A want-to-read list that tells you when a friend has the book",
        "Notes and hearts that stay with each copy",
        "Share one shelf with the people you live with",
      ],
      author: { "@type": "Person", name: "Graham Hagenah", url: "https://grahamhagenah.com" },
    },
  ],
};
