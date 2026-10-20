import { useMatches } from "@remix-run/react";
import { BellIcon } from './icons';

interface RootLoaderData {
  user: {
    notificationsReceived?: { id: string }[];
  } | null;
}

export default function Notifications() {
  const matches = useMatches();
  const rootData = matches.find(m => m.id === "root")?.data as RootLoaderData | undefined;
  const notificationCount = rootData?.user?.notificationsReceived?.length ?? 0;

  return (
    <a
      href="/notifications"
      aria-label={notificationCount > 0 ? `Notifications (${notificationCount} new)` : "Notifications"}
      title="Notifications"
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-full text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <BellIcon size={20} />
      {notificationCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-5 h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
          {notificationCount > 9 ? '9+' : notificationCount}
        </span>
      )}
    </a>
  );
}
