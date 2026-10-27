// @vitest-environment node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import { routeArgs } from "../test/route";

import {
  COVER_PATH,
  coverHostAllowed,
  customCoverPath,
  isbnCoverParts,
  loadCover,
  loadCoverWebp,
} from "./covers.server";
import { loader as coverRoute } from "./routes/covers.$";

test("COVER_PATH allows only Open Library cover paths and the app's own", () => {
  expect(COVER_PATH.test("b/isbn/9780547928227-M.jpg")).toBe(true);
  expect(COVER_PATH.test("b/id/12345-L.jpg")).toBe(true);
  expect(COVER_PATH.test("b/olid/OL123M-S.jpg")).toBe(true);

  expect(COVER_PATH.test("b/isbn/9780547928227-XL.jpg")).toBe(false);
  expect(COVER_PATH.test("a/olid/OL1A-M.jpg")).toBe(false);
  expect(COVER_PATH.test("b/isbn/../../etc/passwd-M.jpg")).toBe(false);
  expect(COVER_PATH.test("b/isbn/1-M.jpg?x=1")).toBe(false);
});

test("loadCover refuses other paths without going to the network", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  expect(await loadCover("../../secrets.txt")).toBeNull();
  // A pasted cover is only ever on disk, so an unknown one isn't fetched either
  expect(
    await loadCover("custom/0000000000000000000000000000000000000000.jpg"),
  ).toBeNull();
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

test("a pasted cover is fetched from known picture hosts only, over https", () => {
  expect(
    coverHostAllowed(
      "https://m.media-amazon.com/images/I/714-3vCeaeL._AC_UF1000,1000_QL80_.jpg",
    ),
  ).toBe(true);
  expect(
    coverHostAllowed(
      "https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1.jpg",
    ),
  ).toBe(true);
  expect(coverHostAllowed("http://m.media-amazon.com/images/I/x.jpg")).toBe(
    false,
  );
  expect(coverHostAllowed("https://example.com/cover.jpg")).toBe(false);
  expect(
    coverHostAllowed("https://evil.media-amazon.com.attacker.net/x.jpg"),
  ).toBe(false);
  expect(coverHostAllowed("https://localhost/x.jpg")).toBe(false);
  expect(coverHostAllowed("not a url")).toBe(false);
});

test("a pasted cover's path is a hash of its link, and the proxy knows it", () => {
  const path = customCoverPath("https://m.media-amazon.com/images/I/a.jpg");
  expect(path).toMatch(/^custom\/[a-f0-9]{40}\.jpg$/);
  expect(COVER_PATH.test(path)).toBe(true);
  expect(COVER_PATH.test("custom/../b/id/1-L.jpg")).toBe(false);
  expect(COVER_PATH.test("b/isbn/9780547928227-M.jpg")).toBe(true);
});

test("an ISBN cover is fetched by its edition's cover ID, which isn't rate limited", async () => {
  const isbn = `978${String(Math.random()).slice(2, 12)}`;
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (url === `https://openlibrary.org/isbn/${isbn}.json`) {
      return new Response(JSON.stringify({ covers: [4321] }), { status: 200 });
    }
    if (url.startsWith("https://covers.openlibrary.org/b/id/4321-")) {
      return new Response(new Uint8Array(500), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  expect((await loadCover(`b/isbn/${isbn}-M.jpg`))?.length).toBe(500);
  expect((await loadCover(`b/isbn/${isbn}-L.jpg`))?.length).toBe(500);
  // The edition is asked once; neither picture is asked for by ISBN
  expect(calls).toEqual([
    `https://openlibrary.org/isbn/${isbn}.json`,
    "https://covers.openlibrary.org/b/id/4321-M.jpg",
    "https://covers.openlibrary.org/b/id/4321-L.jpg",
  ]);
  vi.unstubAllGlobals();
});

test("an edition without a picture isn't asked for one", async () => {
  const isbn = `978${String(Math.random()).slice(2, 12)}`;
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ covers: [] }), { status: 200 });
  });
  expect(await loadCover(`b/isbn/${isbn}-M.jpg`)).toBeNull();
  expect(calls).toEqual([`https://openlibrary.org/isbn/${isbn}.json`]);
  vi.unstubAllGlobals();
});

test("isbnCoverParts reads Open Library ISBN covers only", () => {
  expect(
    isbnCoverParts("https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg"),
  ).toEqual({
    isbn: "9780547928227",
    size: "L",
  });
  expect(isbnCoverParts("b/isbn/014044913X-M.jpg")).toEqual({
    isbn: "014044913X",
    size: "M",
  });
  expect(
    isbnCoverParts("https://covers.openlibrary.org/b/id/12345-L.jpg"),
  ).toBeNull();
  expect(isbnCoverParts("/covers/custom/abc.jpg")).toBeNull();
});

test("an empty file left in the cache is fetched again, not served", async () => {
  const id = String(Math.random()).slice(2, 10);
  const dir = process.env.COVER_CACHE_DIR ?? path.join(os.tmpdir(), "stacks-covers");
  const file = path.join(dir, `b_id_${id}-M.jpg`);
  await mkdir(dir, { recursive: true });
  await writeFile(file, "");
  vi.stubGlobal(
    "fetch",
    async () => new Response(new Uint8Array(800), { status: 200 }),
  );

  expect((await loadCover(`b/id/${id}-M.jpg`))?.length).toBe(800);
  // And put right on disk
  expect((await readFile(file)).length).toBe(800);
  vi.unstubAllGlobals();
});

// A kept cover by ID, as if fetched earlier: a real JPEG with some detail
async function keptCover(bytes?: Buffer) {
  const id = String(Math.random()).slice(2, 10);
  const dir = process.env.COVER_CACHE_DIR ?? path.join(os.tmpdir(), "stacks-covers");
  await mkdir(dir, { recursive: true });
  const jpeg =
    bytes ??
    (await sharp(Buffer.from(Array.from({ length: 180 * 270 * 3 }, (_, i) => (i * 37) % 251)), {
      raw: { width: 180, height: 270, channels: 3 },
    })
      .jpeg({ quality: 90 })
      .toBuffer());
  await writeFile(path.join(dir, `b_id_${id}-M.jpg`), jpeg);
  return { coverPath: `b/id/${id}-M.jpg`, file: path.join(dir, `b_id_${id}-M.jpg`), jpeg };
}

test("a cover as WebP is smaller than the JPEG, made once and kept beside it", async () => {
  const { coverPath, file, jpeg } = await keptCover();
  const webp = await loadCoverWebp(coverPath);
  expect(webp?.subarray(8, 12).toString("ascii")).toBe("WEBP");
  expect(webp!.length).toBeLessThan(jpeg.length);
  expect(await readFile(`${file}.webp`)).toEqual(webp);
  // The JPEG stays as it was, for browsers that don't take WebP
  expect(await loadCover(coverPath)).toEqual(jpeg);
});

test("a picture that can't be made into WebP is served as it was", async () => {
  // Not an image sharp can read, but big enough to be kept
  const { coverPath } = await keptCover(Buffer.alloc(600, 7));
  expect(await loadCoverWebp(coverPath)).toEqual(Buffer.alloc(600, 7));
});

test("the cover route gives WebP to browsers that take it, and JPEG to the rest", async () => {
  const { coverPath } = await keptCover();
  const get = (accept: string) =>
    coverRoute(
      routeArgs(new Request(`http://localhost/covers/${coverPath}`, { headers: { Accept: accept } }), {
        "*": coverPath,
      }),
    );

  const webp = await get("image/avif,image/webp,*/*");
  expect(webp.headers.get("Content-Type")).toBe("image/webp");
  expect(webp.headers.get("Vary")).toBe("Accept");

  const jpeg = await get("image/png,image/*;q=0.8");
  expect(jpeg.headers.get("Content-Type")).toBe("image/jpeg");
  expect(jpeg.headers.get("Vary")).toBe("Accept");
});
