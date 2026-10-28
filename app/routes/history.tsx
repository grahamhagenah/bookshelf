import { data, Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import { BookRow, RowLine, rowEmphasis, rowPrimary, rowQuiet, rowSecondary } from "~/components/book-row";
import EmptyList from "~/components/empty-list";
import { BorrowedIcon, HeartIcon, HistoryIcon, LentIcon } from "~/components/icons";
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
  const date = (value: string | Date) => (
    <span className={`whitespace-nowrap ${rowEmphasis}`}>{monthDay(value)}</span>
  );
  // Told as a sentence: who had it, and when it went and came back
  const story = borrowed ? (
    entry.returnedAt ? (
      <>
        You borrowed it from {person} on {date(entry.borrowedAt)} and gave it
        back {date(entry.returnedAt)}.
      </>
    ) : (
      <>
        You’ve been borrowing it from {person} since {date(entry.borrowedAt)}.
      </>
    )
  ) : entry.returnedAt ? (
    <>
      {person} borrowed it on {date(entry.borrowedAt)} and gave it back{" "}
      {date(entry.returnedAt)}.
    </>
  ) : (
    <>
      {person} has been borrowing it since {date(entry.borrowedAt)}.
    </>
  );
  const notes = `/books/${entry.book.id}#notes`;
  const body = entry.note?.body?.trim();
  const loved = entry.note?.loved ? (
    <span className={`inline-flex items-center gap-1.5 ${rowQuiet}`}>
      <HeartIcon size={13} filled className="text-rose-400" />
      {borrowed ? "You loved it" : `${name} loved it`}
    </span>
  ) : null;

  return (
    <BookRow
      to={`/books/${entry.book.id}`}
      book={entry.book}
      line={
        <RowLine icon={borrowed ? <BorrowedIcon size={13} /> : <LentIcon size={13} />}>
          {story}
        </RowLine>
      }
      // Whether anything was said about it: that there's a note, with the
      // way to it, rather than the note itself; or a way to leave yours on
      // a book you borrowed
      actions={
        body ? (
          <>
            {loved}
            <Link to={notes} className={rowSecondary}>
              {borrowed ? "Read your note" : `Read ${name}'s note`}
            </Link>
          </>
        ) : borrowed ? (
          <>
            {loved}
            <Link to={notes} className={rowPrimary}>
              {loved ? "Add a note" : "Leave a note"}
            </Link>
          </>
        ) : (
          loved ?? <span className={rowQuiet}>No note from {name} yet</span>
        )
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
          <>
            {/* Every loan both ways, newest first: each row says which way
                it went, so there's nothing to filter. Two columns where
                there's room, as To read and Also read */}
            <ul className="mt-4 grid gap-x-10 md:grid-cols-2">
              {entries.map((entry) => (
                <HistoryRow key={`${entry.kind}-${entry.id}`} entry={entry} friendIds={friendIds} />
              ))}
            </ul>
          </>
        )}
      </section>
    </Layout>
  );
}
