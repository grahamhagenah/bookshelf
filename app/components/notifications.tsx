import { Link, useMatches } from "react-router";

import { BellIcon } from "./icons";

interface RootLoaderData {
  user: {
    notificationsReceived?: { id: string }[];
  } | null;
}

export default function Notifications() {
  const matches = useMatches();
  const rootData = matches.find((m) => m.id === "root")?.loaderData as
    | RootLoaderData
    | undefined;
  const notificationCount = rootData?.user?.notificationsReceived?.length ?? 0;

  return (
    <Link
      to="/notifications"
      aria-label={
        notificationCount > 0 ? `Alerts (${notificationCount} new)` : "Alerts"
      }
      title="Alerts"
      // Named like the page links once the header has room for their names
      className="inline-flex items-center justify-center gap-1.5 w-11 h-11 md:w-9 md:h-9 lg:w-auto lg:px-2.5 rounded-full lg:rounded-md whitespace-nowrap text-[15px] text-stone-600 dark:text-stone-300 md:text-stone-700 md:dark:text-stone-200 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
    >
      {/* The count sits on the bell's corner */}
      <span className="relative inline-flex">
        {/* A size up on phones, where it's a thumb target. On wider
            screens, drawn like the page links beside it: their color and
            thin lines (1.2 of 24 at 20px, then 1.5 at 18px beside the name) */}
        <BellIcon
          size={24}
          className="md:h-5 md:w-5 md:[stroke-width:1.2] lg:size-[18px] lg:[stroke-width:1.5]"
        />
        {notificationCount > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-4 h-4 md:min-w-3.5 md:h-3.5 px-0.5 text-[10px] md:text-[9px] leading-none font-semibold ring-2 ring-white dark:ring-stone-950 text-white dark:text-stone-900 bg-stone-900 dark:bg-stone-100 rounded-full">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        ) : null}
      </span>
      {/* Clear of the count, which sticks out past the bell */}
      <span
        className={`sr-only lg:not-sr-only ${notificationCount > 0 ? "lg:ml-1" : ""}`}
      >
        Alerts
      </span>
    </Link>
  );
}
