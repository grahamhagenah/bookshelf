import { data, Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import BookCover from "~/components/book-cover";
import EmptyList from "~/components/empty-list";
import { HeartIcon, ReadIcon } from "~/components/icons";
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
            action={{ to: "/search", label: "Find a book" }}
          >
            The ones that aren&apos;t on your shelf: from the library, borrowed
            long ago, given away. Find one, then mark it read, love it or leave
            a note on its page.
          </EmptyList>
        ) : (
          // Two columns where there's room, as To read has
          <ul className="mt-4 grid gap-x-10 md:grid-cols-2">
            {items.map((item) => (
              <li key={item.id} className="border-b border-stone-100 dark:border-stone-800">
                <Link
                  // One still being looked up opens a search for it
                  to={
                    isWork(item.workKey)
                      ? item.workKey
                      : `/search?q=${encodeURIComponent(`${item.title} ${item.author}`)}`
                  }
                  className="-mx-2 flex items-start gap-4 rounded-lg px-2 py-4 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
                >
                  <BookCover
                    cover={item.cover}
                    title={item.title}
                    author={item.author}
                    className="h-24 w-16 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900 dark:text-stone-100">
                      {item.title}
                    </p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      {item.author}
                    </p>
                    {item.body ? (
                      <p className="mt-1.5 line-clamp-2 text-pretty text-sm text-stone-700 dark:text-stone-300">
                        “{item.body}”
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2 pt-0.5 text-stone-400 dark:text-stone-500">
                    {item.loved ? (
                      <HeartIcon
                        size={14}
                        filled
                        className="text-rose-500"
                        aria-label="You loved it"
                      />
                    ) : null}
                    {item.readAt ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <ReadIcon size={12} />
                        Read
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
