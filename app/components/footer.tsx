import { Form, Link, useMatches } from "@remix-run/react";

import { BookshelfIcon } from "./icons";

interface RootLoaderData {
  user: { id: string } | null;
}

const linkClass = "hover:text-stone-900 dark:hover:text-stone-100 transition-colors";

export default function Footer() {
  const matches = useMatches();
  const rootData = matches.find((m) => m.id === "root")?.data as RootLoaderData | undefined;
  const user = rootData?.user;

  return (
    <footer className="mt-16 border-t border-stone-200 dark:border-stone-800 text-sm text-stone-500 dark:text-stone-400">
      <div className="mx-auto max-w-4xl px-4 md:px-8 py-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 max-w-xs">
          <Link to={user ? "/books" : "/"} className="inline-flex items-center gap-2 font-semibold text-stone-900 dark:text-stone-100">
            <BookshelfIcon size={20} className="text-accent-600 dark:text-accent-400" />
            Stacks
          </Link>
          <p>A lending library for the books you own.</p>
        </div>

        <nav aria-label="Footer" className="flex gap-12">
          <ul className="space-y-2">
            {user ? (
              <>
                <li><Link to="/books" className={linkClass}>My library</Link></li>
                <li><Link to="/search" className={linkClass}>Add books</Link></li>
                <li><Link to="/friends" className={linkClass}>Friends</Link></li>
                <li><Link to="/account" className={linkClass}>Account</Link></li>
              </>
            ) : (
              <>
                <li>
                  <Form action="/demo" method="post">
                    <button type="submit" name="intent" value="start" className={linkClass}>Try the demo</button>
                  </Form>
                </li>
                <li><Link to="/join" className={linkClass}>Create an account</Link></li>
                <li><Link to="/login" className={linkClass}>Sign in</Link></li>
              </>
            )}
          </ul>
          <ul className="space-y-2">
            <li>
              <a href="https://openlibrary.org" target="_blank" rel="noreferrer" className={linkClass}>Open Library</a>
            </li>
            <li>
              <a href="https://github.com/grahamhagenah/bookshelf" target="_blank" rel="noreferrer" className={linkClass}>Source code</a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="mx-auto max-w-4xl px-4 md:px-8 pb-8 flex flex-col gap-1 sm:flex-row sm:justify-between text-xs text-stone-400 dark:text-stone-500">
        <p>© {new Date().getFullYear()} Stacks</p>
        <p>Book data and covers courtesy of Open Library.</p>
      </div>
    </footer>
  );
}
