import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import sharp from "sharp";

import { loadCover } from "~/covers.server";
import { getPublicBookListItems } from "~/models/book.server";
import { shelfIds } from "~/models/household.server";
import { getUserByShareToken } from "~/models/user.server";
import { getShelfProfile } from "~/profile.server";

// The picture shown when a share link is pasted into iMessage, Slack and
// the like: a row of the owner's covers, favorites first, as the page
// itself opens with them. No text, since the card already shows the page's
// title and description underneath.

const WIDTH = 1200;
const HEIGHT = 630;
const COVER_WIDTH = 200;
const COVER_HEIGHT = 300;
const GAP = 28;
const MAX_COVERS = 5;
const SHADOW = 24;
// stone-100
const BACKGROUND = "#f5f5f4";

const coverMask = Buffer.from(
  `<svg width="${COVER_WIDTH}" height="${COVER_HEIGHT}"><rect width="${COVER_WIDTH}" height="${COVER_HEIGHT}" rx="4" fill="#fff"/></svg>`,
);

// A soft shadow under each cover, drawn once
const shadow = sharp(
  Buffer.from(
    `<svg width="${COVER_WIDTH + SHADOW * 2}" height="${COVER_HEIGHT + SHADOW * 2}"><rect x="${SHADOW}" y="${SHADOW + 6}" width="${COVER_WIDTH}" height="${COVER_HEIGHT}" rx="6" fill="rgba(28,25,23,0.22)"/></svg>`,
  ),
)
  .blur(10)
  .png()
  .toBuffer();

// Covers are stored as Open Library URLs; take the large size of each
function coverPath(url: string | null) {
  const match = url?.match(
    /^https:\/\/covers\.openlibrary\.org\/(b\/(?:id|isbn|olid)\/[A-Za-z0-9-]+)-[SML]\.jpg$/,
  );
  return match ? `${match[1]}-L.jpg` : null;
}

async function coverTile(path: string) {
  const bytes = await loadCover(path);
  if (!bytes) return null;
  try {
    const image = sharp(bytes);
    // Open Library answers unknown covers with a 1x1 pixel
    const { width = 0 } = await image.metadata();
    if (width <= 1) return null;
    return await image
      .resize(COVER_WIDTH, COVER_HEIGHT, { fit: "cover" })
      .composite([{ input: coverMask, blend: "dest-in" }])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

// Recently made previews, so a burst of link unfurls draws it once
const made = new Map<string, Buffer>();

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const user = params.token ? await getUserByShareToken(params.token) : null;
  if (!user) throw new Response("Not Found", { status: 404 });

  const [books, profile] = await Promise.all([
    getPublicBookListItems(await shelfIds(user.id)),
    getShelfProfile(user.id),
  ]);
  // Favorites, then the rest of the shelf, plus a few spares in case some
  // covers are missing
  const paths = [
    ...new Set(
      [...profile.favorites, ...books]
        .map((book) => coverPath(book.cover))
        .filter((path): path is string => path !== null),
    ),
  ].slice(0, MAX_COVERS + 3);

  const key = `${params.token}:${paths.join(",")}`;
  let image = made.get(key);

  if (!image) {
    const tiles = (await Promise.all(paths.map(coverTile)))
      .filter((tile) => tile !== null)
      .slice(0, MAX_COVERS);
    // Nothing to show: fall back to the site's own card
    if (tiles.length === 0) return redirect("/og-image.png");

    const rowWidth = tiles.length * COVER_WIDTH + (tiles.length - 1) * GAP;
    const left = Math.round((WIDTH - rowWidth) / 2);
    const top = Math.round((HEIGHT - COVER_HEIGHT) / 2);
    const shadowImage = await shadow;

    image = await sharp({
      create: { width: WIDTH, height: HEIGHT, channels: 3, background: BACKGROUND },
    })
      .composite(
        tiles.flatMap((tile, index) => {
          const x = left + index * (COVER_WIDTH + GAP);
          return [
            { input: shadowImage, left: x - SHADOW, top: top - SHADOW },
            { input: tile, left: x, top },
          ];
        }),
      )
      .jpeg({ quality: 85 })
      .toBuffer();

    if (made.size > 200) made.clear();
    made.set(key, image);
  }

  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(image.length),
      // The shelf changes now and then, so not forever
      "Cache-Control": "public, max-age=3600",
    },
  });
};
