import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { useOptionalUser } from "~/utils";

export const meta: MetaFunction = () => [{ title: "Lend Books" }];

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export default function Index() {
  const user = useOptionalUser();
  return (
    <main className="flex flex-col justify-center h-4/6">
      <section>
      <h1 className="text-center text-6xl font-extrabold tracking-tight sm:text-8xl lg:text-9xl">
        Lend
      </h1>
      <p className="mx-auto text-center mt-6 mb-24 max-w-lg text-left text-black text-xl text-white sm:max-w-3xl">
        Represent your library digitally, and let your friends borrow your books.
      </p>
      <div className="mt-10 max-w-sm sm:flex sm:max-w-none sm:justify-center">
        {user ? (
          <Link
            to="/books"
            className="flex items-left justify-center rounded border bg-white px-4 py-3 text-base font-medium text-black-700 shadow-sm hover:bg-black-50 sm:px-8 hover:bg-slate-50 focus:bg-slate-100"
          >
            View Books for {user.firstname}
          </Link>
        ) : (
          <div className="space-y-4 sm:mx-auto sm:inline-grid sm:grid-cols-2 sm:gap-5 sm:space-y-0">
            <Link
              to="/join"
              className="flex items-center justify-center rounded border bg-white px-4 py-3 text-base font-medium text-black-700 shadow-sm hover:bg-black-50 sm:px-8 hover:bg-slate-50 focus:bg-slate-100"
            >
              Sign up
            </Link>
            <Link
              to="/login"
              className="flex items-center justify-center rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
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
