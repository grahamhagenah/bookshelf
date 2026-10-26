
import { Link } from "react-router";
import type { MetaFunction } from "react-router";

import { GuidePage, GuideSection, proseLink } from "~/components/guide";
import ShowcaseLending from "~/components/showcase";
import { seo } from "~/seo";

// For people searching for how to lend books without losing them: the
// habits that help, then how Stacks takes care of them

export const meta: MetaFunction = () =>
  seo({
    title: "How to lend books to friends (and get them back)",
    description:
      "Why lent books go missing, five habits that bring them home, and a free app that keeps track of who has which book, with due dates and gentle reminders.",
    path: "/lend-books-to-friends",
  });

const HABITS: [string, string][] = [
  ["Write down who has it.", "The book that never comes back is usually the one nobody remembers lending."],
  ["Agree a rough return date.", "Four weeks is plenty for most books. A date turns 'whenever' into a plan."],
  ["Remind them, kindly, before it's due.", "A friendly nudge a few days ahead is easier for both of you than chasing a late book."],
  ["Make it easy to ask.", "Friends borrow more, and return more, when they can see what's on your shelf."],
  ["Leave a note in it.", "A line for the next reader makes a lent book feel shared rather than gone."],
];

export default function LendBooksToFriends() {
  return (
    <GuidePage
      eyebrow="Lending books"
      title="How to lend books to friends, and get them back"
      intro={
        <>
          Almost everyone has a favorite book they lent out and never saw again. Usually
          nobody did anything wrong. It just wasn&apos;t written down, there was no date, and
          asking for it back felt awkward.
        </>
      }
    >
      <GuideSection title="Five habits that bring books home">
        <ol className="space-y-3">
          {HABITS.map(([habit, why], index) => (
            <li key={habit} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 text-sm font-semibold text-stone-700 dark:text-stone-200">
                {index + 1}
              </span>
              <span>
                <strong className="font-semibold text-stone-900 dark:text-stone-100">{habit}</strong>{" "}
                {why}
              </span>
            </li>
          ))}
        </ol>
        <p>
          You can do all of this with a notebook. Stacks does it for you, and makes the
          borrowing side easy too.
        </p>
      </GuideSection>

      <GuideSection title="How Stacks keeps track">
        <div className="py-2">
          <ShowcaseLending />
        </div>
        <ol className="list-decimal space-y-2 pl-5 marker:text-stone-400">
          <li>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">Add your books.</strong>{" "}
            Search for them, scan the barcodes with your phone, or{" "}
            <Link to="/import" className={proseLink}>
              import a Goodreads or StoryGraph export
            </Link>
            .
          </li>
          <li>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">Invite your friends.</strong>{" "}
            Send your invite link; when they join, you can see each other&apos;s shelves.
          </li>
          <li>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">Lend with a due date.</strong>{" "}
            When a friend asks, pick how long they can keep it, or hand a book over yourself.
          </li>
          <li>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">Let the reminders do the asking.</strong>{" "}
            Stacks nudges the borrower before the date and if it&apos;s late. Need more time? Extend
            it in a tap.
          </li>
          <li>
            <strong className="font-semibold text-stone-900 dark:text-stone-100">Mark it returned.</strong>{" "}
            Every copy keeps a history of who&apos;s had it, and what they thought.
          </li>
        </ol>
      </GuideSection>

      <GuideSection title="Borrowing works the same way">
        <p>
          Search once to see which friends own a book and ask to borrow it. If someone else has
          it, get in line and Stacks asks for you when it comes back. Keep a want-to-read list,
          and you&apos;ll hear when a friend adds one of those books to their shelf.
        </p>
        <p>
          It&apos;s free to start and works in your phone&apos;s browser. Wondering how it compares with
          Goodreads?{" "}
          <Link to="/goodreads-alternative" className={proseLink}>
            Here&apos;s an honest comparison
          </Link>
          .
        </p>
      </GuideSection>
    </GuidePage>
  );
}
