import { useMatches } from "@remix-run/react";

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
    <a
      href="/notifications"
      aria-label={
        notificationCount > 0
          ? `Activity (${notificationCount} new)`
          : "Activity"
      }
      title="Activity"
      className="relative inline-flex items-center justify-center w-11 h-11 md:w-9 md:h-9 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
    >
      <BellIcon size={20} />
      {notificationCount > 0 ? (
        <span className="absolute top-1.5 right-1.5 md:top-0.5 md:right-0.5 flex items-center justify-center min-w-3.5 h-3.5 px-0.5 text-[9px] leading-none font-semibold ring-2 ring-white dark:ring-stone-950 text-white dark:text-stone-900 bg-stone-900 dark:bg-stone-100 rounded-full">
          {notificationCount > 9 ? "9+" : notificationCount}
        </span>
      ) : null}
    </a>
  );
}
