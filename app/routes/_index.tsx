import type { MetaFunction } from "@remix-run/node";
import { Form, Link } from "@remix-run/react";
import { useOptionalUser } from "~/utils";
import { BookshelfIcon } from "~/components/icons";

export const meta: MetaFunction = () => [{ title: "Stacks" }];

export default function Index() {
  const user = useOptionalUser();
  return (
    <main className="min-h-[calc(100vh-60px)]">
      <section className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] px-4 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <BookshelfIcon size={64} className="text-stone-900 dark:text-stone-100" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-stone-800 dark:text-stone-100 mb-4">
            Stacks
          </h1>
          <p className="text-xl text-stone-600 dark:text-stone-400 max-w-xl mx-auto">
            Your personal lending library. Catalog your books, connect with friends, and share the joy of reading.
          </p>
        </div>

        {user ? (
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-lg border dark:border-stone-800 p-8 max-w-md w-full text-center">
            <p className="text-stone-600 dark:text-stone-400 mb-6">
              Welcome back, <span className="font-semibold text-stone-800 dark:text-stone-100">{user.firstname}</span>
            </p>
            <Link
              to="/books"
              className="inline-flex items-center justify-center w-full rounded-xl bg-stone-900 dark:bg-stone-100 px-6 py-3 text-lg font-medium text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 focus:bg-stone-700 transition-colors"
            >
              Go to my library
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-lg border dark:border-stone-800 p-8 max-w-md w-full">
            <h2 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-6 text-center">Get started</h2>
            <div className="space-y-3">
              <Link
                to="/join"
                className="flex items-center justify-center w-full rounded-xl bg-stone-900 dark:bg-stone-100 px-6 py-3 text-lg font-medium text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 focus:bg-stone-700 transition-colors"
              >
                Create an account
              </Link>
              <Link
                to="/login"
                className="flex items-center justify-center w-full rounded-xl border-2 border-stone-200 dark:border-stone-700 px-6 py-3 text-lg font-medium text-stone-700 dark:text-stone-300 hover:border-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
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
