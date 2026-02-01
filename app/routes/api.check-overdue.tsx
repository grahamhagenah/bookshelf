import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { getOverdueBooks, getBooksNearDue } from "~/models/book.server";
import { createOverdueReminderNotification } from "~/models/user.server";
import { prisma } from "~/db.server";

// This endpoint checks for overdue books and sends reminder notifications
// It can be called by a cron job (e.g., daily)
// Optionally pass ?key=YOUR_SECRET_KEY for security

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Optional: Add a secret key check for security
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const expectedKey = process.env.CRON_SECRET_KEY;

  if (expectedKey && key !== expectedKey) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const overdueBooks = await getOverdueBooks();
  const booksNearDue = await getBooksNearDue(3); // Books due within 3 days

  let remindersCreated = 0;

  // Process overdue books
  for (const book of overdueBooks) {
    if (!book.borrower || !book.user) continue;

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
      await createOverdueReminderNotification(
        book.userId,
        book.borrowerId!,
        ownerName,
        book.id,
        book.title
      );
      remindersCreated++;
    }
  }

  // Process books near due date
  for (const book of booksNearDue) {
    if (!book.borrower || !book.user) continue;

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

  return json({
    success: true,
    overdueCount: overdueBooks.length,
    nearDueCount: booksNearDue.length,
    remindersCreated,
  });
};
