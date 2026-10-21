import type { MetaFunction } from "@remix-run/node";
import { Form, Link } from "@remix-run/react";

import CoverWall from "~/components/cover-wall";
import { StacksLogo } from "~/components/icons";
import { useOptionalUser } from "~/utils";

export const meta: MetaFunction = () => [{ title: "Stacks" }];

export default function Index() {
  const user = useOptionalUser();
  return (
    <main className={user ? "min-h-[calc(100vh-60px)]" : "min-h-screen"}>
      {user ? null : <CoverWall />}
      <section
        className={`relative flex flex-col items-center justify-center px-4 py-12 ${user ? "min-h-[calc(100vh-60px)]" : "min-h-screen"}`}
      >
        <div className="text-center mb-12">
          <h1 className="flex items-center justify-center gap-3 md:gap-5 text-5xl md:text-7xl font-bold text-stone-800 dark:text-stone-100 mb-4">
            <StacksLogo
              size={64}
              className="h-12 w-12 md:h-16 md:w-16 text-stone-900 dark:text-stone-100"
            />
            Stacks
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400 max-w-md mx-auto text-balance">
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
              className="inline-flex items-center justify-center w-full rounded-md bg-stone-900 dark:bg-stone-100 px-5 py-2.5 font-medium text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
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
                className="flex items-center justify-center w-full rounded-md bg-stone-900 dark:bg-stone-100 px-5 py-2.5 font-medium text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
              >
                Create an account
              </Link>
              <Link
                to="/login"
                className="flex items-center justify-center w-full rounded-md border border-stone-200 dark:border-stone-700 px-5 py-2.5 font-medium text-stone-700 dark:text-stone-300 hover:border-stone-400 dark:hover:bg-stone-800 transition-colors"
              >
                Sign in
              </Link>
              <Form action="/demo" method="post">
                <button
                  type="submit"
                  name="intent"
                  value="start"
                  className="w-full text-center text-stone-900 dark:text-stone-100 dark:text-stone-100 hover:text-stone-900 dark:hover:text-white font-medium py-2"
                >
                  Or explore a demo library first →
                </button>
              </Form>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
