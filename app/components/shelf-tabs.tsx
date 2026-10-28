import { Link } from "react-router";

import ShareShelfButton from "./share-shelf-button";
import SharedWith from "./shared-with";
import type { Member } from "./shared-with";
import Tabs from "./tabs";

// Your lists of books, side by side at the top of each: the books you
// have, the ones you'd like to, the ones you read somewhere else, and the
// ones that have passed between you and your friends. Across from them, the link to show your shelf off.
export const addButton =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";

// The list's one way to add to it: "+ Add a book"
export function AddLink({ to, children, className = "" }: { to: string; children: string; className?: string }) {
  return (
    <Link to={to} className={`${addButton} ${className}`}>
      <span aria-hidden="true" className="text-base leading-none text-stone-400 dark:text-stone-500">
        +
      </span>
      {children}
    </Link>
  );
}

export default function ShelfTabs({
  counts,
  sharedWith,
  add,
}: {
  counts: { library: number; want: number; elsewhere: number; history: number };
  // On your library, when it's a shelf you share
  sharedWith?: { members: Member[]; viewerId: string } | null;
  // The list's own way to add to it, beside the tabs rather than on a row
  // of its own
  add?: { to: string; label: string };
}) {
  return (
    <Tabs
      label="Your books"
      tabs={[
        {
          to: "/books",
          end: true,
          label: "Shelf",
          count: counts.library,
        },
        {
          to: "/want-to-read",
          label: "Want to read",
          count: counts.want,
        },
        {
          to: "/read-elsewhere",
          label: "Also read",
          count: counts.elsewhere,
        },
        {
          to: "/history",
          label: "History",
          count: counts.history,
        },
      ]}
    >
      {/* Phones have no room beside the tabs; the library's filter row
          carries it there */}
      <div className="-mt-1.5 hidden items-center gap-2 sm:flex">
        {sharedWith ? <SharedWith {...sharedWith} /> : null}
        {add ? <AddLink to={add.to}>{add.label}</AddLink> : null}
        {counts.library > 0 ? <ShareShelfButton /> : null}
      </div>
    </Tabs>
  );
}
