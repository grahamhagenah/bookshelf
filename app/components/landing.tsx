
import { Link } from "react-router";

import { FREE_LIMITS, PLUS_PRICES } from "~/plan";

import DemoButton from "./demo-button";
import Showcase, {
  ShowcaseBorrow,
  ShowcaseDesk,
  ShowcaseGroups,
  ShowcaseHome,
  ShowcaseNotes,
  ShowcasePage,
} from "./showcase";
import { sectionHeading } from "./ui";

// The signed-out home page: what Stacks is, beside a small, staged glimpse
// of the app itself, so people see what they're signing up for

// One function of the app in more detail: words on one side, a staged
// glimpse on the other (alternating sides on wider screens)
function Feature({
  title,
  children,
  visual,
  flip = false,
}: {
  title: string;
  children: React.ReactNode;
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="grid items-center gap-10 border-t border-stone-200 dark:border-stone-800 pt-16 md:grid-cols-2 md:gap-16 md:pt-20">
      <div className={flip ? "md:order-last" : undefined}>
        <h2 className="text-balance text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
          {title}
        </h2>
        <p className="mt-4 max-w-md text-pretty text-lg leading-relaxed text-stone-600 dark:text-stone-300">
          {children}
        </p>
      </div>
      {visual}
    </section>
  );
}

// A few of the questions from the FAQ page, the ones people ask first
const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  {
    q: "How is this different from Goodreads or StoryGraph?",
    a: (
      <>
        Those track your reading. Stacks is about the physical copies on your
        shelves and the people around you: who has which book, and getting it
        into a friend&apos;s hands. No ratings, no recommendation engine, no
        feed of strangers.
      </>
    ),
  },
  {
    q: "Do I have to lend my books out?",
    a: (
      <>
        No. Every request comes to you and you can say no. Plenty of people use
        Stacks as a catalog of what they own and mostly borrow.
      </>
    ),
  },
  {
    q: "We share our books at home. Do we need two accounts?",
    a: (
      <>
        One each, sharing a shelf. You both see and lend everything, and keep
        your own notes, hearts, read marks and friends.
      </>
    ),
  },
  {
    q: "Does it cost anything?",
    a: (
      <>
        It&apos;s free for up to {FREE_LIMITS.books} books (
        {FREE_LIMITS.sharedBooks} on a shelf you share at home), with as many
        friends as you like. Stacks Plus lifts the book limit for $
        {PLUS_PRICES.monthly} a month or ${PLUS_PRICES.yearly} a year.{" "}
        <Link to="/pricing" className="underline underline-offset-2">
          See pricing
        </Link>
      </>
    ),
  },
];

export default function Landing() {
  return (
    <main className="px-4 md:px-8 pt-10 pb-16 md:pt-20 md:pb-24">
      <section className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,31rem)] lg:gap-16">
        <div>
          <h1 className="text-5xl sm:text-6xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.02] text-stone-900 dark:text-stone-50">
            Your books.
            <br />
            {/* The turn of the page, in the logo's serif */}
            <em className="font-serif font-semibold italic">Our</em> shelf.
          </h1>
          <p className="mt-5 max-w-lg text-balance text-xl sm:text-2xl leading-snug text-stone-600 dark:text-stone-300">
            The book you want is probably on a friend&apos;s shelf. Borrow it,
            and lend yours knowing it&apos;ll come back.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/join"
              className="inline-flex items-center justify-center rounded-md bg-forest-600 px-6 py-3 text-lg font-medium text-white hover:bg-forest-700 transition-colors"
            >
              Create an account
            </Link>
            {/* Signing in lives in the header; here, the way to look first */}
            <DemoButton className="inline-flex w-full items-center justify-center rounded-md ring-1 ring-inset ring-stone-300 dark:ring-stone-700 px-6 py-3 text-lg font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors">
              Try the demo
            </DemoButton>
          </div>
          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
            No account needed. See a full library, friends and all.
          </p>
        </div>

        <Showcase />
      </section>

      {/* The app itself, the way it looks once you're in */}
      <section className="mt-20 md:mt-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
            Your home page, at a glance
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-stone-600 dark:text-stone-300">
            What you&apos;re borrowing, what&apos;s lent out and when it&apos;s due, and what friends
            are reading, all on one page.
          </p>
        </div>
        <div className="mt-10">
          <ShowcaseHome />
        </div>
        <div className="mt-6 text-center">
          {/* Like the home page's own "See more" links: an arrow that
              nudges forward on hover */}
          <DemoButton className="group py-1 font-medium text-stone-800 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white transition-colors">
            Look around the demo{" "}
            <span
              aria-hidden="true"
              className="inline-block text-stone-400 dark:text-stone-500 transition-transform group-hover:translate-x-0.5"
            >
              →
            </span>
          </DemoButton>
        </div>
      </section>

      <div className="mt-20 space-y-20 md:mt-28 md:space-y-28">
        <Feature
          title="Every friend's shelf, as one."
          visual={<ShowcaseBorrow />}
        >
          Browse everything your friends own in one place, with the books on
          your want-to-read list first and what&apos;s free to borrow right
          now. Ask with a tap. Looking for one book? Search every shelf at
          once, and if nobody has it yet, you&apos;ll hear the moment a friend
          does.
        </Feature>

        <Feature
          title="Bring the whole book club."
          visual={<ShowcaseGroups />}
          flip
        >
          Start a group for your book club, your office or your family, and
          share one link. Everyone who joins can browse and borrow from
          everyone else&apos;s shelves, without adding each other one by one.
        </Feature>

        <Feature
          title="Lend to anyone, even without an account."
          visual={<ShowcaseDesk />}
        >
          Neighbors, family, a whole classroom: lend by name, and the reminders
          come to you. The check-out desk makes it quick. Scan a book, tap a
          name, and scan it again when it comes back.
        </Feature>

        <Feature
          title="Your shelf, out in the world."
          visual={<ShowcasePage />}
          flip
        >
          Your shelf gets its own page, with a line about you and the
          favorites you pin up top. Anyone can browse it without an account,
          and friends can see what&apos;s free and ask to borrow.
        </Feature>

        <Feature title="Books with a history." visual={<ShowcaseNotes />}>
          Leave a heart or a line for the next reader. Notes stay with the book
          as it moves between friends, so you can see where it&apos;s been and
          what everyone thought.
        </Feature>

        {/* The questions people ask first, and the way to the rest */}
        <section className="border-t border-stone-200 dark:border-stone-800 pt-16 md:pt-20">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-16">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
                Questions
              </h2>
              <Link
                to="/faq"
                className="mt-4 inline-block text-stone-700 dark:text-stone-200 font-medium underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:underline"
              >
                Read them all →
              </Link>
            </div>
            <div className="divide-y divide-stone-200 dark:divide-stone-800 border-y border-stone-200 dark:border-stone-800">
              {QUESTIONS.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className={`${sectionHeading} flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden`}>
                    <span>{item.q}</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                      className="flex-shrink-0 text-stone-400 transition-transform group-open:rotate-180"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </summary>
                  <p className="mt-2 max-w-prose text-pretty leading-relaxed text-stone-600 dark:text-stone-300">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* One last nudge: the point of it all */}
        <section className="border-t border-stone-200 dark:border-stone-800 pt-16 text-center md:pt-20">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
            Don&apos;t let your books collect dust
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-balance text-lg text-stone-600 dark:text-stone-300">
            Most books get read once, then sit on a shelf for years. Put yours
            where friends can borrow them: scan your shelf with your phone, or
            bring your list over from Goodreads, StoryGraph or a spreadsheet.
            Free for your first{" "}
            {FREE_LIMITS.books} books.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/join"
              className="inline-flex items-center justify-center rounded-md bg-forest-600 px-6 py-3 text-lg font-medium text-white hover:bg-forest-700 transition-colors"
            >
              Create an account
            </Link>
            <DemoButton className="inline-flex w-full items-center justify-center rounded-md ring-1 ring-inset ring-stone-300 dark:ring-stone-700 px-6 py-3 text-lg font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors">
              Try the demo
            </DemoButton>
          </div>
        </section>
      </div>
    </main>
  );
}
