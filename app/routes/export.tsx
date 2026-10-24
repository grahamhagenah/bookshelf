import type { LoaderFunctionArgs } from "@remix-run/node";

import { booksToCsv } from "~/export-books";
import { getExportBooks } from "~/models/book.server";
import { shelfIds } from "~/models/household.server";
import { requireUserId } from "~/session.server";

// The whole shelf as a CSV download, from the account page
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const books = await getExportBooks(userId, await shelfIds(userId));
  const date = new Date().toISOString().slice(0, 10);
  return new Response(booksToCsv(books), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stacks-shelf-${date}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
};
