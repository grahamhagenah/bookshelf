import { data, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import { BookRow, bookRowGrid, RowLine, RowLoved } from "~/components/book-row";
import EmptyList from "~/components/empty-list";
import { ReadIcon } from "~/components/icons";
import Layout from "~/components/layout";
import ShelfTabs, { AddLink } from "~/components/shelf-tabs";
import { getShelfCounts } from "~/models/history.server";
import { findImportedWorks } from "~/models/import.server";
import { listMyWorkNotes } from "~/models/work-note.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

// Books you've read, loved or written about that aren't on your shelf:
// from the library, given away, borrowed before Stacks. Your hearts and
// notes are seen by friends; marking a book read is just for you.

export const meta: MetaFunction = () =>
  seo({ title: "Also read", noindex: true });

export const handle = {
  breadcrumb: () => <span>Also read</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [items, counts] = await Promise.all([
    listMyWorkNotes(userId),
    getShelfCounts(userId),
  ]);
  // Imported books Open Library hasn't placed yet get another look
  if (items.some((item) => !isWork(item.workKey))) void findImportedWorks(userId);
  return data({ items, counts });
};

const isWork = (key: string) => key.startsWith("/works/");

export default function ReadElsewhere() {
  const { items, counts } = useLoaderData<typeof loader>();

  return (
    <Layout title="Also read">
      <section>
        <ShelfTabs counts={{ ...counts, elsewhere: items.length }} add={items.length > 0 ? { to: "/search", label: "Find a book" } : undefined} />
        {/* What the list is for is said only while it's empty, in its place.
            Phones have no room beside the tabs, so the way to add is here */}
        {items.length > 0 ? (
          <div className="-mt-2 flex justify-end sm:hidden">
            <AddLink to="/search">Find a book</AddLink>
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyList
            icon={<ReadIcon size={28} />}
            title="Books you've read elsewhere"
            action={{ to: "/search", label: "Find a book", plus: true }}
          >
            The ones that aren&apos;t on your shelf: from the library, borrowed
            long ago, given away. Find one, then mark it read, love it or leave
            a note on its page.
          </EmptyList>
        ) : (
          // In columns where there's room, as To read has
          <ul className={`mt-4 ${bookRowGrid}`}>
            {items.map((item) => {
              // One still being looked up opens a search for it
              const page = isWork(item.workKey)
                ? item.workKey
                : `/search?q=${encodeURIComponent(`${item.title} ${item.author}`)}`;
              return (
                <BookRow
                  key={item.id}
                  to={page}
                  book={item}
                  // What you marked, as History says it; the note itself is on
                  // the book's page
                  line={
                    <RowLine>
                      {/* A heart as History shows one */}
                      {item.loved ? (
                        <RowLoved>{item.body ? "You loved it and left a note" : "You loved it"}</RowLoved>
                      ) : item.body ? (
                        "You left a note"
                      ) : (
                        "You read it"
                      )}
                    </RowLine>
                  }
                />
              );
            })}
          </ul>
        )}
      </section>
    </Layout>
  );
}
