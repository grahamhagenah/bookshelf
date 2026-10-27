import { data, Link, redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import BookCover from "~/components/book-cover";
import Layout from "~/components/layout";
import { lookupWork, PATIENT_MS } from "~/models/openlibrary.server";
import {
  getWish,
  setWishWork,
  workKeyFromFriends,
} from "~/models/wish.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import { workPath } from "~/utils";

// A book on your want-to-read list, opened. Its page is the book's own
// Open Library page, the same one search leads to. Books that came onto
// the list without one (from an import, or the demo's list) have it found
// the first time, then go straight there.

export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  seo({ title: loaderData?.wish.title ?? "Want to read", noindex: true });

export const handle = {
  breadcrumbs: (data: { wish?: { title: string } } | undefined) => [
    { label: "Want to read", href: "/want-to-read" },
    { label: data?.wish?.title ?? "Book" },
  ],
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const wish = await getWish(params.id ?? "", userId);
  if (!wish) throw new Response("Not Found", { status: 404 });

  const known = workPath(wish.openLibraryKey);
  if (known) return redirect(known);

  // A friend's copy's work first, so the two stay matched; else ask
  const key =
    (await workKeyFromFriends(userId, wish)) ??
    (
      await lookupWork(
        { title: wish.title, author: wish.author, isbn: wish.isbn },
        PATIENT_MS,
      ).catch(() => null)
    )?.key;
  const found = workPath(key);
  if (key && found) {
    await setWishWork(wish.id, userId, key);
    return redirect(found);
  }

  // Open Library doesn't know it, or didn't answer: what the list has
  return data({
    wish: {
      title: wish.title,
      author: wish.author,
      cover: wish.cover,
    },
  });
};

export default function WishPage() {
  const { wish } = useLoaderData<typeof loader>();
  const search = `/search?${new URLSearchParams({ q: `${wish.title} ${wish.author}`.trim() })}`;
  return (
    <Layout title={wish.title}>
      <div className="flex flex-col gap-6 md:flex-row md:gap-12">
        <BookCover
          cover={wish.cover}
          title={wish.title}
          author={wish.author}
          className="aspect-[2/3] w-[120px] flex-shrink-0 md:w-[200px]"
        />
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold leading-tight tracking-tight text-stone-900 dark:text-stone-100 md:text-4xl">
            {wish.title}
          </h2>
          <p className="mt-1 text-stone-500 dark:text-stone-400 md:text-xl">
            {wish.author}
          </p>
          <p className="mt-6 max-w-prose leading-relaxed text-stone-700 dark:text-stone-300">
            Open Library doesn&apos;t have a page for this one right now, so
            there&apos;s nothing more to show about it yet.{" "}
            <Link
              to={search}
              className="font-medium text-stone-900 underline underline-offset-2 decoration-stone-300 hover:decoration-stone-500 dark:text-stone-100 dark:decoration-stone-600"
            >
              Search for it
            </Link>{" "}
            to find another edition.
          </p>
          <p className="mt-4 text-sm">
            <Link
              to="/want-to-read"
              className="text-stone-500 underline underline-offset-2 decoration-stone-300 hover:text-stone-900 dark:text-stone-400 dark:decoration-stone-600 dark:hover:text-stone-100"
            >
              Back to your list
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
