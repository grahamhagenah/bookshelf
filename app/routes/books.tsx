import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { getBookListItems, getBorrowedBooks } from "~/models/book.server";
import { requireUserId } from "~/session.server";
import { getUserById } from "~/models/user.server";
import Library from "~/components/library";

export const handle = {
  breadcrumb: () => <Link to="/books">Books</Link>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId)
  const ownedBooks = await getBookListItems(userId);
  const borrowedBooks = await getBorrowedBooks(userId);

  // Mark borrowed books and lending books, then combine
  const ownedWithFlag = ownedBooks.map(book => ({
    ...book,
    isBorrowed: false,
    isLending: book.borrowerId !== null
  }));
  const borrowedWithFlag = borrowedBooks.map(book => ({
    ...book,
    isBorrowed: true,
    isLending: false
  }));
  const bookListItems = [...ownedWithFlag, ...borrowedWithFlag];

  return json({ user, bookListItems });
}

export default function BooksPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <Library bookListItems={data.bookListItems} />
  );
}
