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

export default function Header() {
  const matches = useMatches();
  const rootData = matches.find(m => m.id === "root")?.data as RootLoaderData | undefined;
  const user = rootData?.user;

  // Check if we're on a public share page
  const shareMatch = matches.find(m => m.id === "routes/share.$token");
  const shareData = shareMatch?.data as ShareLoaderData | undefined;

  return (
    <header className="w-full flex items-center justify-between shadow-sm px-4 md:px-8 py-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <a id="logo" href={user ? "/books" : "/"} className="flex items-center gap-2 text-2xl font-semibold flex-shrink-0">
          <BookStackIcon size={32} />
          <span className="hidden sm:inline">Stacks</span>
        </a>
        {shareData?.ownerName && (
          <span className="text-xs sm:text-sm text-gray-500 sm:border-l sm:border-gray-300 sm:pl-3 truncate">
            <span className="sm:hidden">{shareData.ownerName}</span>
            <span className="hidden sm:inline">{shareData.ownerName}&apos;s library</span>
          </span>
        )}
      </div>
      <div className="flex items-center flex-shrink-0">
        {user && <Search />}
        {user && <Notifications />}
        <PositionedMenu />
      </div>
    </header>
  );
}
