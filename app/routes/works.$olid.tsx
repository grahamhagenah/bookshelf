import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";

import BookCover from "~/components/book-cover";
import { BookmarkIcon, CheckCircleIcon } from "~/components/icons";
import PersonLink from "~/components/person-link";
import { createBook, findOwnCopy, searchFriendsBooks } from "~/models/book.server";
import { shelfIds } from "~/models/household.server";
import { lookupWorkPage } from "~/models/openlibrary.server";
import { getUserById } from "~/models/user.server";
import { addWantToRead, isOnWantToRead, notifyWanters } from "~/models/wish.server";
import { LIMIT_MESSAGES, UPGRADE_PATH } from "~/plan";
import { roomForBooks } from "~/plan.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import { cleanSubjects, stripMarkdown } from "~/utils";
import { sameWork } from "~/works";

// A book that isn't on anyone's shelf yet, straight from Open Library:
// what a search result opens into. The same two choices as the result
// (add it, or want it), plus any friend's copy to borrow instead.

// Open Library work ids look like OL45804W
const OLID = /^OL\d+W$/;

const quietLink =
  "text-stone-500 dark:text-stone-400 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-800 dark:hover:text-stone-200";

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  seo({ title: data?.work ? `${data.work.title} by ${data.work.author}` : "Book", noindex: true });

export const handle = {
  breadcrumbs: (data: { work?: { title: string } } | undefined) => [
    { label: "Search", href: "/search" },
    { label: data?.work?.title ?? "Book" },
  ],
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const olid = params.olid ?? "";
  if (!OLID.test(olid)) throw new Response("Not Found", { status: 404 });
  const key = `/works/${olid}`;

  const work = await lookupWorkPage(key);
  if (!work) throw new Response("Not Found", { status: 404 });

  const [ownCopy, wanted, matches, user] = await Promise.all([
    findOwnCopy(await shelfIds(userId), { title: work.title ?? "", openLibraryKey: key }),
    isOnWantToRead(userId, { title: work.title ?? "", openLibraryKey: key }),
    searchFriendsBooks(userId, work.title ?? ""),
    getUserById(userId),
  ]);
  // Friends' copies of this book, not just ones with a similar title
  const friendCopies = matches.filter((book) =>
    sameWork({ title: book.title, openLibraryKey: null }, { title: work.title ?? "", openLibraryKey: null }),
  );

  return json({
    work,
    ownCopyId: ownCopy?.id ?? null,
    wanted,
    friendCopies,
    friendIds: user?.following?.map((friend) => friend.id) ?? [],
  });
};

// The same work as the search page's buttons, for this one book
export const action = async ({ params, request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const olid = params.olid ?? "";
  if (!OLID.test(olid)) throw new Response("Not Found", { status: 404 });
  const key = `/works/${olid}`;
  const work = await lookupWorkPage(key);
  if (!work || !work.title) throw new Response("Not Found", { status: 404 });

  const form = await request.formData();
  if (form.get("intent") === "want") {
    await addWantToRead(userId, {
      title: work.title,
      author: work.author ?? "",
      cover: work.cover ?? "",
      openLibraryKey: key,
    });
    return json({ success: true, wanted: true });
  }

  const ownCopy = await findOwnCopy(await shelfIds(userId), { title: work.title, openLibraryKey: key });
  if (ownCopy) return json({ success: false, alreadyExists: true, ownCopyId: ownCopy.id });
  if ((await roomForBooks(userId)) < 1) {
    return json({ success: false, limit: LIMIT_MESSAGES.books }, { status: 403 });
  }
  const book = await createBook({
    title: work.title,
    author: work.author ?? "",
    body: work.description,
    cover: work.cover ?? "",
    datePublished: work.datePublished,
    pageCount: work.pageCount,
    subjects: work.subjects,
    publisher: work.publisher,
    openLibraryKey: key,
    userId,
  });
  await notifyWanters(userId, [book]);
  return json({ success: true, added: book.id });
};

export default function WorkPage() {
  const data = useLoaderData<typeof loader>();
  const { work } = data;
  const fetcher = useFetcher<{
    success: boolean;
    wanted?: boolean;
    alreadyExists?: boolean;
    ownCopyId?: string;
    added?: string;
    limit?: string;
  }>();
  const intent = fetcher.formData?.get("intent");
  const adding = fetcher.state !== "idle" && intent !== "want";
  const wanting = fetcher.state !== "idle" && intent === "want";
  const added = fetcher.data?.added;
  const ownCopyId = data.ownCopyId ?? fetcher.data?.ownCopyId ?? null;
  const inLibrary = ownCopyId !== null;
  const wanted = data.wanted || fetcher.data?.wanted === true;
  const subjects = cleanSubjects(work.subjects);
  const details = [
    work.datePublished,
    work.pageCount ? `${work.pageCount} pages` : null,
    work.publisher,
  ].filter(Boolean);

  const heading = (
    <>
      <h1 className="text-2xl md:text-4xl font-semibold tracking-tight leading-tight text-stone-900 dark:text-stone-100">
        {work.title}
      </h1>
      <p className="mt-1 md:text-xl text-stone-500 dark:text-stone-400">{work.author}</p>
      {details.length > 0 ? (
        <p className="mt-3 md:mt-4 text-sm text-stone-500 dark:text-stone-400">{details.join(" · ")}</p>
      ) : null}
    </>
  );

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 md:flex-row md:gap-12 md:px-8 md:py-12">
      <section className="flex-shrink-0 space-y-4 md:w-[200px] lg:w-[240px]">
        <div className="flex items-start gap-4">
          <BookCover
            cover={work.cover}
            size="L"
            title={work.title ?? ""}
            author={work.author}
            alt={work.title ?? ""}
            eager
            className="w-[120px] flex-shrink-0 aspect-[2/3] shadow-sm md:w-[200px] lg:w-[240px]"
          />
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere] md:hidden">{heading}</div>
        </div>

        {/* The two choices from the search result, for this book */}
        <fetcher.Form method="post" className="flex flex-col gap-2">
          {added || inLibrary ? (
            <Link
              to={`/books/${added ?? ownCopyId}`}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-stone-100 dark:bg-stone-800 px-4 py-2 text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            >
              <CheckCircleIcon size={14} />
              {added ? "Added. Open it on your shelf" : "In your library. Open it"}
            </Link>
          ) : (
            <button
              type="submit"
              disabled={adding}
              className="w-full rounded-md bg-forest-600 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700 transition-colors disabled:opacity-60"
            >
              {adding ? "Adding…" : "Add to my library"}
            </button>
          )}
          {added || inLibrary ? null : wanted ? (
            <p className="inline-flex items-center justify-center gap-1.5 py-2 text-sm text-stone-500 dark:text-stone-400">
              <BookmarkIcon size={14} />
              On your want-to-read list
            </p>
          ) : (
            <button
              type="submit"
              name="intent"
              value="want"
              disabled={wanting}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors disabled:opacity-60"
            >
              <BookmarkIcon size={14} />
              {wanting ? "Saving…" : "Want to read"}
            </button>
          )}
          {fetcher.data?.limit ? (
            <p className="text-sm text-stone-600 dark:text-stone-300">
              {fetcher.data.limit}{" "}
              <Link to={UPGRADE_PATH} className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2">
                See Stacks Plus
              </Link>
            </p>
          ) : null}
        </fetcher.Form>

        {/* Borrow it instead: a friend already has a copy */}
        {data.friendCopies.length > 0 ? (
          <div className="rounded-md border border-stone-200 dark:border-stone-700 p-3 text-sm">
            <p className="font-medium text-stone-800 dark:text-stone-200">
              {data.friendCopies.length === 1 ? "A friend has it" : "Friends have it"}
            </p>
            <ul className="mt-1.5 space-y-1">
              {data.friendCopies.map((copy) => (
                <li key={copy.id} className="flex items-center justify-between gap-2">
                  <PersonLink id={copy.user.id} name={`${copy.user.firstname} ${copy.user.surname}`} friendIds={data.friendIds} />
                  <Link to={`/books/${copy.id}`} className="text-stone-500 dark:text-stone-400 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100">
                    {copy.borrowerId ? "Lent out" : "Ask to borrow"}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="relative min-w-0 flex-1">
        <div className="hidden md:block">{heading}</div>

        {subjects.length > 0 ? (
          <div className="md:mt-4 flex flex-wrap items-center gap-1.5">
            {subjects.map((subject) => (
              <span key={subject} className="rounded-full bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 text-xs text-stone-600 dark:text-stone-300">
                {subject}
              </span>
            ))}
          </div>
        ) : null}

        {work.firstSentence ? (
          <div className="mt-8">
            <h2 className="mb-2 text-sm font-semibold text-stone-500 dark:text-stone-400">Opening line</h2>
            <blockquote className="max-w-prose border-l-2 border-stone-200 dark:border-stone-700 pl-4 italic leading-relaxed text-stone-700 dark:text-stone-300">
              “{work.firstSentence}”
            </blockquote>
          </div>
        ) : null}

        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-stone-500 dark:text-stone-400">About this book</h2>
          <p className="summary max-w-prose leading-relaxed text-stone-700 dark:text-stone-300">
            {work.description ? stripMarkdown(work.description) : "Open Library has no description for this one yet."}
          </p>
        </div>

        {work.authorDetails?.bio ? (
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-semibold text-stone-500 dark:text-stone-400">About the author</h2>
            <p className="summary max-w-prose leading-relaxed text-stone-700 dark:text-stone-300">{work.authorDetails.bio}</p>
            <p className="mt-2 flex gap-4 text-sm">
              {work.authorDetails.wikipedia ? (
                <a href={work.authorDetails.wikipedia} target="_blank" rel="noopener noreferrer" className={quietLink}>
                  Wikipedia
                </a>
              ) : null}
              <a href={`https://openlibrary.org/authors/${work.authorDetails.key}`} target="_blank" rel="noopener noreferrer" className={quietLink}>
                More on Open Library
              </a>
            </p>
          </section>
        ) : null}

        <p className="mt-8 text-sm text-stone-400 dark:text-stone-500">
          Details from{" "}
          <a href={`https://openlibrary.org${work.key}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-stone-700 dark:hover:text-stone-200">
            Open Library
          </a>
          .
        </p>
      </section>
    </main>
  );
}
