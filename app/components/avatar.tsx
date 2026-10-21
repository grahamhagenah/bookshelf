// Profile pictures: a small set of line icons, or the person's initials.
// The chosen key is stored in User.profileEmoji (named before icons
// replaced emoji); anything that isn't a known key, such as an emoji
// picked earlier, falls back to initials.

const ICON_PATHS = {
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v14H6.5A2.5 2.5 0 0 0 4 19.5z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8.5 5.5-14 15-14 0 9.5-5.5 15-15 14z" />
      <path d="M5 19 14 10" />
    </>
  ),
  bookmark: <path d="M7 3.5h10v17l-5-3.5-5 3.5z" />,
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  mountain: (
    <>
      <path d="M2.5 20 9 8.5l4 7 2.5-4L21.5 20z" />
      <path d="M7.3 11.5 9 12.5l1.6-1" />
    </>
  ),
  wave: (
    <>
      <path d="M3 9.5c2.25-1.75 4.25-1.75 6 0s3.75 1.75 6 0 3.75-1.75 6 0" />
      <path d="M3 14.5c2.25-1.75 4.25-1.75 6 0s3.75 1.75 6 0 3.75-1.75 6 0" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
      <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8 3.5v2.5M12 3.5v2.5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 9.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM14.5 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0zM12 14.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM9.5 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
    </>
  ),
  glasses: (
    <>
      <circle cx="6.5" cy="14" r="3.5" />
      <circle cx="17.5" cy="14" r="3.5" />
      <path d="M10 14c1.2-1 2.8-1 4 0M3 14l1-6M21 14l-1-6" />
    </>
  ),
  cat: (
    <>
      <path d="M12 20c-4.4 0-7.5-2.7-7.5-6.5V4.5l4 3.5h7l4-3.5v9c0 3.8-3.1 6.5-7.5 6.5z" />
      <path d="M9 12.5h.01M15 12.5h.01M11 15.5h2" />
    </>
  ),
  paw: (
    <>
      <circle cx="8.5" cy="6.5" r="1.75" />
      <circle cx="15.5" cy="6.5" r="1.75" />
      <circle cx="5" cy="11" r="1.75" />
      <circle cx="19" cy="11" r="1.75" />
      <path d="M12 11.5c-2.5 0-5 3-5 5.5 0 1.5 1.2 2.5 2.5 2.5 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c1.3 0 2.5-1 2.5-2.5 0-2.5-2.5-5.5-5-5.5z" />
    </>
  ),
  fish: (
    <>
      <path d="M3 12c3-4.5 9-5.5 13 0-4 5.5-10 4.5-13 0z" />
      <path d="M16 12l5-3.5v7z" />
      <path d="M7.5 11h.01" />
    </>
  ),
  tree: (
    <>
      <path d="M12 3l6 8.5h-3.5l4.5 6.5H5l4.5-6.5H6z" />
      <path d="M12 18v3" />
    </>
  ),
  cactus: (
    <path d="M10 21V5.5a2 2 0 0 1 4 0V21M10 13H8a2 2 0 0 1-2-2V8.5M14 11h2a2 2 0 0 0 2-2V6.5M7 21h10" />
  ),
  mushroom: (
    <>
      <path d="M4 12a8 8 0 0 1 16 0z" />
      <path d="M9.5 12v6.5a2.5 2.5 0 0 0 5 0V12" />
    </>
  ),
  cloud: (
    <path d="M7 18.5h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18.5z" />
  ),
  snowflake: (
    <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5" />
  ),
  flame: (
    <path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-4 3.5-6 4-10 3 1.5 4.5 4 4.5 6.5 1-.5 1.8-1.5 2-3 1.6 1.6 2.5 3.8 2.5 6.5 0 3.4-2.6 6-6.5 6z" />
  ),
  umbrella: (
    <>
      <path d="M3 12a9 9 0 0 1 18 0z" />
      <path d="M12 12v6.5a2 2 0 0 1-4 0M12 3v0" />
    </>
  ),
  anchor: (
    <>
      <circle cx="12" cy="5.5" r="2" />
      <path d="M12 7.5V21M8.5 11h7M4.5 13.5a7.5 7.5 0 0 0 15 0" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 2.5c3 2 4.5 5.5 4.5 9.5l-2 4.5h-5l-2-4.5c0-4 1.5-7.5 4.5-9.5z" />
      <path d="M9.5 16.5 7 19l.5-5.5M14.5 16.5 17 19l-.5-5.5M12 19v2.5" />
      <circle cx="12" cy="9.5" r="1.5" />
    </>
  ),
  bicycle: (
    <>
      <circle cx="6" cy="16" r="3.5" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M6 16l3.5-6.5h6L18 16M9.5 9.5 12 16H6M8 6.5h3M15.5 9.5l-1-3H17" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5.5l11-2V16" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="17.5" cy="16" r="2.5" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <path d="M4 15h3v5H5.5A1.5 1.5 0 0 1 4 18.5zM20 15h-3v5h1.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </>
  ),
  camera: (
    <>
      <path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.5L9 4.5h6L16.5 7H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 0 0 0 18c1.2 0 2-.8 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2a4 4 0 0 0 4-4c0-4.2-4-7.5-9-7.5z" />
      <circle cx="7.5" cy="11.5" r="1" />
      <circle cx="10" cy="7.5" r="1" />
      <circle cx="14.5" cy="7.5" r="1" />
    </>
  ),
  pencil: (
    <path d="M16.5 3.5l4 4L8 20H4v-4zM14 6l4 4" />
  ),
  lightbulb: (
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.5 1 .5 1.6V16h6v-.5c0-.6.1-1.2.6-1.6A6 6 0 0 0 12 3z" />
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4.5" />
      <path d="M11.2 11.8 20 3M17 6l2.5 2.5M14.5 8.5l2 2" />
    </>
  ),
};

export type AvatarIcon = keyof typeof ICON_PATHS;

export const AVATAR_ICONS = Object.keys(ICON_PATHS) as AvatarIcon[];

export function isAvatarIcon(value: unknown): value is AvatarIcon {
  return typeof value === "string" && value in ICON_PATHS;
}

export function AvatarGlyph({ icon, size = 20 }: { icon: AvatarIcon; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICON_PATHS[icon]}
    </svg>
  );
}

const SIZES = {
  xs: { box: "w-6 h-6 text-[10px]", icon: 14 },
  sm: { box: "w-8 h-8 text-xs", icon: 18 },
  md: { box: "w-10 h-10 text-sm", icon: 20 },
  lg: { box: "w-16 h-16 text-xl", icon: 30 },
};

export default function Avatar({
  firstname,
  surname,
  icon,
  size = "md",
  className = "",
}: {
  firstname?: string | null;
  surname?: string | null;
  icon?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { box, icon: iconSize } = SIZES[size];
  return (
    <span
      className={`${box} rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-semibold flex items-center justify-center flex-shrink-0 ${className}`}
    >
      {isAvatarIcon(icon) ? (
        <AvatarGlyph icon={icon} size={iconSize} />
      ) : (
        <>
          {(firstname?.[0] || "").toUpperCase()}
          {(surname?.[0] || "").toUpperCase()}
        </>
      )}
    </span>
  );
}
