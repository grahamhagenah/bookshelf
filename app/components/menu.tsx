import { Form, useLocation, useMatches } from "@remix-run/react";
import { useState, useRef, useEffect } from "react";

import Avatar from "./avatar";
import {
  BookIcon,
  UserIcon,
  SettingsIcon,
  GroupIcon,
  LogoutIcon,
  DashboardIcon,
  BookmarkIcon,
} from "./icons";

interface RootLoaderData {
  user: {
    id: string;
    firstname: string;
    surname: string;
    email: string;
    demoGroup?: string | null;
    isAdmin?: boolean;
    profileEmoji?: string | null;
  } | null;
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

const item =
  "flex items-center gap-3 px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors";

export default function PositionedMenu() {
  const matches = useMatches();
  const rootData = matches.find((m) => m.id === "root")?.data as
    | RootLoaderData
    | undefined;
  const user = rootData?.user;

  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
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
          {user ? (
            <div className="px-3 pt-1.5 pb-2 mb-1 border-b dark:border-stone-800">
              <p className="truncate font-medium text-stone-900 dark:text-stone-100">
                {user.firstname} {user.surname}
              </p>
              <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                {user.demoGroup ? "Demo account" : user.email}
              </p>
            </div>
          ) : null}
          {/* The header has its own link on wider screens */}
          <a href="/books" onClick={() => setOpen(false)} className={`md:hidden ${item}`}>
            <BookIcon size={18} />
            <span>My library</span>
          </a>
          <a href="/friends" onClick={() => setOpen(false)} className={item}>
            <GroupIcon size={18} />
            <span>Friends</span>
          </a>
          <a href="/want-to-read" onClick={() => setOpen(false)} className={item}>
            <BookmarkIcon size={18} />
            <span>Want to read</span>
          </a>
          <a href="/account" onClick={() => setOpen(false)} className={item}>
            <SettingsIcon size={18} />
            <span>Settings</span>
          </a>
          {user?.isAdmin ? (
            <a href="/dashboard" onClick={() => setOpen(false)} className={item}>
              <DashboardIcon size={18} />
              <span>Admin</span>
            </a>
          ) : null}
          <a
            href={`/feedback?from=${encodeURIComponent(pathname)}`}
            onClick={() => setOpen(false)}
            className={item}
          >
            <PencilIcon />
            <span>Send feedback</span>
          </a>
          <div className="border-t dark:border-stone-800 my-1" />
          <Form action="/logout" method="post">
            <button
              type="submit"
              className={`w-full text-left ${item}`}
            >
              <LogoutIcon size={18} />
              <span>Sign out</span>
            </button>
          </Form>
        </div>
      ) : null}
    </div>
  );
}
