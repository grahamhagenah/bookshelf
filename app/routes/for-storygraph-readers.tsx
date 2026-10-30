
import { data, Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import { GuidePage, GuideSection, proseLink } from "~/components/guide";
import { ShowcaseBorrow } from "~/components/showcase";
import { FREE_LIMITS } from "~/plan";
import { seo } from "~/seo";
import { getUserId } from "~/session.server";

// For people who keep their reading on StoryGraph: Stacks as the place
// for the books they own and lend, alongside it rather than instead of
// it. Bringing a StoryGraph library over comes first.

export const meta: MetaFunction = () =>
  seo({
    title: "Lend your books, alongside StoryGraph",
    description:
      "Keep your reading on StoryGraph and use Stacks for the books on your shelf: who has them, when they're due back, and which friends own the book you want next. Import your StoryGraph library in a minute.",
    path: "/for-storygraph-readers",
  });

export const loader = async ({ request }: LoaderFunctionArgs) =>
  data({ signedIn: Boolean(await getUserId(request)) });

// Things StoryGraph readers have asked for, and where they are here
const ASKED: { asked: string; here: string }[] = [
  {
    asked: "Mark books as lent or borrowed",
    here: "Lend a copy to a friend with a due date. Stacks reminds them as it nears, and keeps a history of everyone who's had it.",
  },
  {
    asked: "See which friends own a book",
    here: "Search once and see every friend with a copy, then ask to borrow it with a tap.",
  },
  {
    asked: "Share a library with someone you live with",
    here: "Couples and housemates share one shelf, and keep their own notes, hearts and friends.",
  },
  {
    asked: "A wishlist of books you'd like to own",
    here: "Your want-to-read list tells you when a friend adds one of them, so you can borrow it instead of buying it.",
  },
];

const strong = "font-semibold text-stone-900 dark:text-stone-100";

export default function ForStoryGraphReaders() {
  const { signedIn } = useLoaderData<typeof loader>();
  // Signed out, joining comes first, then straight on to the import
  const start = signedIn
    ? "/import"
    : `/join?${new URLSearchParams({ redirectTo: "/import" })}`;

  return (
    <GuidePage
      eyebrow="For StoryGraph readers"
      title="StoryGraph tracks what you read. Stacks tracks who has your books."
      intro={
        <>
          Stacks is for the physical books you own: who has them, when
          they&apos;re due back, and which friends own the book you want next.
          Keep logging your reading on StoryGraph, and use both.
        </>
      }
    >
      {/* The way in, before anything else */}
      <section
        aria-labelledby="bring-it-over"
        className="rounded-xl border border-stone-200 dark:border-stone-800 px-5 py-6 sm:px-6"
      >
        <h2
          id="bring-it-over"
          className="text-xl font-semibold text-stone-900 dark:text-stone-100"
        >
          Bring your StoryGraph library over
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-stone-700 dark:text-stone-300 marker:text-stone-400">
          <li>
            In StoryGraph, open{" "}
            <a
              href="https://app.thestorygraph.com/user-export"
              target="_blank"
              rel="noreferrer"
              className={proseLink}
            >
              Manage account, then Export StoryGraph library
            </a>
            , and download the file when it&apos;s ready.
          </li>
          <li>Import that file into Stacks.</li>
          <li>
            Books marked as owned go on your shelf, the others you&apos;ve read
            on your Also read list, and your to-read books on your want-to-read
            list. Your reviews come along as notes, and five stars as a heart.
            You choose before anything is added.
          </li>
        </ol>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            to={start}
            className="inline-flex flex-shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-forest-600 px-5 py-2.5 font-medium text-white hover:bg-forest-700 transition-colors"
          >
            Import your StoryGraph library
          </Link>
          <span className="text-sm text-stone-500 dark:text-stone-400">
            Free for your first {FREE_LIMITS.books} books. Your StoryGraph
            account stays as it is.
          </span>
        </div>
      </section>

      <GuideSection title="What StoryGraph readers ask for, already here">
        <p>
          On StoryGraph&apos;s own feature board, readers have asked for ways to
          keep track of the books they own and lend. That&apos;s what Stacks is
          built around.
        </p>
        <ul className="space-y-4">
          {ASKED.map((item) => (
            <li key={item.asked}>
              <span className={strong}>{item.asked}.</span> {item.here}
            </li>
          ))}
        </ul>
        <div className="pt-4">
          <ShowcaseBorrow />
        </div>
      </GuideSection>

      <GuideSection title="How the two fit together">
        <p>
          Log what you read, rate it and see your stats on StoryGraph, as you do
          now. Use Stacks for the copies on your shelf and your friends&apos;:
          lending them, borrowing theirs, and leaving a note inside for the next
          reader. When you buy or borrow a new book, add it to Stacks by
          scanning its barcode with your phone.
        </p>
      </GuideSection>

      <GuideSection title="What Stacks doesn't do">
        <p>
          There are no star ratings, reading stats, mood-based recommendations
          or reading challenges here. Those are what StoryGraph does well, so
          keep them there. Stacks is a website that works in your phone&apos;s
          browser rather than an app from a store.
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Stacks isn&apos;t affiliated with The StoryGraph. See also{" "}
          <Link to="/goodreads-alternative" className={proseLink}>
            how Stacks compares with Goodreads and others
          </Link>
          .
        </p>
      </GuideSection>
    </GuidePage>
  );
}
