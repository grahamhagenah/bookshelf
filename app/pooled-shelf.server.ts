import type { User } from "@prisma/client";

import { groupPath } from "~/group-links";
import { POOL_PAGE, POOL_SORTS, POOL_STATUSES, getPoolWanted, searchPool } from "~/models/pool.server";

// What a pooled shelf page loads, a group's or all your friends': the
// filters from the address, the matching books, and, until you filter,
// what's on your want-to-read list

// How many from your want-to-read list come first
const WANTED_SHOWN = 6;
// The most a search shows, however many times Show more is pressed
const POOL_MOST = 1000;

export async function loadPooledShelf(
  request: Request,
  userId: User["id"],
  openIds: string[],
  {
    lenders,
    groups = [],
  }: {
    // Whose books can be picked out, in the Anyone menu
    lenders: { id: string; firstname: string; surname: string }[];
    // Groups to narrow it to, the same menu: everyone in one of them
    groups?: { id: string; name: string; memberIds: string[] }[];
  },
) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  // One person (their id) or one group ("g:" and its id)
  const whoParam = url.searchParams.get("who") ?? "";
  const group = whoParam.startsWith("g:") ? groups.find((g) => g.id === whoParam.slice(2)) ?? null : null;
  const who = !group && openIds.includes(whoParam) ? whoParam : null;
  const scope = group ? openIds.filter((id) => group.memberIds.includes(id)) : openIds;
  const statusParam = url.searchParams.get("status");
  const status = POOL_STATUSES.find((option) => option === statusParam) ?? "all";
  const sortParam = url.searchParams.get("sort");
  const sort = POOL_SORTS.find((option) => option === sortParam) ?? "newest";
  const asked = Number(url.searchParams.get("shown"));
  const shown = Math.min(POOL_MOST, Math.max(POOL_PAGE, Number.isFinite(asked) ? Math.floor(asked) : POOL_PAGE));
  // A group narrows the shelf rather than filtering it: its want-to-read
  // row still shows
  const filtered = Boolean(q.trim() || who || status !== "all");
  // Until you search or filter, what's on your want-to-read list comes
  // first, and isn't repeated in the list below it
  const wanted = filtered ? [] : (await getPoolWanted(userId, scope)).wanted.slice(0, WANTED_SHOWN);
  const results = await searchPool(scope, {
    q,
    who,
    status,
    sort,
    shown,
    exclude: wanted.map((work) => work.key),
  });
  return {
    search: { q, who: group ? `g:${group.id}` : who, status, sort, shown, filtered },
    results,
    wanted,
    lenders: lenders.map(({ id, firstname, surname }) => ({ id, firstname, surname })),
    groups: groups.map(({ id, name }) => ({ id, name, path: groupPath({ id, name }) })),
    // The group it's narrowed to, if it is
    group: group ? { id: group.id, name: group.name, path: groupPath(group) } : null,
    pageSize: POOL_PAGE,
  };
}
