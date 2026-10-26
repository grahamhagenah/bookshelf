import type { User } from "@prisma/client";

import { POOL_PAGE, POOL_SORTS, POOL_STATUSES, getPoolWanted, searchPool } from "~/models/pool.server";

// What a pooled shelf page loads, a group's or all your friends': the
// filters from the address, the matching books, and, until you filter,
// what's on your want-to-read list

// The most a search shows, however many times Show more is pressed
const POOL_MOST = 1000;

export async function loadPooledShelf(
  request: Request,
  userId: User["id"],
  openIds: string[],
  // Whose books can be picked out, in the Anyone menu
  lenders: { id: string; firstname: string; surname: string }[],
) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  const whoParam = url.searchParams.get("who");
  const who = whoParam && openIds.includes(whoParam) ? whoParam : null;
  const statusParam = url.searchParams.get("status");
  const status = POOL_STATUSES.find((option) => option === statusParam) ?? "all";
  const sortParam = url.searchParams.get("sort");
  const sort = POOL_SORTS.find((option) => option === sortParam) ?? "newest";
  const asked = Number(url.searchParams.get("shown"));
  const shown = Math.min(POOL_MOST, Math.max(POOL_PAGE, Number.isFinite(asked) ? Math.floor(asked) : POOL_PAGE));
  const filtered = Boolean(q.trim() || who || status !== "all");
  const [results, highlights] = await Promise.all([
    searchPool(openIds, { q, who, status, sort, shown }),
    filtered ? null : getPoolWanted(userId, openIds),
  ]);
  return {
    search: { q, who, status, sort, shown, filtered },
    results,
    wanted: highlights?.wanted ?? [],
    lenders: lenders.map(({ id, firstname, surname }) => ({ id, firstname, surname })),
    pageSize: POOL_PAGE,
  };
}
