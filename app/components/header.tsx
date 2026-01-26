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

export default function Header() {
  const matches = useMatches();
  const rootData = matches.find(m => m.id === "root")?.data as RootLoaderData | undefined;
  const user = rootData?.user;

  return (
    <header className="w-full flex items-center justify-between shadow-sm px-4 md:px-8 py-2">
      <a id="logo" href="/books" className="flex items-center gap-2 text-2xl font-semibold">
        <BookStackIcon size={32} />
        <span>Stacks</span>
      </a>
      <div className="flex items-center">
        {user && <Search />}
        {user && <Notifications />}
        <PositionedMenu />
      </div>
    </header>
  );
}
