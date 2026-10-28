import { data, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import {
  BookRow,
  bookRowGrid,
  NoteButton,
  rowDate,
  RowLine,
  RowLoved,
  RowSub,
  rowEmphasis,
  YourNoteActions,
} from "~/components/book-row";
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
    ? `${rowDate(entry.borrowedAt)} – ${rowDate(entry.returnedAt)}`
    : `Since ${rowDate(entry.borrowedAt)}`;

  // What was said about it lives on the book's page. The row's button goes
  // there, with a heart in it when the book was loved: yours on a book you
  // borrowed (and a heart to give, if you haven't), the borrower's on one
  // you lent
  const body = entry.note?.body?.trim();
  const loved = Boolean(entry.note?.loved);
  const notes = `/books/${entry.book.id}#notes`;
  const actions = borrowed ? (
    <YourNoteActions
      notes={notes}
      loveAction={`/books/${entry.book.id}`}
      loved={loved}
      hasNote={Boolean(body)}
    />
  ) : body ? (
    <NoteButton to={notes} loved={loved}>
      Read {name}&apos;s note
    </NoteButton>
  ) : loved ? (
    // Loved, with nothing to read: the heart said quietly
    <RowLoved>{name} loved it</RowLoved>
  ) : null;

  return (
    <BookRow
      to={`/books/${entry.book.id}`}
      book={entry.book}
      line={
        <RowLine>
          {who}
          <RowSub>{when}</RowSub>
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
