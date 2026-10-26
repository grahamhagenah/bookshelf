

import type { ActionFunctionArgs } from "react-router";

import { prisma } from "~/db.server";
import { createBook } from "~/models/book.server";
import { shelfIds } from "~/models/household.server";
import { PATIENT_MS, lookupWork } from "~/models/openlibrary.server";
import { notifyWanters } from "~/models/wish.server";
import { roomForBooks } from "~/plan.server";
import { requireUserId } from "~/session.server";
import { sameWork } from "~/works";

// Adds a book by its ISBN, for the barcode scanner

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const raw = (await request.formData()).get("isbn");
  const isbn = typeof raw === "string" ? raw.replace(/[^0-9Xx]/g, "") : "";
  if (isbn.length !== 10 && isbn.length !== 13) {
    return Response.json({ error: "That isn't an ISBN" }, { status: 400 });
  }

  // The free plan's shelf is full
  if ((await roomForBooks(userId)) < 1) return Response.json({ limit: true as const }, { status: 403 });

  let found;
  try {
    // Someone is holding a book up to the camera: wait out a slow day
    found = await lookupWork({ title: "", author: "", isbn }, PATIENT_MS);
  } catch {
    return Response.json({ error: "Open Library didn't answer" }, { status: 502 });
  }
  if (!found || !found.title) return Response.json({ error: "Not on Open Library" }, { status: 404 });

  // The same book, scanned twice or added some other way (older
  // copies may have neither ISBN nor work key, so titles count too)
  const shelf = await prisma.book.findMany({
    where: { userId: { in: await shelfIds(userId) } },
    select: { title: true, isbn: true, openLibraryKey: true },
  });
  const existing = shelf.find(
    (book) =>
      book.isbn === isbn ||
      sameWork(book, { title: found.title ?? "", openLibraryKey: found.key, isbn: found.isbn }),
  );
  if (existing) return Response.json({ alreadyExists: true as const, title: existing.title });

  const book = await createBook({
    title: found.title,
    author: found.author ?? "",
    body: "",
    cover: found.cover ?? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
    datePublished: found.datePublished,
    pageCount: found.pageCount,
    subjects: found.subjects,
    publisher: found.publisher,
    openLibraryKey: found.key,
    isbn,
    userId,
  });
  await notifyWanters(userId, [book]);
  return Response.json({
    added: { id: book.id, title: book.title, author: book.author, cover: book.cover },
  });
};

export type ScanResponse =
  | { added: { id: string; title: string; author: string; cover: string } }
  | { alreadyExists: true; title: string }
  | { limit: true }
  | { error: string };
