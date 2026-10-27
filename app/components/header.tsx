import { Link, NavLink, useLocation, useMatches } from "react-router";

import { BookIcon, FeedIcon, GroupIcon } from "./icons";
import PositionedMenu from "./menu";
import Notifications from "./notifications";
import Search from "./search";
import { primaryButton } from "./ui";
import Wordmark from "./wordmark";

interface RootLoaderData {
  user: {
    id: string;
  } | null;
}

// A nav link's name: read out always, shown once the header has room
const label = "sr-only lg:not-sr-only";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[15px] transition-colors ${
    isActive
      ? "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
      : "text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800"
  }`;

export default function Header() {
  const matches = useMatches();
  const { pathname } = useLocation();
  const rootData = matches.find((m) => m.id === "root")?.loaderData as
    | RootLoaderData
    | undefined;
  const user = rootData?.user;
  // The signed-out front page, where a word on what Stacks is helps
  const landing = !user && pathname === "/";

  return (
    // Stays at the top while the page scrolls under it. See-through in
    // light mode only: Safari 26 tints the strip behind the status bar
    // from a sticky element at the top edge, and falls back to white for
    // a translucent, blurred one, which in dark mode put a white bar
    // across the top of the phone. Dark mode keeps it solid.
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 dark:border-stone-800 bg-white/90 backdrop-blur dark:bg-stone-950 dark:backdrop-blur-none">
      <div className="mx-auto max-w-[var(--page-max,64rem)] flex items-center justify-between px-4 md:px-8 py-1.5">
        <div className="flex flex-1 items-center gap-2 md:gap-5 lg:gap-6 min-w-0">
          <Link
            to="/"
            className="flex items-center gap-1.5 sm:gap-2 font-semibold flex-shrink-0"
          >
            <Wordmark className="text-2xl sm:text-[1.75rem] leading-none text-stone-900 dark:text-stone-100" />
          </Link>
          {landing ? (
            <p className="hidden md:block ml-1 border-l border-stone-200 dark:border-stone-800 pl-3 text-sm text-stone-400 dark:text-stone-500">
              Lend and borrow books with friends
            </p>
          ) : null}
          {/* The way to find and add books, so first after the wordmark */}
          {user ? <Search as="box" /> : null}
        </div>
        <div className="ml-4 flex items-center gap-1 md:gap-2 flex-shrink-0">
          {/* Your shelf, and what your friends are up to, are what you come
              back for, so on wider screens they get labeled links of their
              own; phones keep the icons */}
          {user ? (
            // Icons alone until there's room for the names beside them
            <nav
              aria-label="Main"
              className="hidden md:flex items-center gap-1"
            >
              {/* Your want-to-read list and history are tabs of your library */}
              <NavLink
                title="My shelf"
                to="/books"
                end
                className={({ isActive }) =>
                  navClass({
                    isActive:
                      isActive ||
                      ["/want-to-read", "/read-elsewhere", "/history"].includes(
                        pathname,
                      ),
                  })
                }
              >
                <BookIcon size={16} />
                <span className={label}>My shelf</span>
              </NavLink>
              <NavLink title="Feed" to="/feed" className={navClass}>
                <FeedIcon size={16} strokeWidth={1.5} />
                <span className={label}>Feed</span>
              </NavLink>
              {/* Friends, their books and your groups, and a friend's own page */}
              <NavLink
                title="Friends"
                to="/friends"
                className={({ isActive }) =>
                  navClass({
                    isActive:
                      isActive ||
                      pathname.startsWith("/friend/") ||
                      pathname.startsWith("/groups"),
                  })
                }
              >
                <GroupIcon size={16} />
                <span className={label}>Friends</span>
              </NavLink>
            </nav>
          ) : null}
          {user ? <Search as="icon" /> : null}
          {user ? (
            <Link
              to="/feed"
              aria-label="Feed"
              title="Feed"
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              <FeedIcon size={24} />
            </Link>
          ) : null}
          {user ? <Notifications /> : null}
          {user ? (
            <PositionedMenu />
          ) : (
            // Signed out: the two ways in, rather than an empty menu
            <>
              <Link
                to="/login"
                className="rounded-md px-3 py-1.5 text-[15px] text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link to="/join" className={primaryButton("md")}>
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
