

import type { LoaderFunctionArgs } from "react-router";

import { cronAuthorized } from "~/cron.server";
import { prisma } from "~/db.server";
import { getOverdueBooks, getBooksNearDue } from "~/models/book.server";
import { createReminderNotification } from "~/models/user.server";

// Checks for overdue and nearly-due books and sends reminders. Run daily by
// GitHub's scheduled workflow, which holds CRON_SECRET_KEY. A book lent by
// name only has no borrower to remind, so its owner hears instead.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!cronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overdueBooks = await getOverdueBooks();
  const booksNearDue = await getBooksNearDue(3); // Books due within 3 days

  let remindersCreated = 0;

  // Process overdue books
  for (const book of overdueBooks) {
    if (!book.borrower || !book.user) continue;
    if (book.borrower.nameOnly) {
      if (await remindOwner(book, "LOAN_OVERDUE")) remindersCreated++;
      continue;
    }

    // Check if we already sent an unread overdue reminder for this book
    const existingReminder = await prisma.notification.findFirst({
      where: {
        type: "OVERDUE_REMINDER",
        bookId: book.id,
        receiverId: book.borrowerId!,
        read: false,
      },
    });

    if (!existingReminder) {
      const ownerName = `${book.user.firstname} ${book.user.surname}`;
      await createReminderNotification(
        book.userId,
        book.borrowerId!,
        ownerName,
        book.id,
        book.title,
        true,
      );
      remindersCreated++;
    }
  }

  // Process books near due date
  for (const book of booksNearDue) {
    if (!book.borrower || !book.user) continue;
    if (book.borrower.nameOnly) {
      if (await remindOwner(book, "LOAN_DUE_SOON")) remindersCreated++;
      continue;
    }

    // Check if we already sent an unread due soon reminder for this book
    const existingReminder = await prisma.notification.findFirst({
      where: {
        type: "DUE_SOON_REMINDER",
        bookId: book.id,
        receiverId: book.borrowerId!,
        read: false,
      },
    });

    if (!existingReminder) {
      const ownerName = `${book.user.firstname} ${book.user.surname}`;
      await prisma.notification.create({
        data: {
          type: "DUE_SOON_REMINDER",
          receiver: { connect: { id: book.borrowerId! } },
          sender: { connect: { id: book.userId } },
          senderName: ownerName,
          book: { connect: { id: book.id } },
          bookTitle: book.title,
        },
      });
      remindersCreated++;
    }
  }

  return Response.json({
    success: true,
    overdueCount: overdueBooks.length,
    nearDueCount: booksNearDue.length,
    remindersCreated,
  });
};

// The owner's reminder about a book lent by name: once, until they've
// read it. Whether one was made.
async function remindOwner(
  book: {
    id: string;
    title: string;
    userId: string;
    borrower: { id: string; firstname: string; surname: string } | null;
  },
  type: "LOAN_OVERDUE" | "LOAN_DUE_SOON",
) {
  if (!book.borrower) return false;
  const already = await prisma.notification.findFirst({
    where: { type, bookId: book.id, receiverId: book.userId, read: false },
  });
  if (already) return false;
  await prisma.notification.create({
    data: {
      type,
      receiver: { connect: { id: book.userId } },
      sender: { connect: { id: book.borrower.id } },
      senderName: `${book.borrower.firstname} ${book.borrower.surname}`.trim(),
      book: { connect: { id: book.id } },
      bookTitle: book.title,
    },
  });
  return true;
}
