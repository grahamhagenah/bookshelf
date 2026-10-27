
import { data, Link, useLoaderData, useSearchParams } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import Library from "~/components/library";
import ShelfTabs from "~/components/shelf-tabs";
import { isNotLending } from "~/lending";
import {
  getBookListItems,
  getBorrowedBooks,
  readAtFor,
} from "~/models/book.server";
import { getShelfCounts } from "~/models/history.server";
import { getHousehold, shelfIds } from "~/models/household.server";
import { getLoveCounts } from "~/models/note.server";
import { getUserById } from "~/models/user.server";
import { FREE_LIMITS } from "~/plan";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

export const meta: MetaFunction = () =>
  seo({ title: "My shelf", noindex: true });

export const handle = {
  breadcrumb: () => <Link to="/books">My shelf</Link>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  const ownedBooks = await getBookListItems(await shelfIds(userId));
  const borrowedBooks = await getBorrowedBooks(userId);

  // Mark borrowed books and lending books, then combine
  const ownedWithFlag = ownedBooks.map(
    ({ readerNotes, notLendingUntil, ...book }) => ({
      ...book,
      readAt: readAtFor(userId, { ...book, readerNotes }),
      isBorrowed: false,
      isLending: book.borrowerId !== null,
      notLending: isNotLending(notLendingUntil),
    }),
  );
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
          members: household.members.map(
            ({ id, firstname, surname, profileEmoji }) => ({
              id,
              firstname,
              surname,
              profileEmoji,
            }),
          ),
        }
      : null;

  return data({
    user,
    bookListItems,
    counts: await getShelfCounts(userId),
    sharedWith,
  });
};

export default function BooksPage() {
  const data = useLoaderData<typeof loader>();
  // Just in from someone's shared-shelf link: say whose shelf it is now
  const [searchParams] = useSearchParams();
  const others = data.sharedWith?.members
    .filter((member) => member.id !== data.sharedWith?.viewerId)
    .map((member) => member.firstname);
  const joined = searchParams.get("joined") === "1" && others?.length;

  return (
    <>
      <Library
        bookListItems={data.bookListItems}
        sharedWith={data.sharedWith}
        header={
          <>
            {joined ? (
              <p
                role="status"
                className="mb-6 rounded-lg bg-stone-100 dark:bg-stone-900 px-4 py-3 text-sm text-stone-700 dark:text-stone-200"
              >
                You&apos;re sharing a shelf with {others.join(" and ")} now. Your books and{" "}
                {others.length === 1 ? "theirs are one shelf, and either" : "everyone's are one shelf, and any"}{" "}
                of you can lend from it, with room for {FREE_LIMITS.sharedBooks} books free.
              </p>
            ) : null}
            <ShelfTabs counts={data.counts} sharedWith={data.sharedWith} />
          </>
        }
      />
    </>
  );
}
