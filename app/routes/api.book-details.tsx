

import type { LoaderFunctionArgs } from "react-router";

import { prisma } from "~/db.server";
import { fillInBookOnce } from "~/models/openlibrary.server";
import { pageUrl } from "~/page-url";
import { requireUserId } from "~/session.server";

// Finishes a book's first look-up on Open Library. The book page asks
// for this once it's up, then reloads its data when it answers.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireUserId(request);
  const bookId = pageUrl(request).searchParams.get("bookId");
  const book = bookId
    ? await prisma.book.findUnique({ where: { id: bookId }, select: { id: true, detailsFetchedAt: true } })
    : null;
  if (!book) throw new Response("Not Found", { status: 404 });
  if (!book.detailsFetchedAt) await fillInBookOnce(book.id);
  const after = await prisma.book.findUnique({ where: { id: book.id }, select: { detailsFetchedAt: true } });
  return Response.json({ done: Boolean(after?.detailsFetchedAt) });
};
