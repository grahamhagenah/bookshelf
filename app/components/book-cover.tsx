import { useState } from "react";

import { coverSrc } from "~/utils";

import CoverPlaceholder from "./cover-placeholder";

// A book's cover in a clipped box, over the title-and-author placeholder.
// The placeholder shows while the picture loads and stays if there is no
// picture, if it fails to load, or if Open Library answers with its 1x1
// "no cover" pixel. It's checked once the image is in the page as well,
// since a cached cover can load or fail before React attaches its
// handlers, which otherwise leaves the browser's broken-image icon.
export default function BookCover({
  cover,
  src,
  srcSet,
  sizes,
  size = "M",
  title,
  author,
  alt = "",
  className = "",
  eager = false,
  compact = false,
}: {
  // The cover's address as stored, turned into the site's own URL at `size`
  cover?: string | null;
  // Or the exact image sources, when the caller has worked them out
  src?: string;
  srcSet?: string;
  sizes?: string;
  size?: "M" | "L";
  title: string;
  author?: string | null;
  alt?: string;
  className?: string;
  // The first row of a page is usually on screen right away
  eager?: boolean;
  // A tiny tile: the placeholder shows one letter, not the title
  compact?: boolean;
}) {
  const source = src ?? (cover ? coverSrc(cover, size) : null);
  // Given how wide it shows (sizes), an Open Library cover also offers its
  // large scan, so a sharp screen fetches that instead of stretching the
  // medium one
  const sharp =
    !src && !srcSet && sizes && source && /-[ML]\.jpg$/.test(source)
      ? `${source.replace(/-[ML]\.jpg$/, "-M.jpg")} 180w, ${source.replace(/-[ML]\.jpg$/, "-L.jpg")} 400w`
      : undefined;
  const sources = srcSet ?? sharp;
  const [state, setState] = useState<"loading" | "shown" | "failed">(source ? "loading" : "failed");
  const check = (img: HTMLImageElement) => setState(img.naturalWidth <= 1 ? "failed" : "shown");

  // Small corners: scans often carry a thin border, and tight corners keep
  // it reading as part of the cover rather than a clipped edge
  return (
    // The name is on the box, not the picture: a picture with alt text that
    // fails shows that text and a "?" until the failure is noticed, where
    // one with an empty alt shows nothing over the placeholder
    <span
      className={`relative block overflow-hidden rounded-xs ring-1 ring-stone-900/5 dark:ring-white/10 ${className}`}
      {...(alt ? { role: "img", "aria-label": alt } : {})}
    >
      {state !== "shown" ? <CoverPlaceholder title={title} author={author} compact={compact} className="absolute inset-0" /> : null}
      {source && state !== "failed" ? (
        <img
          src={source}
          srcSet={sources}
          sizes={sources ? sizes : undefined}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          // Visible from the first paint, over the placeholder
          className="relative h-full w-full object-cover"
          ref={(img) => {
            if (img?.complete) check(img);
          }}
          onLoad={(e) => check(e.currentTarget)}
          onError={() => setState("failed")}
        />
      ) : null}
    </span>
  );
}
