import { data, useFetcher, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import {
  BookRow,
  bookRowGrid,
  rowDate,
  RowLine,
  RowMenu,
  rowMenuHint,
  rowMenuItem,
  RowSub,
  YourNoteActions,
} from "~/components/book-row";
import EmptyList from "~/components/empty-list";
import { ReadIcon } from "~/components/icons";
import Layout from "~/components/layout";
import ShelfTabs, { AddLink } from "~/components/shelf-tabs";
import { getShelfCounts } from "~/models/history.server";
import { findImportedWorks } from "~/models/import.server";
import { listMyWorkNotes, removeWorkNote } from "~/models/work-note.server";
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

// Taking a book off Also read: your read mark, heart and note on it
export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const form = await request.formData();
  if (form.get("intent") === "remove") {
    await removeWorkNote(userId, String(form.get("id") ?? ""));
  }
  return data({ ok: true });
};

// Its ⋯: off the list, with what that clears said plainly
function AlsoReadMenu({ id, title }: { id: string; title: string }) {
  const remove = useFetcher();
  return (
    <RowMenu label={`More for ${title}`}>
      <remove.Form method="post" action="/read-elsewhere">
        <input type="hidden" name="intent" value="remove" />
        <input type="hidden" name="id" value={id} />
        <button type="submit" role="menuitem" className={rowMenuItem}>
          Remove from Also read
          <span className={rowMenuHint}>Clears your read mark, heart and note</span>
        </button>
      </remove.Form>
    </RowMenu>
  );
}

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
                  // What you did with it and when, as History says who had it
                  // and when; then the same buttons History gives a book you
                  // borrowed: your note, and a heart to give
                  corner={<AlsoReadMenu id={item.id} title={item.title} />}
                  line={
                    <RowLine>
                      {item.readAt ? "You read it" : item.body ? "You left a note" : "You loved it"}
                      {item.readAt ? <RowSub>{rowDate(item.readAt)}</RowSub> : null}
                    </RowLine>
                  }
                  actions={
                    isWork(item.workKey) ? (
                      <YourNoteActions
                        notes={`${page}#notes`}
                        loveAction={page}
                        loved={item.loved}
                        hasNote={Boolean(item.body)}
                      />
                    ) : null
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
