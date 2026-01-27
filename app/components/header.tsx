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
      <div className="flex items-center gap-3">
        <a id="logo" href={user ? "/books" : "/"} className="flex items-center gap-2 text-2xl font-semibold">
          <BookStackIcon size={32} />
          <span>Stacks</span>
        </a>
        {shareData?.ownerName && (
          <span className="text-sm text-gray-500 border-l border-gray-300 pl-3">
            {shareData.ownerName}&apos;s library
          </span>
        )}
      </div>
      <div className="flex items-center">
        {user && <Search />}
        {user && <Notifications />}
        <PositionedMenu />
      </div>
    </header>
  );
}
