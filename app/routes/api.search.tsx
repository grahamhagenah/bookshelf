import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { getWantToReadWorks } from "~/models/wish.server";
import { NO_RESULTS, searchOpenLibrary } from "~/search.server";
import { getUserId } from "~/session.server";

// Open Library's results for the search page, fetched once the page is up

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const searchType = url.searchParams.get("type") || "all";
  const language = url.searchParams.get("lang") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const key = url.searchParams.toString();
  if (!query.trim()) return json({ ...NO_RESULTS, key });
  const wishes = userId ? await getWantToReadWorks(userId) : [];
  return json({ ...(await searchOpenLibrary({ query, searchType, language, page, wishes })), key });
};
