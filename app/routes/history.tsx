import { data, Link, useFetcher, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import {
  BookRow,
  bookRowGrid,
  RowLine,
  RowLoved,
  rowEmphasis,
  rowPrimary,
  rowSecondary,
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
  // Who on the line beside the cover; when, the two dates out and back,
  // under the cover ("Since" only as a fallback)
  // Said from your side, so which way it went is plain
  const who = borrowed ? <>You borrowed from {person}</> : <>You lent to {person}</>;
  const when = entry.returnedAt
    ? `${monthDay(entry.borrowedAt)} – ${monthDay(entry.returnedAt)}`
    : `Since ${monthDay(entry.borrowedAt)}`;
  // What was said about it, as Also read says it: yours on a book you
  // borrowed, the borrower's on one you lent. The notes are on the book's
  // page; the row says there is one, and offers the one thing to do next
  const love = useFetcher();
  const body = entry.note?.body?.trim();
  // A heart given from the row shows at once
  const loved = Boolean(entry.note?.loved) || love.state !== "idle";
  const said = borrowed ? "You" : name;
  const marks = loved ? (
    <RowLoved>
      {said} loved it{body ? " and left a note" : ""}
    </RowLoved>
  ) : body ? (
    `${said} left a note`
  ) : null;
  const notes = `/books/${entry.book.id}#notes`;
  // Yours: until you've left a note, the way to leave one, and to love it
  // if you haven't. Theirs: the way to read the note they left
  const actions = borrowed ? (
    body ? null : (
      <>
        <Link to={notes} className={rowPrimary}>
          Leave a note
        </Link>
        {loved ? null : (
          <love.Form method="post" action={`/books/${entry.book.id}`}>
            <input type="hidden" name="intent" value="toggleLove" />
            <input type="hidden" name="loved" value="true" />
            <button type="submit" className={`${rowSecondary} inline-flex items-center gap-1`}>
              <HeartIcon size={13} />
              Love it
            </button>
          </love.Form>
        )}
      </>
    )
  ) : body ? (
    <Link to={notes} className={rowPrimary}>
      Read {name}&apos;s note
    </Link>
  ) : null;
  return (
    <BookRow
      to={`/books/${entry.book.id}`}
      book={entry.book}
      line={
        <RowLine>
          {who}
          {marks ? <span className="mt-1 block">{marks}</span> : null}
        </RowLine>
      }
      actions={actions}
      coverNote={when}
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
