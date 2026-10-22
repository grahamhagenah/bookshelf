import { Form, useMatches } from "@remix-run/react";
import { useState, useRef, useEffect } from "react";

import Avatar from "./avatar";
import {
  BookIcon,
  UserIcon,
  SettingsIcon,
  GroupIcon,
  LogoutIcon,
  SearchIcon,
  DashboardIcon,
  BookmarkIcon,
} from "./icons";

interface RootLoaderData {
  user: {
    id: string;
    firstname: string;
    surname: string;
    isAdmin?: boolean;
    profileEmoji?: string | null;
  } | null;
}

export default function PositionedMenu() {
  const matches = useMatches();
  const rootData = matches.find((m) => m.id === "root")?.data as
    | RootLoaderData
    | undefined;
  const user = rootData?.user;

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={user ? "Account menu" : "Log in"}
        aria-expanded={open}
        title={user ? `${user.firstname} ${user.surname}` : "Log in"}
        // Signed in, only the avatar darkens; a full circle behind it jumped out
        className={`group inline-flex items-center justify-center w-11 h-11 md:w-9 md:h-9 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors duration-200 ${
          user ? "" : "hover:bg-stone-100 dark:hover:bg-stone-800"
        }`}
      >
        {user ? (
          <Avatar
            firstname={user.firstname}
            surname={user.surname}
            icon={user.profileEmoji}
            size="xs"
            className="transition-colors duration-200 group-hover:bg-stone-200 dark:group-hover:bg-stone-700"
          />
        ) : (
          <UserIcon size={20} />
        )}
      </button>

      {open ? (
        <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-stone-950 rounded-lg shadow-soft border border-stone-200/80 dark:border-stone-800 py-1 z-50 text-sm [&_svg]:text-stone-600 dark:[&_svg]:text-stone-300 [&_svg]:[stroke-width:1.75]">
          <a
            href="/books"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <BookIcon size={18} />
            <span>My Library</span>
          </a>
          <a
            href="/want-to-read"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <BookmarkIcon size={18} />
            <span>Want to Read</span>
          </a>
          <a
            href="/search"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <SearchIcon size={18} />
            <span>Book Search</span>
          </a>
          <a
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <SettingsIcon size={18} />
            <span>Account Settings</span>
          </a>
          <a
            href="/friends"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <GroupIcon size={18} />
            <span>Friends</span>
          </a>
          {user?.isAdmin ? (
            <a
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-stone-900 dark:text-stone-100 dark:text-stone-100"
            >
              <DashboardIcon size={18} />
              <span>Dashboard</span>
            </a>
          ) : null}
          <div className="border-t dark:border-stone-800 my-1" />
          <Form action="/logout" method="post">
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2 w-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left"
            >
              <LogoutIcon size={18} />
              <span>Logout</span>
            </button>
          </Form>
        </div>
      ) : null}
    </div>
  );
}
