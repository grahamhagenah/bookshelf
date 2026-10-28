
import { Link } from "react-router";

import Tabs from "./tabs";

// The Friends page's views, side by side as My shelf's tabs are: the
// people, every book they have between them, and the groups you're in.
// Across from them, where My shelf has its share button, the way to add
// more.
export default function FriendsTabs({
  counts,
}: {
  counts: { friends: number; books: number; groups: number };
}) {
  return (
    <Tabs
      label="Friends"
      tabs={[
        {
          to: "/friends",
          end: true,
          label: "Friends",
          count: counts.friends,
        },
        {
          to: "/friends/books",
          label: "Books",
          count: counts.books,
        },
        {
          to: "/groups",
          label: "Groups",
          count: counts.groups,
        },
      ]}
    >
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
    </Tabs>
  );
}
