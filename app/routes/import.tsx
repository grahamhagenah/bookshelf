import { useState } from "react";
import { data, Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import InviteMessage from "~/components/invite-message";
import Layout from "~/components/layout";
import ShareShelfOffer from "~/components/share-shelf-offer";
import { primaryButton, quietButton, sectionHeading } from "~/components/ui";
import type { ImportRow, ImportSource, ShelfChoice } from "~/import-books";
import { DEFAULT_CHOICE, LIST_MAX, readExport, readList, summarize } from "~/import-books";
import { getFriendInvite } from "~/models/friend.server";
import { shelfIds } from "~/models/household.server";
import { findImportedWorks, findListIsbns, importBooks } from "~/models/import.server";
import { fillInBooks } from "~/models/openlibrary.server";
import { publicOrigin } from "~/origin.server";
import { UPGRADE_PATH } from "~/plan";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

export const meta: MetaFunction = () =>
  seo({ title: "Import your books", noindex: true });

export const handle = {
  breadcrumb: () => <span>Import</span>,
};

// Exports run to a few hundred KB; this leaves room for a very long shelf
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  // Once the books are in, a message to bring friends over
  return data({
    inviteUrl: `${publicOrigin(request)}/invite/${await getFriendInvite(userId)}`,
    // And to someone at home, unless they share the shelf already
    sharesShelf: (await shelfIds(userId)).length > 1,
  });
};

const SHELF_CHOICES: ShelfChoice[] = ["owned", "read", "all"];

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const tooBig = data({ error: "That file is too big to import." }, { status: 400 });
  // Turned away before it's read, when it says it's too big; the form's
  // other fields are small, so a little room for them is enough
  if (Number(request.headers.get("content-length")) > MAX_FILE_BYTES + 64 * 1024) {
    return tooBig;
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return data({ error: "Couldn't read that file. Try choosing it again." }, { status: 400 });
  }

  // A pasted list: everything in it is theirs
  if (form.get("intent") === "list") {
    const text = form.get("list");
    const pasted = readList(typeof text === "string" ? text : "");
    if (pasted.length === 0) {
      return data({ error: "Type or paste a book on each line first.", list: true }, { status: 400 });
    }
    const { rows: listed, unfound } = await findListIsbns(pasted);
    const { bookIds: listedIds, ...listResult } = await importBooks(userId, listed, {
      shelf: "all",
      wantToRead: false,
      alsoRead: false,
    });
    void fillInBooks(listedIds);
    return data({ source: "list" as const, ...listResult, unfound });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return data({ error: "Choose a file to import first." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) return tooBig;
  const { source, rows } = readExport(await file.text());
  if (rows.length === 0) {
    return data(
      {
        error:
          "No books found in that file. It should be a CSV with a Title column, like the ones Goodreads, StoryGraph, LibraryThing and Libib export.",
      },
      { status: 400 },
    );
  }

  const shelf = form.get("shelf");
  const { bookIds, ...result } = await importBooks(userId, rows, {
    shelf: SHELF_CHOICES.includes(shelf as ShelfChoice)
      ? (shelf as ShelfChoice)
      : DEFAULT_CHOICE,
    wantToRead: form.get("wantToRead") === "on",
    alsoRead: form.get("alsoRead") === "on",
  });
  // Covers and details come from Open Library after the reply goes out,
  // and which work each book read elsewhere is
  void fillInBooks(bookIds);
  void findImportedWorks(userId);
  return data({ source, ...result, unfound: [] as string[] });
};

const SOURCE_NAMES: Record<ImportSource, string> = {
  goodreads: "Goodreads",
  storygraph: "StoryGraph",
  librarything: "LibraryThing",
  libib: "Libib",
  generic: "the file",
  list: "your list",
};

interface Preview {
  name: string;
  source: ImportSource;
  rows: ImportRow[];
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

export default function Import() {
  const result = useActionData<typeof action>();
  const { inviteUrl, sharesShelf } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const importing = navigation.state !== "idle" && navigation.formMethod === "POST";

  // Read the file in the browser first, so the choices below can say
  // what they'd do with it
  const [preview, setPreview] = useState<Preview | null>(null);
  const [shelf, setShelf] = useState<ShelfChoice>(DEFAULT_CHOICE);
  const onFile = async (file: File | undefined) => {
    if (!file) return setPreview(null);
    const { source, rows } = readExport(await file.text());
    setPreview({ name: file.name, source, rows });
  };

  const summary = preview ? summarize(preview.rows, shelf) : undefined;
  const count = (n: number | undefined) =>
    n === undefined ? null : (
      <span className="ml-1.5 text-stone-400 dark:text-stone-500">{n}</span>
    );
  const choices: { value: ShelfChoice; label: string; count: number | undefined }[] = [
    { value: "owned", label: "Only the books marked as owned", count: summary?.owned },
    { value: "read", label: "Books I've read, plus any marked as owned", count: summary?.read },
    { value: "all", label: "Everything in the file", count: summary?.total },
  ];

  const muted = "text-stone-500 dark:text-stone-400";
  const linkClass = "underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600";

  return (
    <Layout title="Import your books">
      <section>
        <h2 className={sectionHeading}>Import your books</h2>
        <p className={`mt-1 max-w-xl text-pretty ${muted}`}>
          Already keep your books on Goodreads or StoryGraph? Export them there
          and bring the file here. Books you own go on your shelf, the others
          you&apos;ve read on your Also read list, and the ones you&apos;re
          meaning to read on your want-to-read list. Your reviews come along
          as notes, and five stars as a heart.
        </p>
        <p className={`mt-2 max-w-xl text-pretty text-sm ${muted}`}>
          A LibraryThing or Libib export works the same way. Keep your own
          list instead? A spreadsheet saved as a CSV file works too: one book
          a row, with Title and Author columns (an ISBN column helps find the
          right edition). Everything in it goes on your shelf.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-stone-500 dark:text-stone-400">
              From Goodreads
            </h3>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-stone-700 dark:text-stone-300">
              <li>
                Open{" "}
                <a
                  href="https://www.goodreads.com/review/import"
                  className={linkClass}
                  target="_blank"
                  rel="noreferrer"
                >
                  My Books → Import and export
                </a>
              </li>
              <li>Choose Export Library, then download the file it makes</li>
            </ol>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-500 dark:text-stone-400">
              From StoryGraph
            </h3>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-sm text-stone-700 dark:text-stone-300">
              <li>
                Open{" "}
                <a
                  href="https://app.thestorygraph.com/user-export"
                  className={linkClass}
                  target="_blank"
                  rel="noreferrer"
                >
                  Manage account → Export StoryGraph library
                </a>
              </li>
              <li>Download the file once it&apos;s ready</li>
            </ol>
          </div>
        </div>
      </section>

      <section>
        {result && "added" in result ? (
          <div>
            <h2 className={sectionHeading}>Done</h2>
            <p className="mt-1 text-stone-700 dark:text-stone-300">
              From {SOURCE_NAMES[result.source]}: {plural(result.added, "book")} added to your shelf
              {result.alsoRead ? `, ${result.alsoRead} to your Also read list` : ""}
              {result.wanted ? `, ${result.wanted} to your want-to-read list` : ""}.
              {result.skipped
                ? ` ${plural(result.skipped, "book")} ${result.skipped === 1 ? "was" : "were"} already there.`
                : ""}
            </p>
            {result.unfound.length > 0 ? (
              <p className={`mt-2 text-sm ${muted}`}>
                Open Library didn&apos;t know{" "}
                {result.unfound.length === 1 ? "this ISBN" : "these ISBNs"}:{" "}
                {result.unfound.join(", ")}. Search for{" "}
                {result.unfound.length === 1 ? "it" : "them"} by title instead.
              </p>
            ) : null}
            {result.overLimit ? (
              <p className="mt-3 rounded-lg bg-stone-100 dark:bg-stone-900 px-4 py-3 text-sm text-stone-700 dark:text-stone-200">
                Your shelf is full on the free plan, so {plural(result.overLimit, "book")} didn&apos;t
                fit. With Stacks Plus you can import the file again to bring in the rest.{" "}
                <Link to={UPGRADE_PATH} className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2">
                  See Stacks Plus
                </Link>
              </p>
            ) : null}
            <p className={`mt-1 text-sm ${muted}`}>
              Covers and details are filling in from Open Library now. Give it a minute or two.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/books"
                className={`${primaryButton("lg")} inline-flex items-center`}
              >
                See your shelf
              </Link>
              {result.alsoRead ? (
                <Link
                  to="/read-elsewhere"
                  className={`${quietButton("lg")} inline-flex items-center`}
                >
                  Also read
                </Link>
              ) : null}
              {result.wanted ? (
                <Link
                  to="/want-to-read"
                  className={`${quietButton("lg")} inline-flex items-center`}
                >
                  Want to read
                </Link>
              ) : null}
            </div>
            {result.added > 0 ? (
              <InviteMessage
                url={inviteUrl}
                title="Now tell your friends"
                intro="Your shelf is ready to borrow from. Send this, and whoever joins from it is your friend straight away."
                className="mt-8"
              />
            ) : null}
            {sharesShelf ? null : <ShareShelfOffer className="mt-6" />}
          </div>
        ) : (
          <>
          <Form method="post" encType="multipart/form-data" className="max-w-xl">
            <h2 className={sectionHeading}>Choose the file</h2>
            <label className="mt-3 block">
              <span className="sr-only">Export file</span>
              <input
                type="file"
                name="file"
                accept=".csv,text/csv"
                required
                onChange={(event) => onFile(event.currentTarget.files?.[0])}
                className="block w-full text-sm text-stone-700 dark:text-stone-300 file:mr-3 file:rounded-md file:border file:border-stone-200 dark:file:border-stone-700 file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-stone-700 dark:file:text-stone-200 hover:file:border-stone-400 dark:hover:file:border-stone-500"
              />
            </label>
            {preview ? (
              <p className={`mt-2 text-sm ${muted}`}>
                {summary?.total === 0
                  ? "No books found in this file."
                  : `${plural(summary?.total ?? 0, "book")} in your ${SOURCE_NAMES[preview.source]} export${
                      summary?.noted
                        ? `, ${summary.noted} with a review or five stars`
                        : ""
                    }.`}
              </p>
            ) : null}

            <fieldset className="mt-6">
              <legend className="text-sm font-semibold text-stone-500 dark:text-stone-400">
                What goes on your shelf?
              </legend>
              <div className="mt-2 space-y-2">
                {choices.map((choice) => (
                  <label key={choice.value} className="flex items-center gap-2.5 text-sm text-stone-800 dark:text-stone-200">
                    <input
                      type="radio"
                      name="shelf"
                      value={choice.value}
                      checked={shelf === choice.value}
                      onChange={() => setShelf(choice.value)}
                      className="accent-stone-700 dark:accent-stone-300"
                    />
                    {choice.label}
                    {count(choice.count)}
                  </label>
                ))}
              </div>
              <p className={`mt-2 text-xs ${muted}`}>
                Your shelf is what friends can ask to borrow. Goodreads only
                knows which books you own if you&apos;ve set &ldquo;owned
                copies&rdquo; on them; if you haven&apos;t, pick the second
                option only if you own what you&apos;ve read, or scan the books
                on your shelves afterwards.
              </p>
            </fieldset>

            <label className="mt-5 flex items-center gap-2.5 text-sm text-stone-800 dark:text-stone-200">
              <input
                type="checkbox"
                name="alsoRead"
                defaultChecked
                className="accent-stone-700 dark:accent-stone-300"
              />
              Put the other books I&apos;ve read on my Also read list
              {count(summary?.alsoRead)}
            </label>

            <label className="mt-2 flex items-center gap-2.5 text-sm text-stone-800 dark:text-stone-200">
              <input
                type="checkbox"
                name="wantToRead"
                defaultChecked
                className="accent-stone-700 dark:accent-stone-300"
              />
              Put the rest of my to-read books on my want-to-read list
              {count(summary?.toRead)}
            </label>

            {result && "error" in result && !("list" in result) ? (
              <p className="mt-4 text-sm text-red-700 dark:text-red-400">{result.error}</p>
            ) : null}

            <button
              type="submit"
              disabled={importing || summary?.total === 0}
              className={`${primaryButton("lg")} mt-6 inline-flex items-center disabled:opacity-60`}
            >
              {importing ? "Importing…" : "Import"}
            </button>
          </Form>

          {/* No file? A list typed or pasted in, as a collector might keep */}
          <Form method="post" className="mt-12 max-w-xl border-t border-stone-200 dark:border-stone-800 pt-8">
            <input type="hidden" name="intent" value="list" />
            <h2 className={sectionHeading}>Or paste a list</h2>
            <p className={`mt-1 text-sm ${muted}`}>
              One book a line: a title, a title and its author (&ldquo;Piranesi
              by Susanna Clarke&rdquo;), or an ISBN. Up to {LIST_MAX} at a time,
              all on your shelf.
            </p>
            <label className="mt-3 block">
              <span className="sr-only">Your list</span>
              <textarea
                name="list"
                rows={6}
                required
                placeholder={"Piranesi by Susanna Clarke\nThe Remains of the Day - Kazuo Ishiguro\n9780441172719"}
                className="block w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 placeholder:text-stone-400 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10"
              />
            </label>
            {result && "error" in result && "list" in result ? (
              <p className="mt-3 text-sm text-red-700 dark:text-red-400">{result.error}</p>
            ) : null}
            <button
              type="submit"
              disabled={importing}
              className={`${quietButton("lg")} mt-4 inline-flex items-center disabled:opacity-60`}
            >
              {importing ? "Adding…" : "Add these books"}
            </button>
          </Form>
          </>
        )}
      </section>
    </Layout>
  );
}
