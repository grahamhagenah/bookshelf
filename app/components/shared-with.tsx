import { Link } from "@remix-run/react";

import Avatar from "./avatar";

export interface Member {
  id: string;
  firstname: string;
  surname: string;
  profileEmoji: string | null;
}

// "Jordan & Noah", "Jordan, Noah & Sam"
export function joinNames(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : names.join("");
}

// Said once at the top of a shared shelf, since its books no longer say
// whose each one is: everyone's pictures, overlapping as in Settings, and
// who else it's shared with. Leads to the shelf's card in Settings.
export default function SharedWith({
  members,
  viewerId,
  compact = false,
}: {
  members: Member[];
  viewerId: string;
  // Pictures only, for phones
  compact?: boolean;
}) {
  const others = members.filter((member) => member.id !== viewerId);
  const label = `Shared with ${joinNames(others.map((member) => member.firstname))}`;
  return (
    <Link
      to="/account#sharing"
      aria-label={compact ? label : undefined}
      title={compact ? label : undefined}
      className={`inline-flex h-8 flex-shrink-0 items-center gap-2 rounded-md text-sm text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors ${
        compact ? "px-0.5" : "px-1.5 hover:bg-stone-100 dark:hover:bg-stone-800"
      }`}
    >
      <span aria-hidden="true" className="flex -space-x-1.5">
        {members.map((member) => (
          // Solid and positioned, like the group faces: the pictures' tints
          // are see-through, and initials would draw over the face after
          <span
            key={member.id}
            className="relative rounded-full bg-white ring-2 ring-white dark:bg-stone-950 dark:ring-stone-950"
          >
            <Avatar firstname={member.firstname} surname={member.surname} icon={member.profileEmoji} size="xs" />
          </span>
        ))}
      </span>
      {compact ? null : <span className="whitespace-nowrap">{label}</span>}
    </Link>
  );
}
