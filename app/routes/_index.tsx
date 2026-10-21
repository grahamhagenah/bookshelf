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
      <section
        className={`relative flex flex-col items-center justify-center px-4 py-12 ${user ? "min-h-[calc(100vh-60px)]" : "min-h-screen"}`}
      >
        {/* One frosted card over the cover wall */}
        <div className="w-full max-w-lg rounded-xl bg-white/85 dark:bg-stone-900/85 backdrop-blur-xl ring-1 ring-stone-900/10 dark:ring-white/10 shadow-[0_24px_60px_-20px_rgb(28_25_23/0.35)] p-8 sm:p-10">
          <p className="flex items-center gap-2 text-base font-semibold text-stone-900 dark:text-stone-100">
            <StacksLogo size={22} className="text-stone-900 dark:text-stone-100" />
            Stacks
          </p>

          {user ? (
            <>
              <h1 className="mt-10 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-stone-900 dark:text-stone-50">
                Welcome back, {user.firstname}.
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-stone-600 dark:text-stone-300">
                Your shelf is right where you left it.
              </p>
              <div className="mt-8">
                <Link
                  to="/books"
                  className="inline-flex items-center justify-center rounded-md bg-stone-700 dark:bg-stone-200 px-5 py-2.5 font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors"
                >
                  Go to my library →
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-10 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-stone-900 dark:text-stone-50">
                Your bookshelf,
                <br />
                shared with friends.
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-stone-600 dark:text-stone-300">
                Keep track of the books you own, lend them to friends, and
                borrow theirs.
              </p>

              <ul className="mt-6 space-y-2 text-sm text-stone-600 dark:text-stone-300">
                {FEATURES.map(({ label, icon }) => (
                  <li key={label} className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                      <svg
                        width="13"
                        height="13"
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
                  className="inline-flex items-center justify-center rounded-md bg-stone-700 dark:bg-stone-200 px-5 py-2.5 font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors"
                >
                  Create an account
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-md bg-white/60 dark:bg-stone-800/60 ring-1 ring-inset ring-stone-300 dark:ring-stone-700 px-5 py-2.5 font-medium text-stone-800 dark:text-stone-200 hover:bg-white dark:hover:bg-stone-800 transition-colors"
                >
                  Sign in
                </Link>
              </div>
              <div className="mt-5 text-sm text-stone-500 dark:text-stone-400">
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
