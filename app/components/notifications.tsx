
import { Link, useMatches } from "react-router";

import { BellIcon } from "./icons";

interface RootLoaderData {
  user: {
    notificationsReceived?: { id: string }[];
  } | null;
}

export default function Notifications() {
  const matches = useMatches();
  const rootData = matches.find((m) => m.id === "root")?.data as
    | RootLoaderData
    | undefined;
  const notificationCount = rootData?.user?.notificationsReceived?.length ?? 0;

  return (
    <Link
      to="/notifications"
      aria-label={
        notificationCount > 0
          ? `Activity (${notificationCount} new)`
          : "Activity"
      }
      title="Activity"
      className="relative inline-flex items-center justify-center w-11 h-11 md:w-9 md:h-9 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
    >
      {/* A size up on phones, where it's a thumb target */}
      <BellIcon size={24} className="md:h-5 md:w-5" />
      {notificationCount > 0 ? (
        <span className="absolute top-1 right-1 md:top-0.5 md:right-0.5 flex items-center justify-center min-w-4 h-4 md:min-w-3.5 md:h-3.5 px-0.5 text-[10px] md:text-[9px] leading-none font-semibold ring-2 ring-white dark:ring-stone-950 text-white dark:text-stone-900 bg-stone-900 dark:bg-stone-100 rounded-full">
          {notificationCount > 9 ? "9+" : notificationCount}
        </span>
      ) : null}
    </Link>
  );
}
