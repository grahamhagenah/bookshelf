import { data, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import { BookRow, RowLine, rowEmphasis } from "~/components/book-row";
import EmptyList from "~/components/empty-list";
import { HistoryIcon } from "~/components/icons";
import Layout from "~/components/layout";
import PersonLink from "~/components/person-link";
import ShelfTabs from "~/components/shelf-tabs";
import { sectionHeading } from "~/components/ui";
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
  // sentence. Still out, it's "Since Oct 19"; back, the two dates
  const who = borrowed ? <>Borrowed from {person}</> : <>Lent to {person}</>;
  const when = entry.returnedAt
    ? `${monthDay(entry.borrowedAt)} – ${monthDay(entry.returnedAt)}`
    : `Since ${monthDay(entry.borrowedAt)}`;
  // Just who had it and when: notes and hearts are on the book's page,
  // one tap away, rather than a different line for each case here
  return (
    <BookRow
      to={`/books/${entry.book.id}`}
      book={entry.book}
      line={
        <RowLine>
          {who}
          <span className="block text-stone-400 dark:text-stone-500">{when}</span>
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
            Every book that passes between you and a friend shows up here: what
            you&apos;ve borrowed, and what you&apos;ve lent.
          </EmptyList>
        ) : (
          // What's out now, either way, then what's come back: newest first
          // in each, two columns where there's room, as To read and Also read
          [
            { id: "out-now", title: "Out now", rows: entries.filter((entry) => !entry.returnedAt) },
            { id: "returned", title: "Returned", rows: entries.filter((entry) => entry.returnedAt) },
          ]
            .filter((group) => group.rows.length > 0)
            .map((group) => (
              <section key={group.id} aria-labelledby={group.id} className="mt-8">
                <h2 id={group.id} className={`${sectionHeading} flex items-baseline gap-2`}>
                  {group.title}
                  <span className="text-base font-normal text-stone-400 dark:text-stone-500">
                    {group.rows.length}
                  </span>
                </h2>
                <ul className="mt-1 grid gap-x-10 md:grid-cols-2">
                  {group.rows.map((entry) => (
                    <HistoryRow key={`${entry.kind}-${entry.id}`} entry={entry} friendIds={friendIds} />
                  ))}
                </ul>
              </section>
            ))
        )}
      </section>
    </Layout>
  );
}
