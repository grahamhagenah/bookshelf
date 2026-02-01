import { Form, useMatches } from "@remix-run/react";
import { useState, useRef, useEffect } from 'react';
import { BookIcon, UserIcon, SettingsIcon, GroupIcon, LogoutIcon, SearchIcon, DashboardIcon } from './icons';

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
  const rootData = matches.find(m => m.id === "root")?.data as RootLoaderData | undefined;
  const user = rootData?.user;

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        {user?.profileEmoji ? (
          <span className="text-xl">{user.profileEmoji}</span>
        ) : user ? (
          <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold text-xs">
            {user.firstname?.[0]?.toUpperCase()}{user.surname?.[0]?.toUpperCase()}
          </span>
        ) : (
          <UserIcon size={20} />
        )}
        <span className="hidden md:inline">{user ? user.firstname : "Log In"}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-950 rounded-lg shadow-lg border dark:border-gray-800 py-1 z-50">
          <a
            href="/books"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <BookIcon size={20} />
            <span>My Library</span>
          </a>
          <a
            href="/search"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <SearchIcon size={20} />
            <span>Book Search</span>
          </a>
          <a
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <SettingsIcon size={20} />
            <span>Account Settings</span>
          </a>
          <a
            href="/friends"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <GroupIcon size={20} />
            <span>Friends</span>
          </a>
          {user?.isAdmin && (
            <a
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-blue-600 dark:text-blue-400"
            >
              <DashboardIcon size={20} />
              <span>Dashboard</span>
            </a>
          )}
          <div className="border-t dark:border-gray-800 my-1" />
          <Form action="/logout" method="post">
            <button
              type="submit"
              className="flex items-center gap-3 px-4 py-2 w-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <LogoutIcon size={20} />
              <span>Logout</span>
            </button>
          </Form>
        </div>
      )}
    </div>
  );
}
