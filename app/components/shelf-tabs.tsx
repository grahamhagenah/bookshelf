import { NavLink } from "@remix-run/react";

import { BookIcon, BookmarkIcon } from "./icons";

// Your two lists of books, side by side at the top of each: the books you
// have, and the ones you'd like to
export default function ShelfTabs({
  libraryCount,
  wantCount,
}: {
  libraryCount: number;
  wantCount: number;
}) {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-1 pb-2.5 transition-colors ${
      isActive
        ? "border-stone-900 dark:border-stone-100 font-semibold text-stone-900 dark:text-stone-100"
        : "border-transparent text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600 hover:text-stone-800 dark:hover:text-stone-200"
    }`;
  const count = "font-normal text-stone-400 dark:text-stone-500";

  return (
    <nav
      aria-label="Your books"
      className="mb-6 flex gap-6 border-b border-stone-200 dark:border-stone-800"
    >
      <NavLink to="/books" end className={tab}>
        <BookIcon size={16} />
        My library
        <span className={count}>{libraryCount}</span>
      </NavLink>
      <NavLink to="/want-to-read" className={tab}>
        <BookmarkIcon size={16} />
        Want to read
        <span className={count}>{wantCount}</span>
      </NavLink>
    </nav>
  );
}
