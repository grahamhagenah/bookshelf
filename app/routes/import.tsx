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
import { roomForBooks } from "~/plan.server";
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
  const room = await roomForBooks(userId);
  // Once the books are in, a message to bring friends over
  return data({
    inviteUrl: `${publicOrigin(request)}/invite/${await getFriendInvite(userId)}`,
    // And to someone at home, unless they share the shelf already
    sharesShelf: (await shelfIds(userId)).length > 1,
    // How many more a free shelf takes; none means no limit
    room: Number.isFinite(room) ? room : null,
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
  leftOut: string[];
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

export default function Import() {
  const result = useActionData<typeof action>();
  const { inviteUrl, sharesShelf, room } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const importing = navigation.state !== "idle" && navigation.formMethod === "POST";

  // Read the file in the browser first, so the choices below can say
  // what they'd do with it
  const [preview, setPreview] = useState<Preview | null>(null);
  const [shelf, setShelf] = useState<ShelfChoice>(DEFAULT_CHOICE);
  const onFile = async (file: File | undefined) => {
    if (!file) return setPreview(null);
    const { source, rows, leftOut } = readExport(await file.text());
    setPreview({ name: file.name, source, rows, leftOut });
  };

  const summary = preview ? summarize(preview.rows, shelf) : undefined;
  // Everything in it goes on the shelf, as with a spreadsheet of one's own
  // books, so there's nothing to choose
  const allShelf =
    summary !== undefined && summary.owned === summary.total && summary.toRead === 0 && summary.alsoRead === 0;
  const onShelf = summary
    ? shelf === "all"
      ? summary.total
      : shelf === "read"
        ? summary.read
        : summary.owned
    : 0;
  const count = (n: number | undefined) =>
    n === undefined ? null : (
      <span className="ml-1.5 text-stone-400 dark:text-stone-500">{n}</span>
    );
  const choices: { value: ShelfChoice; label: string; count: number | undefined }[] = [
    { value: "owned", label: "Books marked as owned", count: summary?.owned },
    { value: "read", label: "Books I've read, and any owned", count: summary?.read },
    { value: "all", label: "Everything", count: summary?.total },
  ];

  const muted = "text-stone-500 dark:text-stone-400";
  const linkClass = "underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600";
  // A quiet box for each part, ruled like the page's other lines
  const box = "rounded-lg border border-stone-200 dark:border-stone-800 p-4 sm:p-5";
  const boxHeading = "font-semibold text-stone-900 dark:text-stone-100";
  const option = "flex items-center gap-2.5 text-sm text-stone-800 dark:text-stone-200";

  // Where each service keeps its export
  const sources = [
    {
      name: "Goodreads",
      steps: (
        <>
          <a href="https://www.goodreads.com/review/import" className={linkClass} target="_blank" rel="noreferrer">
            My Books → Import and export
          </a>
          , then Export Library.
        </>
      ),
    },
    {
      name: "StoryGraph",
      steps: (
        <>
          <a href="https://app.thestorygraph.com/user-export" className={linkClass} target="_blank" rel="noreferrer">
            Manage account → Export
          </a>
          , then download it when it&apos;s ready.
        </>
      ),
    },
    {
      name: "Anywhere else",
      steps: "A LibraryThing or Libib export, or a spreadsheet saved as CSV with Title and Author columns.",
    },
  ];

  return (
    <Layout title="Import your books">
      {result && "added" in result ? (
        <section>
          <h2 className={sectionHeading}>Done</h2>
          <p className="mt-1 text-stone-700 dark:text-stone-300">
            {result.added + result.alsoRead + result.wanted === 0
              ? `Nothing new from ${SOURCE_NAMES[result.source]}`
              : `From ${SOURCE_NAMES[result.source]}: ${plural(result.added, "book")} added to your shelf${
                  result.alsoRead ? `, ${result.alsoRead} to Also read` : ""
                }${result.wanted ? `, ${result.wanted} to Want to read` : ""}`}
            .
            {result.skipped
              ? ` ${plural(result.skipped, "book")} ${result.skipped === 1 ? "was" : "were"} already there.`
              : ""}
          </p>
          {"notes" in result && result.notes > 0 ? (
            <p className="mt-1 text-stone-700 dark:text-stone-300">
              Your {result.notes === 1 ? "review or five stars" : `${result.notes} reviews and five stars`} came
              along as notes and hearts.
            </p>
          ) : null}
          {result.added > 0 ? (
            <p className={`mt-1 text-sm ${muted}`}>Covers and details fill in over the next minute or two.</p>
          ) : null}
          {result.unfound.length > 0 ? (
            <p className={`mt-2 text-sm ${muted}`}>
              Open Library didn&apos;t know {result.unfound.join(", ")}. Try{" "}
              {result.unfound.length === 1 ? "it" : "them"} by title in search.
            </p>
          ) : null}
          {result.overLimit ? (
            <p className="mt-3 rounded-lg bg-stone-100 dark:bg-stone-900 px-4 py-3 text-sm text-stone-700 dark:text-stone-200">
              Your free shelf is full, so {plural(result.overLimit, "book")} didn&apos;t fit. With
              Stacks Plus, import again to add the rest.{" "}
              <Link to={UPGRADE_PATH} className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2">
                See Stacks Plus
              </Link>
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/books" className={`${primaryButton("lg")} inline-flex items-center`}>
              See your shelf
            </Link>
            {result.alsoRead ? (
              <Link to="/read-elsewhere" className={`${quietButton("lg")} inline-flex items-center`}>
                Also read
              </Link>
            ) : null}
            {result.wanted ? (
              <Link to="/want-to-read" className={`${quietButton("lg")} inline-flex items-center`}>
                Want to read
              </Link>
            ) : null}
          </div>
          {result.added > 0 ? (
            <InviteMessage
              url={inviteUrl}
              title="Now tell your friends"
              intro="Your shelf is ready to borrow from. Whoever joins from this message is your friend straight away."
              className="mt-8"
            />
          ) : null}
          {sharesShelf ? null : <ShareShelfOffer className="mt-6" />}
        </section>
      ) : (
        <section>
          <h2 className={sectionHeading}>Import your books</h2>
          <p className={`mt-1 max-w-xl text-pretty ${muted}`}>
            Bring your library over from another app or a spreadsheet. Reviews come along as notes,
            and five stars as a heart.
          </p>

          <h3 className={`mt-6 text-sm font-semibold ${muted}`}>1. Export your books</h3>
          <ul className="mt-2 grid gap-3 sm:grid-cols-3">
            {sources.map((source) => (
              <li key={source.name} className={`${box} text-sm`}>
                <p className={boxHeading}>{source.name}</p>
                <p className="mt-1 text-pretty text-stone-600 dark:text-stone-300">{source.steps}</p>
              </li>
            ))}
          </ul>

          {/* The file, and beside it on wide screens the way without one */}
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-2 lg:gap-4">
          <div>
          <h3 className={`text-sm font-semibold ${muted}`}>2. Bring in the file</h3>
          <Form method="post" encType="multipart/form-data" className={`mt-2 ${box}`}>
            <label className="block">
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
              <div className={`mt-2 space-y-1 text-sm ${muted}`}>
                <p>
                  {summary?.total === 0
                    ? "No books found in this file."
                    : `${plural(summary?.total ?? 0, "book")} from ${SOURCE_NAMES[preview.source]}${
                        summary?.noted ? `, ${summary.noted} with a review or five stars` : ""
                      }.${allShelf ? " All of them go on your shelf." : ""}`}
                </p>
                {preview.leftOut.length > 0 ? (
                  <p>
                    Titles, authors and ISBNs come in; {preview.leftOut.join(", ")}{" "}
                    {preview.leftOut.length === 1 ? "doesn't" : "don't"}.
                  </p>
                ) : null}
                {room !== null && onShelf > room ? (
                  <p className="font-medium text-stone-700 dark:text-stone-300">
                    Your free shelf has room for {plural(room, "more book")}, so{" "}
                    {room === 0 ? "none will fit" : `the first ${room} go on`}
                    {summary && summary.owned < onShelf ? ", owned ones first" : ""}.{" "}
                    <Link to={UPGRADE_PATH} className={linkClass}>
                      Stacks Plus
                    </Link>{" "}
                    takes them all.
                  </p>
                ) : null}
              </div>
            ) : null}

            {allShelf ? null : (
            <>
            <fieldset className="mt-5 border-t border-stone-100 dark:border-stone-800 pt-4">
              <legend className="sr-only">What goes on your shelf?</legend>
              {/* The legend says it to screen readers */}
              <p aria-hidden="true" className={boxHeading}>
                What goes on your shelf?
              </p>
              <p className={`mt-0.5 text-sm ${muted}`}>Your shelf is what friends can borrow.</p>
              <div className="mt-3 space-y-2">
                {choices.map((choice) => (
                  <label key={choice.value} className={option}>
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
                Goodreads only knows you own a book if you set &ldquo;owned copies&rdquo; on it.
              </p>
            </fieldset>

            <div className="mt-5 space-y-2 border-t border-stone-100 dark:border-stone-800 pt-4">
              <p className={boxHeading}>And the rest</p>
              <label className={option}>
                <input type="checkbox" name="alsoRead" defaultChecked className="accent-stone-700 dark:accent-stone-300" />
                Other books I&apos;ve read go on Also read
                {count(summary?.alsoRead)}
              </label>
              <label className={option}>
                <input type="checkbox" name="wantToRead" defaultChecked className="accent-stone-700 dark:accent-stone-300" />
                Books I want to read, or am reading, go on Want to read
                {count(summary?.toRead)}
              </label>
            </div>
            </>
            )}

            {result && "error" in result && !("list" in result) ? (
              <p className="mt-4 text-sm text-red-700 dark:text-red-400">{result.error}</p>
            ) : null}

            <button
              type="submit"
              disabled={importing || summary?.total === 0}
              className={`${primaryButton("lg")} mt-5 inline-flex items-center disabled:opacity-60`}
            >
              {importing ? "Importing…" : "Import"}
            </button>
          </Form>

          </div>

          {/* No file? A list typed or pasted in, as a collector might keep */}
          <div>
          <h3 className={`text-sm font-semibold ${muted}`}>No file? Paste a list</h3>
          <Form method="post" className={`mt-2 ${box}`}>
            <input type="hidden" name="intent" value="list" />
            <p className={`text-sm ${muted}`}>
              One book a line: a title, &ldquo;title by author&rdquo;, or an ISBN. Up to {LIST_MAX}, all
              on your shelf.
            </p>
            <label className="mt-3 block">
              <span className="sr-only">Your list</span>
              <textarea
                name="list"
                rows={8}
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
          </div>
          </div>
        </section>
      )}
    </Layout>
  );
}
