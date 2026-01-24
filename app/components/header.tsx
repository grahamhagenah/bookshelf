import { useMatches } from "@remix-run/react";
import Search from "./search"
import PositionedMenu from './menu'
import Notifications from './notifications'

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
      <a id="logo" href="/books" className="text-3xl">
        📚
      </a>
      <div>
        <div className="hidden md:inline-block">
          {user && <Search />}
        </div>
        <div className="inline-block md:relative whitespace-nowrap">
          {user && <Notifications />}
          <PositionedMenu />
        </div>
      </div>
    </header>
  );
}