import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { prisma } from "~/db.server";
import { findCovers } from "~/models/openlibrary.server";
import { requireUserId } from "~/session.server";

// Covers Open Library has for one of your books, for the picker on the
// book page's edit form

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const bookId = new URL(request.url).searchParams.get("bookId");
  const book = bookId
    ? await prisma.book.findFirst({
        where: { id: bookId, userId },
        select: { title: true, author: true, isbn: true, openLibraryKey: true },
      })
    : null;
  if (!book) throw new Response("Not Found", { status: 404 });
  return json({ covers: await findCovers(book) });
};

export type CoversResponse = Awaited<ReturnType<typeof findCovers>>;
