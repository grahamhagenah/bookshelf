import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import CoverWall from "~/components/cover-wall";
import DemoButton from "~/components/demo-button";
import { StacksLogo } from "~/components/icons";
import { seo } from "~/seo";
import { useOptionalUser } from "~/utils";

export const meta: MetaFunction = () => seo({ path: "/" });

export default function Index() {
  const user = useOptionalUser();
  return (
    <main className={user ? "min-h-[calc(100vh-60px)]" : "min-h-screen"}>
      {user ? null : <CoverWall />}
      <section
        className={`relative flex flex-col items-center justify-center px-4 py-12 ${user ? "min-h-[calc(100vh-60px)]" : "min-h-screen"}`}
      >
        {/* Everything sits in one card over the cover wall */}
        <div className="w-full max-w-md rounded-lg border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-soft p-8 sm:p-10 text-center">
          <h1 className="flex items-center justify-center gap-2.5 text-4xl font-bold tracking-tight text-stone-800 dark:text-stone-100">
            <StacksLogo
              size={40}
              className="h-9 w-9 text-stone-900 dark:text-stone-100"
            />
            Stacks
          </h1>
          <p className="mt-3 text-lg leading-snug text-stone-600 dark:text-stone-400 text-balance">
            Keep track of the books you own, lend them to friends, and borrow
            theirs.
          </p>

          <div className="mt-8 space-y-3">
            {user ? (
              <>
                <p className="text-stone-600 dark:text-stone-400">
                  Welcome back,{" "}
                  <span className="font-semibold text-stone-800 dark:text-stone-100">
                    {user.firstname}
                  </span>
                </p>
                <Link
                  to="/books"
                  className="flex items-center justify-center w-full rounded-md bg-stone-700 dark:bg-stone-200 px-5 py-2.5 font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors"
                >
                  Go to my library
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/join"
                  className="flex items-center justify-center w-full rounded-md bg-stone-700 dark:bg-stone-200 px-5 py-2.5 font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors"
                >
                  Create an account
                </Link>
                <Link
                  to="/login"
                  className="flex items-center justify-center w-full rounded-md border border-stone-200 dark:border-stone-700 px-5 py-2.5 font-medium text-stone-700 dark:text-stone-300 hover:border-stone-400 dark:hover:bg-stone-800 transition-colors"
                >
                  Sign in
                </Link>
                <DemoButton className="w-full text-center text-stone-900 dark:text-stone-100 font-medium py-2 underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:underline">
                  Or explore a demo library first →
                </DemoButton>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
