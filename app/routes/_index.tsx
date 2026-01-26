import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { useOptionalUser } from "~/utils";
import { BookStackIcon } from "~/components/icons";

export const meta: MetaFunction = () => [{ title: "Stacks" }];

export const handle = {
  breadcrumb: () => <Link to="/">Home</Link>,
};

export default function Index() {
  const user = useOptionalUser();
  return (
    <main className="min-h-[calc(100vh-60px)]">
      <section className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] px-4 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <BookStackIcon size={64} className="text-blue-600" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-gray-800 mb-4">
            Stacks
          </h1>
          <p className="text-xl text-gray-600 max-w-xl mx-auto">
            Your personal lending library. Catalog your books, connect with friends, and share the joy of reading.
          </p>
        </div>

        {user ? (
          <div className="bg-white rounded-2xl shadow-lg border p-8 max-w-md w-full text-center">
            <p className="text-gray-600 mb-6">
              Welcome back, <span className="font-semibold text-gray-800">{user.firstname}</span>
            </p>
            <Link
              to="/books"
              className="inline-flex items-center justify-center w-full rounded-xl bg-blue-500 px-6 py-3 text-lg font-medium text-white hover:bg-blue-600 focus:bg-blue-400 transition-colors"
            >
              Go to my library
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border p-8 max-w-md w-full">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">Get started</h2>
            <div className="space-y-3">
              <Link
                to="/join"
                className="flex items-center justify-center w-full rounded-xl bg-blue-500 px-6 py-3 text-lg font-medium text-white hover:bg-blue-600 focus:bg-blue-400 transition-colors"
              >
                Create an account
              </Link>
              <Link
                to="/login"
                className="flex items-center justify-center w-full rounded-xl border-2 border-gray-200 px-6 py-3 text-lg font-medium text-gray-700 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
