import { useMatches } from "@remix-run/react";

import Breadcrumbs from "./breadcrumbs";
import { PulseIcon, StacksLogo } from "./icons";
import PositionedMenu from "./menu";
import Notifications from "./notifications";
import Search from "./search";

interface RootLoaderData {
  user: {
    id: string;
  } | null;
}

export default function Header() {
  const matches = useMatches();
  const rootData = matches.find((m) => m.id === "root")?.data as
    | RootLoaderData
    | undefined;
  const user = rootData?.user;

  return (
    <header className="w-full border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 md:px-8 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <a
            id="logo"
            href={user ? "/books" : "/"}
            className="flex items-center gap-1.5 sm:gap-2 font-semibold flex-shrink-0"
          >
            <StacksLogo
              size={24}
              className="text-stone-900 dark:text-stone-100"
            />
            <span className="text-base sm:text-lg">Stacks</span>
          </a>
          <Breadcrumbs />
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {user ? <Search /> : null}
          {user ? (
            <a
              href="/feed"
              aria-label="Friend activity"
              title="Friend activity"
              className="inline-flex items-center justify-center w-9 h-9 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <PulseIcon size={20} />
            </a>
          ) : null}
          {user ? <Notifications /> : null}
          <PositionedMenu />
        </div>
      </div>
    </header>
  );
}
