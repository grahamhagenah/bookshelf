import { prisma } from "~/db.server";

// Open Library's JSON, kept in the database. A fresh copy is answered at
// once; so is a stale one, while it's fetched again behind it; with none,
// it waits on Open Library (up to the timeout). A slow answer the caller
// stopped waiting for is still kept once it comes, for the next time.
// When Open Library fails, the last good answer stands in. The same
// question asked again while one's on its way shares it.

const DAY = 24 * 60 * 60 * 1000;
// How long an answer counts as fresh: searches turn up new books, a
// work's record hardly changes
export const SEARCH_MAX_AGE_MS = DAY;
export const RECORD_MAX_AGE_MS = 7 * DAY;
// Answers older than this are cleared out now and then: searches after a
// month, records (a work, an author, an edition) after a year, since
// they hardly change and stand in whenever Open Library is down
const KEEP_SEARCHES_MS = 30 * DAY;
const KEEP_RECORDS_MS = 365 * DAY;
// How long a request is let run, whether anyone's still waiting or not
const FETCH_TIMEOUT_MS = 20000;

// Open Library drops a connection now and then, and answers 5xx when it's
// busy; one more try a moment later usually gets through
const RETRY_AFTER_MS = 300;

const onTheirWay = new Map<string, Promise<unknown>>();

async function fetchWithRetry(url: string, signal: AbortSignal) {
  try {
    const res = await fetch(url, { signal });
    if (res.status < 500) return res;
  } catch (error) {
    // Out of time is out of time
    if (signal.aborted) throw error;
  }
  await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
  return fetch(url, { signal });
}

async function fetchAndKeep(url: string) {
  const res = await fetchWithRetry(url, AbortSignal.timeout(FETCH_TIMEOUT_MS));
  if (!res.ok) throw new Error(`Open Library answered ${res.status}`);
  const body = await res.text();
  const json: unknown = JSON.parse(body);
  const fetchedAt = new Date();
  await prisma.openLibraryResponse.upsert({
    where: { url },
    create: { url, body, fetchedAt },
    update: { body, fetchedAt },
  });
  if (Math.random() < 0.01) void clearOutOld();
  return json;
}

function fetchShared(url: string) {
  let pending = onTheirWay.get(url);
  if (!pending) {
    pending = fetchAndKeep(url).finally(() => onTheirWay.delete(url));
    onTheirWay.set(url, pending);
  }
  return pending;
}

// The answer, or an error once the caller has waited long enough. The
// request itself carries on.
function waitAtMost<T>(pending: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Open Library took too long")),
      timeoutMs,
    );
  });
  return Promise.race([pending, late]).finally(() => clearTimeout(timer));
}

export async function clearOutOld(now = Date.now()) {
  await prisma.openLibraryResponse
    .deleteMany({
      where: {
        OR: [
          {
            url: { contains: "/search.json" },
            fetchedAt: { lt: new Date(now - KEEP_SEARCHES_MS) },
          },
          { fetchedAt: { lt: new Date(now - KEEP_RECORDS_MS) } },
        ],
      },
    })
    .catch(() => undefined);
}

// Open Library's answers are loosely typed, as they always were here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function openLibraryJson<T = any>(
  url: string,
  {
    timeoutMs,
    maxAgeMs = RECORD_MAX_AGE_MS,
    // Asked for by someone refreshing a book: go to Open Library, and
    // fall back on what's kept only if it fails
    fresh = false,
  }: { timeoutMs: number; maxAgeMs?: number; fresh?: boolean },
): Promise<T> {
  const kept = await prisma.openLibraryResponse
    .findUnique({ where: { url } })
    .catch(() => null);
  if (kept && !fresh) {
    if (Date.now() - kept.fetchedAt.getTime() >= maxAgeMs) {
      fetchShared(url).catch(() => undefined);
    }
    return JSON.parse(kept.body) as T;
  }
  try {
    return (await waitAtMost(fetchShared(url), timeoutMs)) as T;
  } catch (error) {
    if (kept) return JSON.parse(kept.body) as T;
    throw error;
  }
}
