

import type { LoaderFunctionArgs } from "react-router";

import { prisma } from "~/db.server";
import { shelfIds } from "~/models/household.server";
import { findCovers } from "~/models/openlibrary.server";
import { pageUrl } from "~/page-url";
import { requireUserId } from "~/session.server";

// Covers Open Library has for one of your books, for the picker on the
// book page's edit form

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const bookId = pageUrl(request).searchParams.get("bookId");
  // Anyone sharing the shelf the book is on can pick its cover
  const book = bookId
    ? await prisma.book.findFirst({
        where: { id: bookId, userId: { in: await shelfIds(userId) } },
        select: { title: true, author: true, isbn: true, openLibraryKey: true },
      })
    : null;
  if (!book) throw new Response("Not Found", { status: 404 });
  // Open Library can be slow or down. Say so, rather than fail the page
  // the picker sits on.
  try {
    return Response.json({ covers: await findCovers(book), failed: false });
  } catch {
    return Response.json({ covers: [], failed: true });
  }
};

export type CoversResponse = Awaited<ReturnType<typeof findCovers>>;
