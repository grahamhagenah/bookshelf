import { Form, Link, useLocation, useMatches } from "@remix-run/react";
import { useState, useRef, useEffect } from "react";

import Avatar from "./avatar";
import {
  BookIcon,
  UserIcon,
  SettingsIcon,
  GroupIcon,
  GroupsIcon,
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

// Roomier rows on phones, where they're tapped
const item =
  "flex items-center gap-3.5 px-4 py-3 md:gap-3 md:px-3 md:py-2 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors";

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
        // Signed in, the avatar gets a ring in its own color; a full circle behind it jumped out
        className={`group inline-flex items-center justify-center w-11 h-11 md:w-9 md:h-9 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors duration-200 ${
          user ? "" : "hover:bg-stone-100 dark:hover:bg-stone-800"
        }`}
      >
        {user ? (
          <Avatar
            firstname={user.firstname}
            surname={user.surname}
            icon={user.profileEmoji}
            size="sm"
            className="ring-2 ring-transparent group-hover:ring-current/25 group-focus-visible:ring-current/40"
          />
        ) : (
          <UserIcon size={20} />
        )}
      </button>

      {open ? (
        // On phones: wider, with larger text and icons
        <div className="absolute right-0 mt-1 w-72 md:w-52 bg-white dark:bg-stone-950 rounded-xl md:rounded-lg shadow-soft border border-stone-200/80 dark:border-stone-800 py-1.5 md:py-1 z-50 text-base md:text-sm [&_svg]:size-[22px] md:[&_svg]:size-[18px] [&_svg]:text-stone-600 dark:[&_svg]:text-stone-300 [&_svg]:[stroke-width:1.75]">
          {user ? (
            <div className="px-4 pt-2 pb-3 md:px-3 md:pt-1.5 md:pb-2 mb-1 border-b dark:border-stone-800">
              <p className="truncate font-medium text-stone-900 dark:text-stone-100">
                {user.firstname} {user.surname}
              </p>
              <p className="truncate text-sm md:text-xs text-stone-500 dark:text-stone-400">
                {user.demoGroup ? "Demo account" : user.email}
              </p>
            </div>
          ) : null}
          {/* The header has its own link on wider screens */}
          <Link to="/books" onClick={() => setOpen(false)} className={`md:hidden ${item}`}>
            <BookIcon size={18} />
            <span>My shelf</span>
          </Link>
          <Link to="/friends" onClick={() => setOpen(false)} className={`md:hidden ${item}`}>
            <GroupIcon size={18} />
            <span>Friends</span>
          </Link>
          <Link to="/groups" onClick={() => setOpen(false)} className={`md:hidden ${item}`}>
            <GroupsIcon size={18} />
            <span>Groups</span>
          </Link>
          <Link to="/want-to-read" onClick={() => setOpen(false)} className={item}>
            <BookmarkIcon size={18} />
            <span>Want to read</span>
          </Link>
          <Link to="/account" onClick={() => setOpen(false)} className={item}>
            <SettingsIcon size={18} />
            <span>Settings</span>
          </Link>
          {user?.isAdmin ? (
            <Link to="/dashboard" onClick={() => setOpen(false)} className={item}>
              <DashboardIcon size={18} />
              <span>Admin</span>
            </Link>
          ) : null}
          <Link
            to={`/feedback?from=${encodeURIComponent(pathname)}`}
            onClick={() => setOpen(false)}
            className={item}
          >
            <PencilIcon />
            <span>Send feedback</span>
          </Link>
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
