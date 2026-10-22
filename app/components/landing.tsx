import { Link } from "@remix-run/react";

import { FREE_LIMITS, PLUS_PRICES } from "~/plan";

import DemoButton from "./demo-button";
import { CameraIcon, HomeIcon } from "./icons";
import Showcase, { ShowcaseFriends, ShowcaseNotes, ShowcaseWant } from "./showcase";

// The signed-out home page: what Stacks is, beside a small, staged glimpse
// of the app itself, so people see what they're signing up for

// One function of the app in more detail: words on one side, a staged
// glimpse on the other (alternating sides on wider screens)
function Feature({
  eyebrow,
  title,
  children,
  visual,
  flip = false,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <section className="grid items-center gap-10 border-t border-stone-200 dark:border-stone-800 pt-16 md:grid-cols-2 md:gap-16 md:pt-20">
      <div className={flip ? "md:order-last" : undefined}>
        <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">{eyebrow}</p>
        <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
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

// Smaller things worth knowing, three across under the big features
function Extra({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200">
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-semibold text-stone-900 dark:text-stone-50">{title}</h3>
      <p className="mt-1.5 text-pretty leading-relaxed text-stone-600 dark:text-stone-300">
        {children}
      </p>
    </div>
  );
}

function LinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1" />
    </svg>
  );
}

// A few of the questions from the FAQ page, the ones people ask first
const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  {
    q: "How is this different from Goodreads or StoryGraph?",
    a: (
      <>
        Those track your reading. Stacks is about the physical copies on your shelves and
        the people around you: who has which book, and getting it into a friend&apos;s
        hands. No ratings, no recommendation engine, no public profiles.
      </>
    ),
  },
  {
    q: "Do I have to lend my books out?",
    a: (
      <>
        No. Every request comes to you and you can say no. Plenty of people use Stacks as a
        catalogue of what they own and mostly borrow.
      </>
    ),
  },
  {
    q: "We share our books at home. Do we need two accounts?",
    a: (
      <>
        One each, sharing a shelf. You both see and lend everything, and keep your own
        notes, hearts, read marks and friends.
      </>
    ),
  },
  {
    q: "Does it cost anything?",
    a: (
      <>
        It&apos;s free for up to {FREE_LIMITS.books} books and {FREE_LIMITS.friends} friends.
        Stacks Plus lifts both limits for ${PLUS_PRICES.monthly} a month or ${PLUS_PRICES.yearly} a
        year.{" "}
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
      <section className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
        <div>
          <h1 className="text-5xl sm:text-6xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.02] text-stone-900 dark:text-stone-50">
            Your bookshelf,
            <br />
            shared with friends.
          </h1>
          <p className="mt-5 max-w-lg text-balance text-xl sm:text-2xl leading-snug text-stone-600 dark:text-stone-300">
            Catalog your home library, lend books to friends with reminders so
            they come back, and borrow theirs.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/join"
              className="inline-flex items-center justify-center rounded-md bg-forest-600 px-6 py-3 text-lg font-medium text-white hover:bg-forest-700 transition-colors"
            >
              Create an account
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-md ring-1 ring-inset ring-stone-300 dark:ring-stone-700 px-6 py-3 text-lg font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
            >
              Sign in
            </Link>
          </div>
          <div className="mt-6 text-base text-stone-500 dark:text-stone-400">
            <DemoButton className="text-stone-700 dark:text-stone-200 font-medium underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:underline">
              Or look around a demo library first →
            </DemoButton>
          </div>
        </div>

        <Showcase />
      </section>

      <div className="mt-20 space-y-20 md:mt-28 md:space-y-28">
        <Feature
          eyebrow="Borrow"
          title="Everything your friends own, in one search"
          visual={<ShowcaseFriends />}
        >
          Search once and see which friends have a book, then ask to borrow it
          with a tap. They pick how long you can keep it, and Stacks reminds you
          both when it&apos;s due, so lent books find their way home.
        </Feature>

        <Feature
          eyebrow="Want to read"
          title="Hear the moment a friend has it"
          visual={<ShowcaseWant />}
          flip
        >
          Keep a list of books you&apos;d like to read. When a friend adds one to
          their shelf, you&apos;ll know, and you can ask for it straight away.
        </Feature>

        <Feature
          eyebrow="Notes"
          title="Every copy carries its story"
          visual={<ShowcaseNotes />}
        >
          Leave a heart or a line for the next reader. Notes stay with the book
          as it moves between friends, so you can see where it&apos;s been and
          what everyone thought.
        </Feature>

        {/* The rest, briefly */}
        <section className="border-t border-stone-200 dark:border-stone-800 pt-16 md:pt-20">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
            And a few more things
          </h2>
          <div className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            <Extra icon={<CameraIcon size={18} />} title="Fill your shelf fast">
              Scan the barcodes on a shelf of books with your phone, or bring your
              list over from Goodreads or StoryGraph in one go.
            </Extra>
            <Extra icon={<HomeIcon size={18} />} title="One shelf for the household">
              Live with someone whose books are your books? Share one shelf, with
              your own logins, notes and friends.
            </Extra>
            <Extra icon={<LinkIcon />} title="A link to your library">
              Send anyone a link to browse your books, no account needed. Friends
              can join to borrow from you.
            </Extra>
          </div>
        </section>

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
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-stone-900 dark:text-stone-100 [&::-webkit-details-marker]:hidden">
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

        {/* One last nudge */}
        <section className="border-t border-stone-200 dark:border-stone-800 pt-16 text-center md:pt-20">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
            Start your shelf
          </h2>
          <p className="mt-3 text-lg text-stone-600 dark:text-stone-300">
            It&apos;s free to start, and takes a minute.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/join"
              className="inline-flex items-center justify-center rounded-md bg-forest-600 px-6 py-3 text-lg font-medium text-white hover:bg-forest-700 transition-colors"
            >
              Create an account
            </Link>
            <DemoButton className="px-4 py-3 text-lg font-medium text-stone-700 dark:text-stone-200 underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:underline">
              Try the demo →
            </DemoButton>
          </div>
        </section>
      </div>
    </main>
  );
}
