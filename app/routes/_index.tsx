import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import CoverWall from "~/components/cover-wall";
import DemoButton from "~/components/demo-button";
import { StacksLogo } from "~/components/icons";
import { seo } from "~/seo";
import { useOptionalUser } from "~/utils";

export const meta: MetaFunction = () => seo({ path: "/" });

const FEATURES = [
  {
    label: "Catalog the books on your shelf",
    icon: <path d="M4 19.5V5a2 2 0 012-2h13v15H6a2 2 0 00-2 2v.5A1.5 1.5 0 005.5 22H19" />,
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

export default function Index() {
  const user = useOptionalUser();
  return (
    <main className={user ? "min-h-[calc(100vh-60px)]" : "min-h-screen"}>
      {user ? null : <CoverWall />}
      {user ? null : (
        // Fade the wall to white behind the text, leaving the covers clear
        // on the right
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b sm:bg-gradient-to-r from-white sm:from-40% via-white/90 sm:via-white/80 sm:via-60% to-white/40 sm:to-transparent dark:from-stone-950 dark:via-stone-950/90 dark:to-transparent"
        />
      )}
      <section
        className={`relative flex flex-col justify-center px-4 md:px-8 py-16 ${user ? "min-h-[calc(100vh-60px)] items-center" : "min-h-screen"}`}
      >
        {/* Content sits on the page itself, no card */}
        <div className="w-full max-w-xl">
          <p className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            <StacksLogo size={32} className="text-stone-900 dark:text-stone-100" />
            Stacks
          </p>

          {user ? (
            <>
              <h1 className="mt-10 text-5xl sm:text-6xl font-bold tracking-tight leading-[1.02] text-stone-900 dark:text-stone-50">
                Welcome back, {user.firstname}.
              </h1>
              <p className="mt-5 text-xl sm:text-2xl leading-snug text-stone-600 dark:text-stone-300">
                Your shelf is right where you left it.
              </p>
              <div className="mt-8">
                <Link
                  to="/books"
                  className="inline-flex items-center justify-center rounded-md bg-stone-700 dark:bg-stone-200 px-6 py-3 text-lg font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors"
                >
                  Go to my library →
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-10 text-5xl sm:text-6xl font-bold tracking-tight leading-[1.02] text-stone-900 dark:text-stone-50">
                Your bookshelf,
                <br />
                shared with friends.
              </h1>
              <p className="mt-5 text-xl sm:text-2xl leading-snug text-stone-600 dark:text-stone-300">
                Keep track of the books you own, lend them to friends, and
                borrow theirs.
              </p>

              <ul className="mt-7 space-y-3 text-base sm:text-lg text-stone-600 dark:text-stone-300">
                {FEATURES.map(({ label, icon }) => (
                  <li key={label} className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {icon}
                      </svg>
                    </span>
                    {label}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/join"
                  className="inline-flex items-center justify-center rounded-md bg-stone-700 dark:bg-stone-200 px-6 py-3 text-lg font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors"
                >
                  Create an account
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-md bg-white/60 dark:bg-stone-800/60 ring-1 ring-inset ring-stone-300 dark:ring-stone-700 px-6 py-3 text-lg font-medium text-stone-800 dark:text-stone-200 hover:bg-white dark:hover:bg-stone-800 transition-colors"
                >
                  Sign in
                </Link>
              </div>
              <div className="mt-6 text-base text-stone-500 dark:text-stone-400">
                <DemoButton className="text-stone-700 dark:text-stone-200 font-medium underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:underline">
                  Or look around a demo library first →
                </DemoButton>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
