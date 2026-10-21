import type { MetaDescriptor } from "@remix-run/node";

export const SITE_URL = "https://bookstacks.site";
const SITE_NAME = "Stacks";
const DEFAULT_TITLE = "Stacks · Lend and borrow books with friends";
const DEFAULT_DESCRIPTION =
  "Keep track of the books you own, lend them to friends, and borrow theirs. A free lending library for your bookshelf.";

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
