import { BookIcon, BookmarkIcon, HistoryIcon, ReadIcon } from "./icons";
import ShareShelfButton from "./share-shelf-button";
import SharedWith from "./shared-with";
import type { Member } from "./shared-with";
import Tabs from "./tabs";

// Your lists of books, side by side at the top of each: the books you
// have, the ones you'd like to, the ones you read somewhere else, and the
// ones that have passed between you and your friends. Across from them, the link to show your shelf off.
export default function ShelfTabs({
  counts,
  sharedWith,
}: {
  counts: { library: number; want: number; elsewhere: number; history: number };
  // On your library, when it's a shelf you share
  sharedWith?: { members: Member[]; viewerId: string } | null;
}) {
  return (
    <Tabs
      label="Your books"
      tabs={[
        {
          to: "/books",
          end: true,
          label: "My shelf",
          icon: <BookIcon size={16} className="hidden sm:block" />,
          count: counts.library,
        },
        {
          to: "/want-to-read",
          label: "Want to read",
          icon: <BookmarkIcon size={16} className="hidden sm:block" />,
          count: counts.want,
        },
        {
          to: "/read-elsewhere",
          label: "Read elsewhere",
          icon: <ReadIcon size={16} className="hidden sm:block" />,
          count: counts.elsewhere,
        },
        {
          to: "/history",
          label: "History",
          icon: <HistoryIcon size={16} className="hidden sm:block" />,
          count: counts.history,
        },
      ]}
    >
      {/* Phones have no room beside the tabs; the library's filter row
          carries it there */}
      <div className="-mt-1.5 hidden items-center gap-2 sm:flex">
        {sharedWith ? <SharedWith {...sharedWith} /> : null}
        <ShareShelfButton />
      </div>
    </Tabs>
  );
}
