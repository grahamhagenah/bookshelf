import { data, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import { BookRow, bookRowGrid, RowLine, RowLoved, rowEmphasis } from "~/components/book-row";
import EmptyList from "~/components/empty-list";
import { HistoryIcon } from "~/components/icons";
import Layout from "~/components/layout";
import PersonLink from "~/components/person-link";
import ShelfTabs from "~/components/shelf-tabs";
import { getHistory, getShelfCounts } from "~/models/history.server";
import { getUserById } from "~/models/user.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import type { LoaderData } from "~/utils";

// Every book that's passed between you and a friend, so you can find the
// one you read a few weeks ago and say what you thought of it

export const meta: MetaFunction = () => seo({ title: "History", noindex: true });

export const handle = {
  breadcrumb: () => <span>History</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [user, entries, counts] = await Promise.all([
    getUserById(userId),
    getHistory(userId),
    getShelfCounts(userId),
  ]);
  return data({
    entries,
    counts,
    friendIds: user?.following.map((friend) => friend.id) ?? [],
  });
};

type Entry = LoaderData<typeof loader>["entries"][number];

const monthDay = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
};


function HistoryRow({ entry, friendIds }: { entry: Entry; friendIds: string[] }) {
  const borrowed = entry.kind === "borrowed";
  // First names: the rows say enough without the rest, and stay short
  const name = entry.person.firstname;
  const person = (
    <span className={`whitespace-nowrap ${rowEmphasis}`}>
      <PersonLink id={entry.person.id} name={name} friendIds={friendIds} />
    </span>
  );
  // Who, then when on a line of its own: short lines rather than one long
  // sentence. The two dates, out and back ("Since" only as a fallback)
  // Said from your side, so which way it went is plain
  const who = borrowed ? <>You borrowed from {person}</> : <>You lent to {person}</>;
  const when = entry.returnedAt
    ? `${monthDay(entry.borrowedAt)} – ${monthDay(entry.returnedAt)}`
    : `Since ${monthDay(entry.borrowedAt)}`;
  // A heart, if they loved it: the borrower's on a book you lent, yours on
  // one you borrowed. Notes are on the book's page
  const loved = entry.note?.loved ? (
    <span className="mt-2 block">
      <RowLoved>{borrowed ? "You loved it" : `${name} loved it`}</RowLoved>
    </span>
  ) : null;
  return (
    <BookRow
      to={`/books/${entry.book.id}`}
      book={entry.book}
      line={
        <RowLine>
          {who}
          <span className="block text-stone-400 dark:text-stone-500">{when}</span>
          {loved}
        </RowLine>
      }
    />
  );
}

export default function History() {
  const { entries, counts, friendIds } = useLoaderData<typeof loader>();

  return (
    <Layout title="History">
      <section>
        <ShelfTabs counts={{ ...counts, history: entries.length }} />

        {entries.length === 0 ? (
          <EmptyList
            icon={<HistoryIcon size={28} />}
            title="Your lending history"
            action={{ to: "/friends/books", label: "See friends' books" }}
          >
            Books you&apos;ve borrowed and lent show up here once they&apos;re
            back. What&apos;s out now is on your shelf.
          </EmptyList>
        ) : (
          // Loans that are over, both ways, the most recently back first;
          // what's out now is on your shelf. In columns where there's room,
          // as To read and Also read
          <ul className={`mt-4 ${bookRowGrid}`}>
            {entries.map((entry) => (
              <HistoryRow key={`${entry.kind}-${entry.id}`} entry={entry} friendIds={friendIds} />
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
