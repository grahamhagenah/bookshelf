import { useMatches } from "@remix-run/react";
import Search from "./search"
import PositionedMenu from './menu'
import Notifications from './notifications'
import { BookStackIcon } from './icons';

interface RootLoaderData {
  user: {
    id: string;
  } | null;
}

interface ShareLoaderData {
  ownerName: string;
}

interface FriendLoaderData {
  friendName: string;
}

export default function Header() {
  const matches = useMatches();
  const rootData = matches.find(m => m.id === "root")?.data as RootLoaderData | undefined;
  const user = rootData?.user;

  // Check if we're on a public share page
  const shareMatch = matches.find(m => m.id === "routes/share.$token");
  const shareData = shareMatch?.data as ShareLoaderData | undefined;

  // Check if we're on a friend's library page
  const friendMatch = matches.find(m => m.id === "routes/friend.$friendId");
  const friendData = friendMatch?.data as FriendLoaderData | undefined;

  // Get the library owner's name (from either share or friend page)
  const libraryOwnerName = shareData?.ownerName || friendData?.friendName;

  return (
    <header className="w-full flex items-center justify-between shadow-sm px-4 md:px-8 py-2 bg-white dark:bg-gray-950 dark:shadow-gray-900">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <a id="logo" href={user ? "/books" : "/"} className="flex items-center gap-2 text-2xl font-semibold flex-shrink-0 group">
          <span className="transition-transform duration-200 group-hover:rotate-[-8deg]">
            <BookStackIcon size={32} />
          </span>
          <span className="hidden sm:inline">Stacks</span>
        </a>
        {libraryOwnerName && (
          <span className="hidden sm:inline text-sm text-gray-500 dark:text-gray-400 border-l border-gray-300 dark:border-gray-600 pl-3 truncate">
            {libraryOwnerName}&apos;s library
          </span>
        )}
      </div>
      <div className="flex items-center flex-shrink-0">
        {user && <div className="hidden sm:block"><Search /></div>}
        {user && <Notifications />}
        <PositionedMenu />
      </div>
    </header>
  );
}
