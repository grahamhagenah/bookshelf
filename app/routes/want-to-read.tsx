import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useFetcher, useLoaderData } from "@remix-run/react";
import { useState } from "react";

import CoverPlaceholder from "~/components/cover-placeholder";
import { BookmarkIcon } from "~/components/icons";
import PersonLink from "~/components/person-link";
import ShelfTabs from "~/components/shelf-tabs";
import Layout from "~/components / Layout/Layout";
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
import { coverSrc } from "~/utils";

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
  return json({
    items,
    friendIds: user?.following.map((friend) => friend.id) ?? [],
    counts,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const id = form.get("id");
  if (typeof id !== "string") return json({ error: "No book given" }, { status: 400 });

  if (form.get("intent") === "remove") {
    await removeWantToRead(id, userId);
    return json({ ok: true });
  }
  if (form.get("intent") === "gotIt") {
    if ((await roomForBooks(userId)) < 1) {
      return json({ error: LIMIT_MESSAGES.books, limit: true }, { status: 403 });
    }
    const book = await moveToShelf(id, userId);
    return book ? redirect(`/books/${book.id}`) : json({ ok: true });
  }
  return json({ error: "Unknown action" }, { status: 400 });
};

type Item = Awaited<ReturnType<typeof getWantToRead>>[number];

function Cover({ cover, title, author }: { cover: string; title: string; author: string }) {
  const [failed, setFailed] = useState(!cover);
  return (
    <div className="relative h-[72px] w-12 flex-shrink-0 overflow-hidden rounded-xs ring-1 ring-stone-900/5 dark:ring-white/10">
      <CoverPlaceholder title={title} author={author} className="absolute inset-0" />
      {!failed ? (
        <img
          src={coverSrc(cover, "M")}
          alt=""
          loading="lazy"
          className="relative h-full w-full object-cover"
          onLoad={(e) => {
            // Open Library answers unknown covers with a 1x1 pixel
            if (e.currentTarget.naturalWidth <= 1) setFailed(true);
          }}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}

const quietButton =
  "rounded-md px-2.5 py-1 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors";
const outlineButton =
  "rounded-md border border-stone-200 dark:border-stone-700 px-3 py-1 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";

function WantRow({
  item,
  friendIds,
}: {
  item: Pick<Item, "id" | "title" | "author" | "cover"> & {
    copies: Item["copies"];
  };
  friendIds: string[];
}) {
  const remove = useFetcher({ key: `remove-${item.id}` });
  if (remove.state !== "idle") return null;

  // Available copies first, so the one you can ask for leads
  const copies = [...item.copies].sort(
    (a, b) => Number(b.available) - Number(a.available),
  );
  return (
    <li className="flex items-start gap-4 py-4">
      <Cover cover={item.cover} title={item.title} author={item.author} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-900 dark:text-stone-100">{item.title}</p>
        <p className="text-sm text-stone-500 dark:text-stone-400">{item.author}</p>
        <p className="mt-1.5 text-sm">
          {copies.length === 0 ? (
            <span className="text-stone-400 dark:text-stone-500">
              None of your friends have it yet
            </span>
          ) : (
            copies.map((copy, index) => (
              <span key={copy.bookId} className="text-stone-600 dark:text-stone-300">
                {index > 0 ? <span className="text-stone-400 dark:text-stone-500"> · </span> : null}
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
                  {copy.available ? "ask to borrow it" : "lent out right now"}
                </Link>
              </span>
            ))
          )}
        </p>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
        <Form method="post">
          <input type="hidden" name="intent" value="gotIt" />
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" className={outlineButton} title="Move it to your shelf">
            Got a copy
          </button>
        </Form>
        <remove.Form method="post">
          <input type="hidden" name="intent" value="remove" />
          <input type="hidden" name="id" value={item.id} />
          <button type="submit" className={quietButton}>
            Remove
          </button>
        </remove.Form>
      </div>
    </li>
  );
}

export default function WantToRead() {
  const { items, friendIds, counts } = useLoaderData<typeof loader>();
  const matched = items.filter((item) => item.copies.length > 0).length;
  // "Got a copy" with a full shelf on the free plan
  const actionData = useActionData<typeof action>();
  const limit = actionData && "limit" in actionData && "error" in actionData ? actionData.error : null;

  return (
    <Layout title="Want to read">
      <section>
        <ShelfTabs counts={{ ...counts, want: items.length }} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-xl text-sm text-stone-500 dark:text-stone-400">
            Books you don&apos;t own but would like to read. When a friend has one,
            it shows up here, and you&apos;ll hear when they add one.
            {matched ? ` ${matched} of these ${matched === 1 ? "is" : "are"} on a friend's shelf.` : ""}
          </p>
          <Link
            to="/search"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
          >
            <span aria-hidden="true" className="text-base leading-none text-stone-400 dark:text-stone-500">
              +
            </span>
            Add a book
          </Link>
        </div>

        {limit ? (
          <p role="alert" className="mt-4 rounded-lg bg-stone-100 dark:bg-stone-900 px-4 py-3 text-sm text-stone-700 dark:text-stone-200">
            {limit}{" "}
            <Link to={UPGRADE_PATH} className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2">
              See Stacks Plus
            </Link>
          </p>
        ) : null}

        {items.length === 0 ? (
          <div className="mt-10 flex flex-col items-center py-10 text-center">
            <BookmarkIcon size={28} className="text-stone-300 dark:text-stone-600" />
            <p className="mt-3 text-stone-700 dark:text-stone-300">Nothing here yet.</p>
            <p className="mt-1 max-w-xs text-sm text-stone-500 dark:text-stone-400">
              Search for a book and choose <strong className="font-medium">Want to read</strong>,
              or{" "}
              <Link to="/import" className="underline underline-offset-2">
                import your to-read shelf
              </Link>{" "}
              from Goodreads.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100 dark:divide-stone-800">
            {items.map((item) => (
              <WantRow key={item.id} item={item} friendIds={friendIds} />
            ))}
          </ul>
        )}
      </section>
    </Layout>
  );
}
