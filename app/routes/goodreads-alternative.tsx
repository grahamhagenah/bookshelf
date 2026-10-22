import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { GuidePage, GuideSection, proseLink } from "~/components/guide";
import { ShowcaseFriends } from "~/components/showcase";
import { seo } from "~/seo";

// For people looking for something other than Goodreads: an honest
// account of what Stacks is for, next to the reading trackers

export const meta: MetaFunction = () =>
  seo({
    title: "A Goodreads alternative for the books you own",
    description:
      "How Stacks compares with Goodreads, StoryGraph and LibraryThing: a free app for the physical books on your shelves and lending them to friends. Import your Goodreads library in a minute.",
    path: "/goodreads-alternative",
  });

const APPS: { name: string; builtFor: string; bestIf: string; highlight?: boolean }[] = [
  {
    name: "Goodreads",
    builtFor: "A reading log with ratings, reviews and recommendations.",
    bestIf: "You want to rate books and see what other readers think of them.",
  },
  {
    name: "StoryGraph",
    builtFor: "Reading stats, goals and recommendations by mood and pace.",
    bestIf: "You like charts of your reading and help choosing what's next.",
  },
  {
    name: "LibraryThing",
    builtFor: "Detailed cataloging of a personal collection.",
    bestIf: "You want precise records of every edition you own.",
  },
  {
    name: "Stacks",
    builtFor: "The physical books you own, and lending them to people you know.",
    bestIf: "You'd like your friends' shelves to feel like a second library.",
    highlight: true,
  },
];

export default function GoodreadsAlternative() {
  return (
    <GuidePage
      eyebrow="Goodreads alternative"
      title="A Goodreads alternative for the books on your shelves"
      intro={
        <>
          Goodreads, StoryGraph and LibraryThing are built around tracking what you read or
          cataloging what you own. Stacks is built around something they don&apos;t focus on:
          the physical copies on your shelves, and passing them between friends.
        </>
      }
    >
      <GuideSection title="What each one is built for">
        <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 dark:bg-stone-900 text-stone-500 dark:text-stone-400">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">App</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Built for</th>
                <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Best if</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {APPS.map((app) => (
                <tr key={app.name} className={app.highlight ? "bg-forest-600/5 dark:bg-forest-400/10" : undefined}>
                  <th scope="row" className="px-4 py-3 align-top font-semibold text-stone-900 dark:text-stone-100">
                    {app.name}
                  </th>
                  <td className="px-4 py-3 align-top">
                    {app.builtFor}
                    {/* On phones the third column folds in here */}
                    <span className="mt-1 block text-stone-500 dark:text-stone-400 sm:hidden">
                      {app.bestIf}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 align-top text-stone-600 dark:text-stone-300 sm:table-cell">
                    {app.bestIf}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          They aren&apos;t rivals so much as different tools. Plenty of people keep a reading
          log on one of the others and use Stacks for the books they actually own.
        </p>
      </GuideSection>

      <GuideSection title="What Stacks does differently">
        <ul className="list-disc space-y-2 pl-5 marker:text-stone-300 dark:marker:text-stone-600">
          <li>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">Your copies, not just titles.</strong>{" "}
            Each book on your shelf is your copy: where it is, who has it, who&apos;s had it.
          </li>
          <li>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">Your friends&apos; shelves, searchable.</strong>{" "}
            Search once and see which friends own a book, then ask to borrow it.
          </li>
          <li>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">Lending that keeps track.</strong>{" "}
            Due dates, gentle reminders, and a history of everyone who&apos;s borrowed each copy.
          </li>
          <li>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">Notes that travel with the book.</strong>{" "}
            A heart or a line left for the next reader, like a pencilled note inside the cover.
          </li>
          <li>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">A want-to-read list that watches for you.</strong>{" "}
            When a friend adds a book you&apos;re after, you hear about it.
          </li>
          <li>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">One shelf for the household.</strong>{" "}
            Couples and housemates can share a shelf and keep their own notes and friends.
          </li>
        </ul>
        <div className="pt-4">
          <ShowcaseFriends />
        </div>
      </GuideSection>

      <GuideSection title="Do I have to leave Goodreads?">
        <p>
          No. You can bring your library over and keep using both: track your reading where you
          already do, and lend from Stacks. Export your library from Goodreads (My Books, then
          Import and export) or StoryGraph, then{" "}
          <Link to="/import" className={proseLink}>
            import the file
          </Link>
          . You choose which books go on your shelf and which go on your want-to-read list.
        </p>
      </GuideSection>

      <GuideSection title="What Stacks doesn't do">
        <p>
          There are no star ratings, public reviews, reading challenges or recommendation
          engine, and no public profile: your shelf is seen by your friends, plus anyone you
          send a link to. Stacks is a website that works in your phone&apos;s browser rather than
          an app from a store. If what you want is a detailed record of everything you&apos;ve
          ever read, one of the others will suit you better.
        </p>
      </GuideSection>
    </GuidePage>
  );
}
