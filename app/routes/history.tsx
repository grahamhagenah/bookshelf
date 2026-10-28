import { data, Link, useFetcher, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import {
  BookRow,
  bookRowGrid,
  RowLine,
  RowLoved,
  rowEmphasis,
  rowPrimary,
} from "~/components/book-row";
import EmptyList from "~/components/empty-list";
import { HeartIcon, HistoryIcon } from "~/components/icons";
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
  // Said from your side, so which way it went is plain, then when: the two
  // dates out and back ("Since" only as a fallback)
  const who = borrowed ? <>You borrowed from {person}</> : <>You lent to {person}</>;
  const when = entry.returnedAt
    ? `${monthDay(entry.borrowedAt)} – ${monthDay(entry.returnedAt)}`
    : `Since ${monthDay(entry.borrowedAt)}`;

  // What was said about it lives on the book's page. The row's one button
  // goes there, with a heart in it when the book was loved: yours on a book
  // you borrowed, the borrower's on one you lent
  const love = useFetcher();
  const body = entry.note?.body?.trim();
  // A heart given from the row shows at once
  const loved = Boolean(entry.note?.loved) || love.state !== "idle";
  const heart = <HeartIcon size={13} filled className="flex-shrink-0 text-rose-400" />;
  const notes = `/books/${entry.book.id}#notes`;
  const noteButton = (label: string) => (
    <Link to={notes} className={`${rowPrimary} gap-1.5`}>
      {loved ? heart : null}
      {label}
    </Link>
  );
  const actions = borrowed ? (
    <>
      {noteButton(body ? "Read your note" : "Leave a note")}
      {/* Not loved yet: a heart to give, right here */}
      {loved ? null : (
        <love.Form method="post" action={`/books/${entry.book.id}`}>
          <input type="hidden" name="intent" value="toggleLove" />
          <input type="hidden" name="loved" value="true" />
          <button
            type="submit"
            aria-label="Love it"
            title="Love it"
            // A square the button's height, in the same outline as the button
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-rose-400 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-500 transition-colors"
          >
            <HeartIcon size={13} />
          </button>
        </love.Form>
      )}
    </>
  ) : body ? (
    noteButton(`Read ${name}'s note`)
  ) : loved ? (
    // Loved, with nothing to read: the heart said quietly
    <RowLoved>{name} loved it</RowLoved>
  ) : null;

  return (
    <BookRow
      to={`/books/${entry.book.id}`}
      book={entry.book}
      // The cover and title say which book; the row is about the loan
      showAuthor={false}
      line={
        <RowLine>
          {who}
          <span className="block text-stone-400 dark:text-stone-500">{when}</span>
        </RowLine>
      }
      actions={actions}
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
