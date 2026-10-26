import { Link, NavLink } from "@remix-run/react";

import { BookIcon, GroupIcon, GroupsIcon } from "./icons";

// The Friends page's views, side by side as My shelf's tabs are: the
// people, every book they have between them, and the groups you're in.
// Across from them, where My shelf has its share button, the way to add
// more.
export default function FriendsTabs({
  counts,
}: {
  counts: { friends: number; books: number; groups: number };
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
      <nav aria-label="Friends" className="-mb-px flex min-w-0 flex-1 gap-5 sm:gap-6 overflow-x-auto [scrollbar-width:none]">
        <NavLink to="/friends" end className={tab}>
          <GroupIcon size={16} className="hidden sm:block" />
          Friends
          <span className={count}>{counts.friends}</span>
        </NavLink>
        <NavLink to="/friends/books" className={tab}>
          <BookIcon size={16} className="hidden sm:block" />
          Books
          <span className={count}>{counts.books}</span>
        </NavLink>
        <NavLink to="/groups" className={tab}>
          <GroupsIcon size={17} className="hidden sm:block" />
          Groups
          {counts.groups > 0 ? <span className={count}>{counts.groups}</span> : null}
        </NavLink>
      </nav>
      {/* Just the + on phones, so the three tabs keep their room */}
      <Link
        to="/friends/add"
        aria-label="Add friends"
        title="Add friends"
        className="-mt-1.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors sm:w-auto sm:px-2.5"
      >
        <span aria-hidden="true" className="text-base leading-none text-stone-400 dark:text-stone-500">
          +
        </span>
        <span className="hidden sm:inline">Add friends</span>
      </Link>
    </div>
  );
}
