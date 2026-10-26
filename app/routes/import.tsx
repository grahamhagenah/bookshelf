import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import {
  json,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useState } from "react";

import InviteMessage from "~/components/invite-message";
import Layout from "~/components/layout";
import { primaryButton, quietButton, sectionHeading } from "~/components/ui";
import type { ImportSource, ShelfChoice } from "~/import-books";
import { defaultChoice, readExport, summarize } from "~/import-books";
import { getFriendInvite } from "~/models/friend.server";
import { importBooks } from "~/models/import.server";
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
  return json({
    inviteUrl: `${publicOrigin(request)}/invite/${await getFriendInvite(userId)}`,
  });
};

const SHELF_CHOICES: ShelfChoice[] = ["owned", "read", "all"];

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  let form: FormData;
  try {
    form = await unstable_parseMultipartFormData(
      request,
      unstable_createMemoryUploadHandler({ maxPartSize: MAX_FILE_BYTES }),
    );
  } catch {
    return json({ error: "That file is too big to import." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return json({ error: "Choose a file to import first." }, { status: 400 });
  }
  const { source, rows } = readExport(await file.text());
  if (rows.length === 0) {
    return json(
      {
        error:
          "No books found in that file. It should be the CSV that Goodreads or StoryGraph exports.",
      },
      { status: 400 },
    );
  }

  const shelf = form.get("shelf");
  const { bookIds, ...result } = await importBooks(userId, rows, {
    shelf: SHELF_CHOICES.includes(shelf as ShelfChoice)
      ? (shelf as ShelfChoice)
      : defaultChoice(rows),
    wantToRead: form.get("wantToRead") === "on",
  });
  // Covers and details come from Open Library after the reply goes out
  void fillInBooks(bookIds);
  return json({ source, ...result });
};

const SOURCE_NAMES: Record<ImportSource, string> = {
  goodreads: "Goodreads",
  storygraph: "StoryGraph",
  generic: "the file",
};

interface Preview {
  name: string;
  source: ImportSource;
  summary: ReturnType<typeof summarize>;
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

export default function Import() {
  const result = useActionData<typeof action>();
  const { inviteUrl } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const importing = navigation.state !== "idle" && navigation.formMethod === "POST";

  // Read the file in the browser first, so the choices below can say
  // what they'd do with it
  const [preview, setPreview] = useState<Preview | null>(null);
  const [shelf, setShelf] = useState<ShelfChoice>("owned");
  const onFile = async (file: File | undefined) => {
    if (!file) return setPreview(null);
    const { source, rows } = readExport(await file.text());
    setPreview({ name: file.name, source, summary: summarize(rows) });
    setShelf(defaultChoice(rows));
  };

  const summary = preview?.summary;
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
          and bring the file here. Books you own go on your shelf, and the ones
          you&apos;re meaning to read can go on your want-to-read list.
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
              {result.wanted ? `, ${result.wanted} to your want-to-read list` : ""}.
              {result.skipped
                ? ` ${plural(result.skipped, "book")} ${result.skipped === 1 ? "was" : "were"} already there.`
                : ""}
            </p>
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
          </div>
        ) : (
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
                {preview.summary.total === 0
                  ? "No books found in this file."
                  : `${plural(preview.summary.total, "book")} in your ${SOURCE_NAMES[preview.source]} export.`}
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
                Goodreads only knows which books you own if you&apos;ve set
                &ldquo;owned copies&rdquo; on them, so most people pick the
                second option.
              </p>
            </fieldset>

            <label className="mt-5 flex items-center gap-2.5 text-sm text-stone-800 dark:text-stone-200">
              <input
                type="checkbox"
                name="wantToRead"
                defaultChecked
                className="accent-stone-700 dark:accent-stone-300"
              />
              Put the rest of my to-read books on my want-to-read list
              {count(summary?.toRead)}
            </label>

            {result && "error" in result ? (
              <p className="mt-4 text-sm text-red-700 dark:text-red-400">{result.error}</p>
            ) : null}

            <button
              type="submit"
              disabled={importing || (preview !== null && preview.summary.total === 0)}
              className={`${primaryButton("lg")} mt-6 inline-flex items-center disabled:opacity-60`}
            >
              {importing ? "Importing…" : "Import"}
            </button>
          </Form>
        )}
      </section>
    </Layout>
  );
}
