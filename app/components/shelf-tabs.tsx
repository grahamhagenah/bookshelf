import { NavLink } from "@remix-run/react";

import { BookIcon, BookmarkIcon, HistoryIcon } from "./icons";
import ShareShelfButton from "./share-shelf-button";
import SharedWith from "./shared-with";
import type { Member } from "./shared-with";

// Your lists of books, side by side at the top of each: the books you
// have, the ones you'd like to, and the ones that have passed between you
// and your friends. Across from them, the link to show your shelf off.
export default function ShelfTabs({
  counts,
  sharedWith,
}: {
  counts: { library: number; want: number; history: number };
  // On your library, when it's a shelf you share
  sharedWith?: { members: Member[]; viewerId: string } | null;
}) {
  // The same weight either way, so switching tabs never nudges the other
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 whitespace-nowrap border-b-2 px-1 pb-2.5 font-medium transition-colors ${
      isActive
        ? "border-stone-900 dark:border-stone-100 text-stone-900 dark:text-stone-100"
        : "border-transparent text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600 hover:text-stone-800 dark:hover:text-stone-200"
    }`;
  const count = "font-normal text-stone-400 dark:text-stone-500";

  return (
    <div className="mb-6 flex items-start gap-3 border-b border-stone-200 dark:border-stone-800">
      <nav
        aria-label="Your books"
        // Down over the rule, so the current tab's underline covers it
        className="-mb-px flex min-w-0 flex-1 gap-5 sm:gap-6 overflow-x-auto [scrollbar-width:none]"
      >
        <NavLink to="/books" end className={tab}>
          <BookIcon size={16} className="hidden sm:block" />
          My shelf
          <span className={count}>{counts.library}</span>
        </NavLink>
        <NavLink to="/want-to-read" className={tab}>
          <BookmarkIcon size={16} className="hidden sm:block" />
          Want to read
          <span className={count}>{counts.want}</span>
        </NavLink>
        <NavLink to="/history" className={tab}>
          <HistoryIcon size={16} className="hidden sm:block" />
          History
          <span className={count}>{counts.history}</span>
        </NavLink>
      </nav>
      {/* Phones have no room beside the tabs; the library's filter row
          carries it there */}
      <div className="-mt-1.5 hidden items-center gap-2 sm:flex">
        {sharedWith ? <SharedWith {...sharedWith} /> : null}
        <ShareShelfButton />
      </div>
    </div>
  );
}
