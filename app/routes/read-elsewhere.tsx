import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import BookCover from "~/components/book-cover";
import { HeartIcon, ReadIcon } from "~/components/icons";
import ShelfTabs from "~/components/shelf-tabs";
import Layout from "~/components / Layout/Layout";
import { getShelfCounts } from "~/models/history.server";
import { listMyWorkNotes } from "~/models/work-note.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

// Books you've read, loved or written about that aren't on your shelf:
// from the library, given away, borrowed before Stacks. Your hearts and
// notes are seen by friends; what you've read stays yours.

export const meta: MetaFunction = () =>
  seo({ title: "Read elsewhere", noindex: true });

export const handle = {
  breadcrumb: () => <span>Read elsewhere</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [items, counts] = await Promise.all([
    listMyWorkNotes(userId),
    getShelfCounts(userId),
  ]);
  return json({ items, counts });
};

export default function ReadElsewhere() {
  const { items, counts } = useLoaderData<typeof loader>();

  return (
    <Layout title="Read elsewhere">
      <section>
        <ShelfTabs counts={{ ...counts, elsewhere: items.length }} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-xl text-sm text-stone-500 dark:text-stone-400">
            Books you&apos;ve read that aren&apos;t on your shelf: from the
            library, given away, borrowed long ago. Friends see your hearts and
            notes. What you&apos;ve read is only for you.
          </p>
          <Link
            to="/search"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
          >
            <span
              aria-hidden="true"
              className="text-base leading-none text-stone-400 dark:text-stone-500"
            >
              +
            </span>
            Find a book
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="mt-10 flex flex-col items-center py-10 text-center">
            <ReadIcon
              size={28}
              className="text-stone-300 dark:text-stone-600"
            />
            <p className="mt-3 text-stone-700 dark:text-stone-300">
              Nothing here yet.
            </p>
            <p className="mt-1 max-w-xs text-sm text-stone-500 dark:text-stone-400">
              Search for any book you&apos;ve read, then love it, mark it read
              or leave a note on its page.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100 dark:divide-stone-800">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.workKey}
                  className="-mx-2 flex items-start gap-4 rounded-lg px-2 py-4 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
                >
                  <BookCover
                    cover={item.cover}
                    title={item.title}
                    author={item.author}
                    className="h-[72px] w-12 flex-shrink-0"
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
