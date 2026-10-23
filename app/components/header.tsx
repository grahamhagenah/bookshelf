import { NavLink, useLocation, useMatches } from "@remix-run/react";

import { BookIcon, GroupIcon, StacksLogo } from "./icons";
import PositionedMenu from "./menu";
import Notifications from "./notifications";
import Search from "./search";

interface RootLoaderData {
  user: {
    id: string;
  } | null;
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-sm transition-colors ${
    isActive
      ? "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
      : "text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800"
  }`;

export default function Header() {
  const matches = useMatches();
  const { pathname } = useLocation();
  const rootData = matches.find((m) => m.id === "root")?.data as
    | RootLoaderData
    | undefined;
  const user = rootData?.user;

  return (
    // Stays at the top while the page scrolls under it, slightly see-through
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 dark:border-stone-800 bg-white/90 dark:bg-stone-950/90 backdrop-blur-md">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 md:px-8 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <a
            id="logo"
            href="/"
            className="flex items-center gap-1.5 sm:gap-2 font-semibold flex-shrink-0"
          >
            <StacksLogo
              size={32}
              className="h-8 w-8 sm:h-9 sm:w-9 text-stone-900 dark:text-stone-100"
            />
            <span className="font-serif text-lg sm:text-xl">Stacks</span>
          </a>
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {/* Your shelf, and what your friends are up to, are what you come
              back for, so on wider screens they get labeled links of their
              own; phones keep the icons */}
          {user ? (
            <nav aria-label="Main" className="hidden md:flex items-center gap-1">
              {/* Your want-to-read list and history are tabs of your library */}
              <NavLink
                to="/books"
                end
                className={({ isActive }) =>
                  navClass({
                    isActive: isActive || pathname === "/want-to-read" || pathname === "/history",
                  })
                }
              >
                <BookIcon size={16} />
                My library
              </NavLink>
              <NavLink to="/feed" className={navClass}>
                <GroupIcon size={16} />
                Friend activity
              </NavLink>
            </nav>
          ) : null}
          {user ? <Search /> : null}
          {user ? (
            <a
              href="/feed"
              aria-label="Friend activity"
              title="Friend activity"
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <GroupIcon size={24} />
            </a>
          ) : null}
          {user ? <Notifications /> : null}
          {user ? (
            <PositionedMenu />
          ) : (
            // Signed out: the two ways in, rather than an empty menu
            <>
              <a
                href="/login"
                className="rounded-md px-3 py-1.5 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors"
              >
                Sign in
              </a>
              <a
                href="/join"
                className="rounded-md bg-forest-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-700 transition-colors"
              >
                Create account
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
