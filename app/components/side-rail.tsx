import { Link } from "@remix-run/react";

import { groupPath } from "~/group-links";

import Avatar from "./avatar";
import Faces from "./faces";

// Beside a page's main column on wide screens: who you're following, then
// your groups. Hidden on phones, where the column has the whole width.

export interface Friend {
  id: string;
  firstname: string;
  surname: string;
  profileEmoji: string | null;
}

export interface SideRailProps {
  friends: Friend[];
  // The groups you're in, on pages about the people you know
  groups?: {
    id: string;
    name: string;
    memberCount: number;
    faces: Friend[];
  }[];
  // A page's own section, last
  children?: React.ReactNode;
}

export default function SideRail({ friends, groups, children }: SideRailProps) {
  const heading = "text-lg font-semibold text-stone-900 dark:text-stone-100";
  const link =
    "text-sm text-stone-500 dark:text-stone-400 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100 hover:underline";

  return (
    <aside className="hidden space-y-10 self-start lg:sticky lg:top-24 lg:block">
      <section aria-labelledby="rail-friends">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="rail-friends" className={heading}>
            Friends
            <span className="ml-1.5 text-sm font-normal text-stone-400 dark:text-stone-500">
              {friends.length}
            </span>
          </h2>
          <Link to={friends.length > 0 ? "/friends" : "/friends/add"} className={link}>
            {friends.length > 0 ? "See all" : "Find friends"}
          </Link>
        </div>
        {friends.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {friends.slice(0, 12).map((friend) => (
              <li key={friend.id}>
                <Link
                  to={`/friend/${friend.id}`}
                  title={`${friend.firstname} ${friend.surname}`}
                  className="block rounded-full ring-2 ring-transparent hover:ring-stone-300 dark:hover:ring-stone-600 transition-shadow"
                >
                  <Avatar
                    firstname={friend.firstname}
                    surname={friend.surname}
                    icon={friend.profileEmoji}
                    size="md"
                  />
                  <span className="sr-only">
                    {friend.firstname} {friend.surname}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-400 dark:text-stone-500">
            Friends&apos; books show up here once you have some.
          </p>
        )}
      </section>

      {groups ? <RailGroups groups={groups} /> : null}

      {children}
    </aside>
  );
}

type RailGroup = NonNullable<SideRailProps["groups"]>[number];

// The groups you're in, each straight to its page: beside the feed, and
// beside your friends on the Friends page. With none, what they're for.
export function RailGroups({ groups, limit = 5 }: { groups: RailGroup[]; limit?: number }) {
  const heading = "text-lg font-semibold text-stone-900 dark:text-stone-100";
  const link =
    "text-sm text-stone-500 dark:text-stone-400 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100 hover:underline";
  return (
    <section aria-labelledby="rail-groups">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="rail-groups" className={heading}>
          Groups
          {groups.length > 0 ? (
            <span className="ml-1.5 text-sm font-normal text-stone-400 dark:text-stone-500">
              {groups.length}
            </span>
          ) : null}
        </h2>
        <Link to="/groups" className={link}>
          {groups.length > 0 ? "See all" : "Start one"}
        </Link>
      </div>
      {groups.length > 0 ? (
        <ul className="space-y-3">
          {groups.slice(0, limit).map((group) => (
            <li key={group.id}>
              <Link
                to={groupPath(group)}
                className="flex items-center gap-3 rounded-md hover:opacity-80 transition-opacity"
              >
                <Faces people={group.faces} max={3} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                    {group.name}
                  </span>
                  <span className="block text-xs text-stone-500 dark:text-stone-400">
                    {group.memberCount} {group.memberCount === 1 ? "person" : "people"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-400 dark:text-stone-500">
          A book club, an office or a family, all borrowing from each other.
        </p>
      )}
    </section>
  );
}
