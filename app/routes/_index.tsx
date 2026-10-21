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
        <div className="text-center mb-12">
          <h1 className="flex items-center justify-center gap-2.5 md:gap-3 text-4xl md:text-5xl font-bold tracking-tight text-stone-800 dark:text-stone-100 mb-5">
            <StacksLogo
              size={64}
              className="h-9 w-9 md:h-11 md:w-11 text-stone-900 dark:text-stone-100"
            />
            Stacks
          </h1>
          <p className="text-xl md:text-2xl leading-snug text-stone-600 dark:text-stone-400 max-w-lg mx-auto text-balance">
            Keep track of the books you own, lend them to friends, and borrow theirs.
          </p>
        </div>

        {user ? (
          <div className="bg-white dark:bg-stone-900 rounded-lg shadow-soft border border-stone-200/80 dark:border-stone-800 p-8 max-w-md w-full text-center">
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              Welcome back,{" "}
              <span className="font-semibold text-stone-800 dark:text-stone-100">
                {user.firstname}
              </span>
            </p>
            <Link
              to="/books"
              className="inline-flex items-center justify-center w-full rounded-md bg-stone-700 dark:bg-stone-200 px-5 py-2.5 font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors"
            >
              Go to my library
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-stone-900 rounded-lg shadow-soft border border-stone-200/80 dark:border-stone-800 p-8 max-w-md w-full">
            <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-6 text-center">
              Get started
            </h2>
            <div className="space-y-3">
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
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
