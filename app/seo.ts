import type { MetaDescriptor } from "react-router";

export const SITE_URL = "https://bookstacks.app";
// Where the site used to live, and its www twins: sent on to SITE_URL
export const OLD_HOSTS = [
  "bookstacks.site",
  "www.bookstacks.site",
  "www.bookstacks.app",
];
const SITE_NAME = "Stacks";
// Worded the way people search: lending books to friends, keeping track of
// a home library, an alternative to Goodreads for the physical books
const DEFAULT_TITLE =
  "Stacks · Lend books to friends and track your home library";
const DEFAULT_DESCRIPTION =
  "Don't let your books collect dust. Stacks is a free book lending app: catalog the books you own, lend them to friends with due-date reminders so they come back, and borrow theirs.";

// The pages search engines may crawl and index, in the order the sitemap
// lists them. robots.txt and sitemap.xml are both made from this list, so
// a public page added here is allowed and listed at once. Everything else
// (libraries, friends, accounts) stays private.
export const PUBLIC_PAGES = [
  "/",
  "/join",
  "/login",
  "/faq",
  "/pricing",
  "/terms",
  "/privacy",
  "/lend-books-to-friends",
  "/goodreads-alternative",
  "/for-storygraph-readers",
];

// What a public page needs to render for a crawler: the built scripts,
// styles and fonts, the covers it shows, and the icons and preview image
const PUBLIC_ASSETS = [
  "/assets/",
  "/covers/",
  "/og-image.png",
  "/favicon",
  "/icon-",
  "/apple-touch-icon.png",
  "/site.webmanifest",
];

export function robotsTxt() {
  const allow = [
    // The home page alone, not everything under it
    "/$",
    ...PUBLIC_PAGES.filter((page) => page !== "/").map((page) => `${page}$`),
    ...PUBLIC_ASSETS,
  ];
  return [
    "# Only the public pages are worth indexing; libraries are private",
    "User-agent: *",
    ...allow.map((path) => `Allow: ${path}`),
    "Disallow: /",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemapXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PUBLIC_PAGES.map((page) => `  <url><loc>${SITE_URL}${page}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
}

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
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        {
          "@type": "Offer",
          name: "Stacks Plus",
          price: "3",
          priceCurrency: "USD",
          url: `${SITE_URL}/pricing`,
        },
      ],
      featureList: [
        "Catalog the books you own by search, barcode scan or import from Goodreads and StoryGraph",
        "Lend books to friends with due dates and reminders",
        "See which friends own a book and ask to borrow it",
        "A want-to-read list that tells you when a friend has the book",
        "Notes and hearts that stay with each copy",
        "Share one shelf with the people you live with",
      ],
      author: {
        "@type": "Person",
        name: "Graham Hagenah",
        url: "https://grahamhagenah.com",
      },
    },
  ],
};
