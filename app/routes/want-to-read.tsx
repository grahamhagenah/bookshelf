
import { data, Form, Link, redirect, useActionData, useFetcher, useLoaderData, useLocation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import BookCover from "~/components/book-cover";
import EmptyList from "~/components/empty-list";
import { BookmarkIcon } from "~/components/icons";
import Layout from "~/components/layout";
import PersonLink from "~/components/person-link";
import ShelfTabs, { AddLink } from "~/components/shelf-tabs";
import { getShelfCounts } from "~/models/history.server";
import { getUserById } from "~/models/user.server";
import {
  getWantToRead,
  moveToShelf,
  removeWantToRead,
} from "~/models/wish.server";
import { LIMIT_MESSAGES, UPGRADE_PATH } from "~/plan";
import { roomForBooks } from "~/plan.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import { workPath } from "~/utils";

export const meta: MetaFunction = () =>
  seo({ title: "Want to read", noindex: true });

export const handle = {
  breadcrumb: () => <span>Want to read</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [user, items, counts] = await Promise.all([
    getUserById(userId),
    getWantToRead(userId),
    getShelfCounts(userId),
  ]);
  return data({
    items,
    friendIds: user?.following.map((friend) => friend.id) ?? [],
    counts,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const id = form.get("id");
  if (typeof id !== "string")
    return data({ error: "No book given" }, { status: 400 });

  if (form.get("intent") === "remove") {
    await removeWantToRead(id, userId);
    return data({ ok: true });
  }
  if (form.get("intent") === "gotIt") {
    if ((await roomForBooks(userId)) < 1) {
      return data(
        { error: LIMIT_MESSAGES.books, limit: true },
        { status: 403 },
      );
    }
    const book = await moveToShelf(id, userId);
    return book ? redirect(`/books/${book.id}`) : data({ ok: true });
  }
  return data({ error: "Unknown action" }, { status: 400 });
};

type Item = Awaited<ReturnType<typeof getWantToRead>>[number];

function Cover({
  cover,
  title,
  author,
}: {
  cover: string;
  title: string;
  author: string;
}) {
  return (
    <BookCover
      cover={cover}
      title={title}
      author={author}
      // The same size as Also read's and History's covers
      className="h-24 w-16 flex-shrink-0"
    />
  );
}

// A row's actions as words, light enough to sit under the book
const textAction =
  "font-medium text-stone-700 dark:text-stone-200 underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:underline hover:text-stone-950 dark:hover:text-white transition-colors";

function WantRow({
  item,
  friendIds,
}: {
  item: Pick<Item, "id" | "title" | "author" | "cover" | "openLibraryKey"> & {
    copies: Item["copies"];
  };
  friendIds: string[];
}) {
  const remove = useFetcher({ key: `remove-${item.id}` });
  // Arriving from a cover on the home page with copies to pick from: the
  // page scrolls here, and the book is lightly tinted
  const picked = useLocation().hash === `#wish-${item.id}`;
  if (remove.state !== "idle") return null;
  const page = workPath(item.openLibraryKey) ?? `/want-to-read/${item.id}`;

  // Available copies first, so the one you can ask for leads
  const copies = [...item.copies].sort(
    (a, b) => Number(b.available) - Number(a.available),
  );
  return (
    <li
      id={`wish-${item.id}`}
      // The tint reaches past the row's edges with a shadow, so nothing moves
      className={`flex scroll-mt-24 items-start gap-4 border-b border-stone-100 dark:border-stone-800 py-4 transition-colors ${
        picked
          ? "bg-forest-600/[0.06] shadow-[0_0_0_10px_rgb(31_107_78/0.06)] dark:bg-forest-400/10 dark:shadow-[0_0_0_10px_rgb(58_154_116/0.1)]"
          : ""
      }`}
    >
      {/* The book's own page: straight there when its Open Library work
          is known, else by way of finding it */}
      <Link
        to={page}
        tabIndex={-1}
        aria-hidden="true"
        className="flex-shrink-0"
      >
        <Cover cover={item.cover} title={item.title} author={item.author} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={page}
          className="font-medium text-stone-900 dark:text-stone-100 underline-offset-2 hover:underline"
        >
          {item.title}
        </Link>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {item.author}
        </p>
        <p className="mt-1.5 text-sm">
          {copies.length === 0 ? (
            <span className="text-stone-400 dark:text-stone-500">
              None of your friends have it yet
            </span>
          ) : (
            copies.map((copy, index) => (
              <span
                key={copy.bookId}
                className="text-stone-600 dark:text-stone-300"
              >
                {index > 0 ? (
                  <span className="text-stone-400 dark:text-stone-500">
                    {" "}
                    ·{" "}
                  </span>
                ) : null}
                <PersonLink
                  id={copy.owner.id}
                  name={copy.owner.firstname}
                  friendIds={friendIds}
                />{" "}
                has it,{" "}
                <Link
                  to={`/books/${copy.bookId}`}
                  className="font-medium text-stone-800 dark:text-stone-200 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
                >
                  {copy.available
                    ? "ask to borrow it"
                    : copy.notLending
                      ? "not lending it right now"
                      : "lent out right now"}
                </Link>
              </span>
            ))
          )}
        </p>
        {/* What to do with it, quietly under the rest */}
        <div className="mt-2 flex items-center gap-4 text-sm">
          <Form method="post">
            <input type="hidden" name="intent" value="gotIt" />
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" className={textAction} title="Move it to your shelf">
              Got a copy
            </button>
          </Form>
          <remove.Form method="post">
            <input type="hidden" name="intent" value="remove" />
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" className={`${textAction} text-stone-500 dark:text-stone-400`}>
              Remove
            </button>
          </remove.Form>
        </div>
      </div>
    </li>
  );
}

export default function WantToRead() {
  const { items, friendIds, counts } = useLoaderData<typeof loader>();
  // "Got a copy" with a full shelf on the free plan
  const actionData = useActionData<typeof action>();
  const limit =
    actionData && "limit" in actionData && "error" in actionData
      ? actionData.error
      : null;

  return (
    <Layout title="Want to read">
      <section>
        <ShelfTabs counts={{ ...counts, want: items.length }} add={items.length > 0 ? { to: "/search?for=want", label: "Add a book" } : undefined} />
        {/* What the list is for is said only while it's empty, in its place.
            Phones have no room beside the tabs, so the way to add is here */}
        {items.length > 0 ? (
          <div className="-mt-2 flex justify-end sm:hidden">
            <AddLink to="/search?for=want">Add a book</AddLink>
          </div>
        ) : null}

        {limit ? (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-stone-100 dark:bg-stone-900 px-4 py-3 text-sm text-stone-700 dark:text-stone-200"
          >
            {limit}{" "}
            <Link
              to={UPGRADE_PATH}
              className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2"
            >
              See Stacks Plus
            </Link>
          </p>
        ) : null}

        {items.length === 0 ? (
          <EmptyList
            icon={<BookmarkIcon size={28} />}
            title="Books you'd like to read"
            action={{ to: "/search?for=want", label: "Add a book" }}
          >
            Keep the ones you don&apos;t own here, and you&apos;ll hear when a
            friend has a copy to lend. Or{" "}
            <Link to="/import" className="underline underline-offset-2">
              import your to-read shelf
            </Link>{" "}
            from Goodreads.
          </EmptyList>
        ) : (
          // Two columns where there's room; each row ruled underneath, so
          // the rules line up across both
          <ul className="mt-4 grid gap-x-10 md:grid-cols-2">
            {items.map((item) => (
              <WantRow key={item.id} item={item} friendIds={friendIds} />
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
