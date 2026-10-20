import { useMatches } from "@remix-run/react";
import Search from "./search"
import PositionedMenu from './menu'
import Notifications from './notifications'
import FriendsDropdown from './friends-dropdown'
import { BookshelfIcon } from './icons';
import Breadcrumbs from './breadcrumbs';

interface RootLoaderData {
  user: {
    id: string;
  } | null;
}

export default function Header() {
  const matches = useMatches();
  const rootData = matches.find(m => m.id === "root")?.data as RootLoaderData | undefined;
  const user = rootData?.user;

  return (
    <header className="w-full border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950">
      <div className="mx-auto max-w-4xl flex items-center justify-between px-4 md:px-8 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <a id="logo" href={user ? "/books" : "/"} className="flex items-center gap-1.5 sm:gap-2 font-semibold flex-shrink-0 group">
          <span className="transition-transform duration-200 group-hover:rotate-[-8deg]">
            <BookshelfIcon size={28} className="text-accent-600 dark:text-accent-400" />
          </span>
          <span className="text-lg sm:text-xl">Stacks</span>
        </a>
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {user && <div className="hidden sm:block"><Search /></div>}
        {user && <Notifications />}
        {user && <FriendsDropdown />}
        <PositionedMenu />
      </div>
      </div>
    </header>
  );
}
