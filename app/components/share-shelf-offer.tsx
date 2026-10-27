import { Link } from "react-router";

import { FREE_LIMITS } from "~/plan";

// Where the invite to share a shelf is made, in Settings
export const SHARE_SHELF_PATH = "/account#share-a-shelf";

// For someone not sharing a shelf yet, at the moments it's worth knowing
// about: setting up, and just after bringing their books in
export default function ShareShelfOffer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-stone-500 dark:text-stone-400 ${className}`}>
      Share books with someone at home?{" "}
      <Link
        to={SHARE_SHELF_PATH}
        className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2"
      >
        Share a shelf
      </Link>{" "}
      and you both see and lend all of it, with room for{" "}
      {FREE_LIMITS.sharedBooks} books free.
    </p>
  );
}
