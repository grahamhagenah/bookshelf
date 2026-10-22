import { Link } from "@remix-run/react";

import DemoButton from "./demo-button";
import Showcase, {
  ShowcaseFriends,
  ShowcaseNotes,
  ShowcaseShare,
} from "./showcase";

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
            Keep track of the books you own, lend them to friends, and borrow
            theirs.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/join"
              className="inline-flex items-center justify-center rounded-md bg-forest-600 dark:bg-forest-500 px-6 py-3 text-lg font-medium text-white hover:bg-forest-700 dark:hover:bg-forest-400 transition-colors"
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
          with a tap. Anything nobody has yet, you can add to your own shelf.
        </Feature>

        <Feature
          eyebrow="Notes"
          title="Every copy carries its story"
          visual={<ShowcaseNotes />}
          flip
        >
          Leave a heart or a line for the next reader. Notes stay with the book
          as it moves between friends, so you can see where it&apos;s been and
          what everyone thought.
        </Feature>

        <Feature
          eyebrow="Share"
          title="Share your shelf with anyone"
          visual={<ShowcaseShare />}
        >
          Make a link to your library that anyone can browse, no account
          needed. It looks good in a text, and friends can join to borrow from
          you.
        </Feature>

        {/* One last nudge */}
        <section className="border-t border-stone-200 dark:border-stone-800 pt-16 text-center md:pt-20">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
            Start your shelf
          </h2>
          <p className="mt-3 text-lg text-stone-600 dark:text-stone-300">
            It&apos;s free, and takes a minute.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/join"
              className="inline-flex items-center justify-center rounded-md bg-forest-600 dark:bg-forest-500 px-6 py-3 text-lg font-medium text-white hover:bg-forest-700 dark:hover:bg-forest-400 transition-colors"
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
