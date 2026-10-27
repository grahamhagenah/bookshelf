// Quiet line icons for each kind of activity, set in a soft circle

const PATHS: Record<string, React.ReactNode> = {
  // Person with a plus
  FRIEND_REQUEST: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M19 8v6M16 11h6" />
    </>
  ),
  // Open book
  BOOK_REQUEST: (
    <>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z" />
      <path d="M12 6.5v13" />
    </>
  ),
  // Arrow forward: your turn in line
  HOLD_READY: (
    <>
      <path d="M4 12h14" />
      <path d="M13 6.5l5.5 5.5-5.5 5.5" />
    </>
  ),
  // Bookmark: a book from your want-to-read list turned up
  WANT_MATCH: <path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" />,
  // Check mark
  BOOK_APPROVED: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  // A circle with a line through: not this time
  BOOK_DECLINED: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 18L18 6" />
    </>
  ),
  // Arrow curling back
  BOOK_RETURNED: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
    </>
  ),
  // The same arrow, turned back around: it's still out
  RETURN_UNDONE: (
    <>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 000 11H13" />
    </>
  ),
  // Clock with a plus
  LOAN_EXTENDED: (
    <>
      <circle cx="11" cy="12" r="7.5" />
      <path d="M11 8v4l2.5 1.5M19.5 3.5v5M17 6h5" />
    </>
  ),
  // Clock
  DUE_SOON_REMINDER: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  // Circle with an exclamation mark
  OVERDUE_REMINDER: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </>
  ),
  // A book lent by name only: the same clock and warning, for its owner
  LOAN_DUE_SOON: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  LOAN_OVERDUE: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </>
  ),
  // Heart
  READER_NOTE: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
  ),
  // Megaphone: a word from Stacks
  ANNOUNCEMENT: (
    <>
      <path d="M3 10v4a1 1 0 001 1h3l6 4V5L7 9H4a1 1 0 00-1 1z" />
      <path d="M16.5 8.5a4 4 0 010 7M19 6a7.5 7.5 0 010 12" />
    </>
  ),
  // Hourglass
  PENDING: (
    <>
      <path d="M6.5 3.5h11M6.5 20.5h11" />
      <path d="M7.5 3.5c0 4.5 4.5 5.5 4.5 8.5s-4.5 4-4.5 8.5M16.5 3.5c0 4.5-4.5 5.5-4.5 8.5s4.5 4 4.5 8.5" />
    </>
  ),
};

// Joining from an invite looks like the friend request it stands in for
PATHS.FRIEND_JOINED = PATHS.FRIEND_REQUEST;
PATHS.GROUP_JOINED = PATHS.FRIEND_REQUEST;

const FALLBACK = <circle cx="12" cy="12" r="2.5" />;

export default function ActivityIcon({
  type,
  urgent = false,
  size = "md",
}: {
  type: string;
  urgent?: boolean;
  size?: "xs" | "sm" | "md";
}) {
  const box = size === "xs" ? "w-5 h-5" : size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const icon = size === "xs" ? 11 : size === "sm" ? 14 : 16;
  return (
    <span
      aria-hidden="true"
      className={`${box} flex-shrink-0 rounded-full flex items-center justify-center ${
        urgent
          ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
          : // An edge of its own, so it holds up on a white card as well
            // as over a picture's corner
            "bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-600"
      }`}
    >
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[type] ?? FALLBACK}
      </svg>
    </span>
  );
}
