import type {
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import Library from "~/components/library";
import ShelfTabs from "~/components/shelf-tabs";
import { getBookListItems, getBorrowedBooks, readAtFor } from "~/models/book.server";
import { getShelfCounts } from "~/models/history.server";
import { getHousehold, shelfIds } from "~/models/household.server";
import { getLoveCounts } from "~/models/note.server";
import { getUserById } from "~/models/user.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

export const meta: MetaFunction = () =>
  seo({ title: "My books", noindex: true });

export const handle = {
  breadcrumb: () => <Link to="/books">My books</Link>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  const ownedBooks = await getBookListItems(await shelfIds(userId));
  const borrowedBooks = await getBorrowedBooks(userId);

  // Mark borrowed books and lending books, then combine
  const ownedWithFlag = ownedBooks.map(({ readerNotes, ...book }) => ({
    ...book,
    readAt: readAtFor(userId, { ...book, readerNotes }),
    isBorrowed: false,
    isLending: book.borrowerId !== null,
  }));
  const borrowedWithFlag = borrowedBooks.map((book) => ({
    ...book,
    isBorrowed: true,
    isLending: false,
  }));
  const books = [...ownedWithFlag, ...borrowedWithFlag];
  const loveCounts = await getLoveCounts(books.map((book) => book.id));
  const bookListItems = books.map((book) => ({
    ...book,
    loveCount: loveCounts.get(book.id) ?? 0,
  }));

  // Everyone on a shared shelf, said once at the top
  const household = await getHousehold(userId);
  const sharedWith =
    household && household.members.length > 1
      ? {
          viewerId: userId,
          members: household.members.map(({ id, firstname, surname, profileEmoji }) => ({
            id,
            firstname,
            surname,
            profileEmoji,
          })),
        }
      : null;

  return json({ user, bookListItems, counts: await getShelfCounts(userId), sharedWith });
};

export default function BooksPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <>
      <Library
        bookListItems={data.bookListItems}
        sharedWith={data.sharedWith}
        header={
          <ShelfTabs counts={data.counts} sharedWith={data.sharedWith} />
        }
      />
    </>
  );
}
