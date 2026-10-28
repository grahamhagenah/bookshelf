import { Link, useLocation, useMatches } from "react-router";

import { BellIcon } from "./icons";
import { hereIcon } from "./ui";

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
  const here = useLocation().pathname === "/notifications";

  return (
    <Link
      to="/notifications"
      aria-label={
        notificationCount > 0 ? `Alerts (${notificationCount} new)` : "Alerts"
      }
      title="Alerts"
      aria-current={here ? "page" : undefined}
      // Named like the page links once the header has room for their names
      className={`inline-flex items-center justify-center gap-1.5 w-11 h-11 md:w-9 md:h-9 lg:w-auto lg:px-2.5 rounded-full lg:rounded-md whitespace-nowrap text-[15px] transition-colors ${
        here
          ? hereIcon
          : "text-stone-600 dark:text-stone-300 md:text-stone-700 md:dark:text-stone-200 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800"
      }`}
    >
      {/* A dot on the bell's corner while there's something new; how
          many is read out, not shown */}
      <span className="relative inline-flex">
        {/* A size up on phones, where it's a thumb target. On wider
            screens, drawn like the page links beside it: their color and
            thin lines (1.2 of 24 at 20px, then 1.5 at 18px beside the name) */}
        <BellIcon
          size={24}
          className="md:h-5 md:w-5 md:[stroke-width:1.2] lg:size-[18px] lg:[stroke-width:1.5]"
        />
        {notificationCount > 0 ? (
          <span
            aria-hidden="true"
            // Its ring is the color behind it: the header, or the green
            // wash while you're on this page
            className={`absolute top-0 right-0 size-2 md:size-[7px] rounded-full bg-forest-600 dark:bg-forest-400 ring-2 ${
              here ? "ring-[#e9f0ed] dark:ring-[#13201a]" : "ring-white dark:ring-stone-950"
            }`}
          />
        ) : null}
      </span>
      <span className="sr-only lg:not-sr-only">Alerts</span>
    </Link>
  );
}
