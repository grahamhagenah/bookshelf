import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { useOptionalUser } from "~/utils";

export const meta: MetaFunction = () => [{ title: "Lend Books" }];

export default function Index() {
  const user = useOptionalUser();
  return (
    <main className="flex flex-col justify-center h-4/6">
      <section>
      <h1 className="text-center text-6xl font-extrabold tracking-tight sm:text-8xl lg:text-9xl">
        Lend
      </h1>
      <p className="mx-auto mt-6 max-w-lg text-center text-xl text-white sm:max-w-3xl">
        Represent your library digitally, and let your friends borrow your books.
      </p>
      <div className="mx-auto mt-10 max-w-sm sm:flex sm:max-w-none sm:justify-center">
        {user ? (
          <Link
            to="/books"
            className="flex items-center justify-center rounded-md border border-transparent bg-white px-4 py-3 text-base font-medium text-black-700 shadow-sm hover:bg-black-50 sm:px-8"
          >
            View Books for {user.email}
          </Link>
        ) : (
          <div className="space-y-4 sm:mx-auto sm:inline-grid sm:grid-cols-2 sm:gap-5 sm:space-y-0">
            <Link
              to="/join"
              className="flex items-center justify-center rounded-md border bg-white px-4 py-3 text-base font-medium text-black-700 shadow-sm hover:bg-black-50 sm:px-8"
            >
              Sign up
            </Link>
            <Link
              to="/login"
              className="flex items-center justify-center rounded-md bg-blue-500 px-4 py-3 font-medium text-white hover:bg-black-600"
            >
              Log In
            </Link>
          </div>
        )}
      </div>
      </section>
    </main>
  );
}
