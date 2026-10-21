import { Link } from "@remix-run/react";

import DemoButton from "./demo-button";
import Showcase from "./showcase";

// The signed-out home page: what Stacks is, beside a small, staged glimpse
// of the app itself, so people see what they're signing up for

const FEATURES = [
  {
    label: "Catalog the books on your shelf",
    icon: (
      <path d="M4 19.5V5a2 2 0 012-2h13v15H6a2 2 0 00-2 2v.5A1.5 1.5 0 005.5 22H19" />
    ),
  },
  {
    label: "Lend them out and see who has what",
    icon: (
      <>
        <path d="M17 3l4 4-4 4" />
        <path d="M21 7H9" />
        <path d="M7 21l-4-4 4-4" />
        <path d="M3 17h12" />
      </>
    ),
  },
  {
    label: "Borrow from your friends' shelves",
    icon: (
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
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
            Keep track of the books you own, lend them to friends, and borrow
            theirs.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/join"
              className="inline-flex items-center justify-center rounded-md bg-stone-700 dark:bg-stone-200 px-6 py-3 text-lg font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors"
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

      <ul className="mt-16 grid gap-6 border-t border-stone-200 dark:border-stone-800 pt-8 text-stone-600 dark:text-stone-300 sm:grid-cols-3 md:mt-24">
        {FEATURES.map(({ label, icon }) => (
          <li key={label} className="flex items-center gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="flex-shrink-0 text-stone-500 dark:text-stone-400"
            >
              {icon}
            </svg>
            {label}
          </li>
        ))}
      </ul>
    </main>
  );
}
