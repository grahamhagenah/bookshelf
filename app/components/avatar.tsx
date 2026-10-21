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
}: {
  firstname?: string | null;
  surname?: string | null;
  icon?: string | null;
  size?: keyof typeof SIZES;
}) {
  const { box, icon: iconSize } = SIZES[size];
  return (
    <span
      className={`${box} rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 font-semibold flex items-center justify-center flex-shrink-0`}
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
