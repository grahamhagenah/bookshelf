import { useMatches } from "@remix-run/react";
import { useState, useRef, useEffect } from 'react';
import { GroupIcon } from './icons';

interface Friend {
  id: string;
  firstname: string | null;
  surname: string | null;
  profileEmoji: string | null;
  _count: {
    books: number;
  };
}

interface RootLoaderData {
  user: {
    following?: Friend[];
  } | null;
}

export default function FriendsDropdown() {
  const matches = useMatches();
  const rootData = matches.find(m => m.id === "root")?.data as RootLoaderData | undefined;
  const allFriends = rootData?.user?.following ?? [];
  const friends = allFriends.slice(0, 5);

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
        className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <GroupIcon size={20} />
        <span className="hidden md:inline">Friends</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-72 bg-white dark:bg-gray-950 rounded-lg shadow-lg border dark:border-gray-800 py-2 z-50">
          {friends.length > 0 ? (
            <>
              {friends.map((friend) => (
                <a
                  key={friend.id}
                  href={`/friend/${friend.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold text-xs flex-shrink-0">
                      {friend.profileEmoji ? (
                        <span className="text-lg">{friend.profileEmoji}</span>
                      ) : (
                        <>
                          {(friend.firstname?.[0] || "").toUpperCase()}
                          {(friend.surname?.[0] || "").toUpperCase()}
                        </>
                      )}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {friend.firstname} {friend.surname}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {friend._count.books} {friend._count.books === 1 ? 'book' : 'books'}
                  </span>
                </a>
              ))}
              <div className="border-t dark:border-gray-800 my-1" />
              <a
                href="/friends"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-blue-600 dark:text-blue-400"
              >
                <span>View all friends</span>
              </a>
            </>
          ) : (
            <div className="px-4 py-3 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">No friends yet</p>
              <a
                href="/friends"
                onClick={() => setOpen(false)}
                className="text-blue-600 dark:text-blue-400 text-sm hover:underline"
              >
                Find friends
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
