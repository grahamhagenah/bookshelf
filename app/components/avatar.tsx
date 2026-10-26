// Profile pictures: a small set of line icons, or the person's initials as
// a bookplate.
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
  star: (
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  ),
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
      {/* Four toes on an even arc over the pad, the outer two turned out */}
      <ellipse cx="5.7" cy="10.9" rx="1.5" ry="1.85" transform="rotate(-28 5.7 10.9)" />
      <ellipse cx="9.3" cy="6.9" rx="1.55" ry="2" transform="rotate(-10 9.3 6.9)" />
      <ellipse cx="14.7" cy="6.9" rx="1.55" ry="2" transform="rotate(10 14.7 6.9)" />
      <ellipse cx="18.3" cy="10.9" rx="1.5" ry="1.85" transform="rotate(28 18.3 10.9)" />
      <path d="M12 11.8c-2.5 0-5 2.9-5 5.4 0 1.5 1.2 2.5 2.5 2.5 1 0 1.6-.6 2.5-.6s1.5.6 2.5.6c1.3 0 2.5-1 2.5-2.5 0-2.5-2.5-5.4-5-5.4z" />
    </>
  ),
  fish: (
    <>
      <path d="M3 12c3-4.5 9-5.5 13 0-4 5.5-10 4.5-13 0z" />
      <path d="M16 12l5-3.5v7z" />
      <path d="M7.5 11h.01" />
    </>
  ),
  owl: (
    <>
      {/* A round face, its tufts part of the outline, as big as the box
          allows so the eyes still read at small sizes */}
      <path d="M4.64 8.55 3.74 4.07l4.67 1.02a8.5 8.5 0 0 1 7.18 0l4.67-1.02-.9 4.48A8.5 8.5 0 1 1 4.64 8.55z" />
      <circle cx="8.7" cy="11.6" r="2.7" />
      <circle cx="15.3" cy="11.6" r="2.7" />
      <circle cx="8.7" cy="11.6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.3" cy="11.6" r="1.2" fill="currentColor" stroke="none" />
      <path d="M11.2 15.4 12 16.8l.8-1.4" />
    </>
  ),
  fox: (
    <>
      <path d="M4 4.5l3 6.5-1 3 6 6 6-6-1-3 3-6.5-5 3.5h-6z" />
      <circle cx="9.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  frog: (
    <>
      {/* The head stops at the eyes rather than running through them */}
      <path d="M5.75 9.1C4.4 10.2 3.5 12 3.5 14c0 3.3 3.8 5.5 8.5 5.5s8.5-2.2 8.5-5.5c0-2-.9-3.8-2.25-4.9M9.7 10q2.3-.6 4.6 0" />
      <circle cx="8" cy="8.3" r="2.4" />
      <circle cx="16" cy="8.3" r="2.4" />
      <circle cx="8" cy="8.3" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8.3" r="1" fill="currentColor" stroke="none" />
      <path d="M8.5 14.5q3.5 2.3 7 0" />
    </>
  ),
  bee: (
    <>
      {/* From above: head and feelers, a striped body, a wing to each side */}
      <ellipse cx="12" cy="14.5" rx="3.8" ry="5.2" />
      <circle cx="12" cy="7.3" r="2" />
      <path d="M8.35 13h7.3M8.5 16.3h7" />
      <path d="M8.6 12.2C6 13.6 2.9 12.2 3.4 9.9 3.9 7.8 7.2 8.2 9.4 10.4M15.4 12.2c2.6 1.4 5.7 0 5.2-2.3-.5-2.1-3.8-1.7-6 .5" />
      <path d="M11 5.6 9.9 3.8M13 5.6l1.1-1.8" />
    </>
  ),
  octopus: (
    <>
      <path d="M6 11.5a6 6 0 0 1 12 0v2H6z" />
      <path d="M7 13.5c0 3-2 4-2 6M10 13.5c0 3-1 5-.5 7M14 13.5c0 3 1 5 .5 7M17 13.5c0 3 2 4 2 6" />
      <circle cx="9.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  snail: (
    <>
      <path d="M3 19h13.5a3.5 3.5 0 0 0 3.5-3.5V9.5" />
      <path d="M20 9.5 18.8 6M20 9.5l1.6-3" />
      <circle cx="11" cy="13" r="5" />
      <path d="M11 13a1.6 1.6 0 1 1 1.6-1.6 3 3 0 0 1-3 3" />
    </>
  ),
  ghost: (
    <>
      <path d="M6 20.5V11a6 6 0 0 1 12 0v9.5l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z" />
      <circle cx="10" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <path d="M10.6 14c.8.6 2 .6 2.8 0" />
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
  balloon: (
    <>
      <path d="M12 3a6.5 6.5 0 0 0-6.5 6.5c0 3.5 3.5 6 4.5 8h4c1-2 4.5-4.5 4.5-8A6.5 6.5 0 0 0 12 3z" />
      <path d="M12 3c-1.8 2-2.5 4.4-2.5 6.5s.4 5 .5 8M12 3c1.8 2 2.5 4.4 2.5 6.5s-.4 5-.5 8" />
      <path d="M10.3 17.5h3.4v3h-3.4z" />
    </>
  ),
  planet: (
    <>
      {/* The ring goes behind the planet: the part that would show through
          it is left out */}
      <circle cx="12" cy="12" r="5.5" />
      <path d="M15.47 7.73A10 3.2-20 1 1 6.6 10.96" />
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
  pencil: <path d="M16.5 3.5l4 4L8 20H4v-4zM14 6l4 4" />,
  lightbulb: (
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.5 1 .5 1.6V16h6v-.5c0-.6.1-1.2.6-1.6A6 6 0 0 0 12 3z" />
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4.5" />
      <path d="M11.2 11.8 20 3M17 6l2.5 2.5M14.5 8.5l2 2" />
    </>
  ),
  crown: (
    <>
      <path d="M4 17.5 3 7.5l5 4 4-6.5 4 6.5 5-4-1 10z" />
      <path d="M4.5 20.5h15" />
    </>
  ),
  teapot: (
    <>
      <path d="M5.5 9h13c.3 0 .5.2.5.5C19 15 16 18.5 12 18.5S5 15 5 9.5c0-.3.2-.5.5-.5z" />
      <path d="M10 9V7.5h4V9M12 7.5V5.5" />
      <path d="M5.3 11.5 2.5 9M19 11h1a2 2 0 0 1 0 4h-1.5M8 21h8" />
    </>
  ),
  dice: (
    <>
      <path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5z" />
      <circle cx="9" cy="9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
};

export type AvatarIcon = keyof typeof ICON_PATHS;

export const AVATAR_ICONS = Object.keys(ICON_PATHS) as AvatarIcon[];

export function isAvatarIcon(value: unknown): value is AvatarIcon {
  return typeof value === "string" && value in ICON_PATHS;
}

// Bookplates: initials in a serif inside a thin frame, like the ex libris
// label pasted inside a book's cover. Chosen ones are kept as "plate:" and
// a color; without a choice, a color is picked from the person's name.
export const PLATE_COLORS = {
  forest:
    "bg-forest-600/10 text-forest-700 dark:bg-forest-400/15 dark:text-forest-400",
  oxblood: "bg-red-900/10 text-red-900 dark:bg-red-400/15 dark:text-red-300",
  navy: "bg-blue-900/10 text-blue-900 dark:bg-blue-400/15 dark:text-blue-300",
  ochre:
    "bg-amber-600/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
  plum: "bg-purple-900/10 text-purple-900 dark:bg-purple-400/15 dark:text-purple-300",
  ink: "bg-stone-900/10 text-stone-800 dark:bg-stone-100/10 dark:text-stone-200",
};
export type PlateColor = keyof typeof PLATE_COLORS;
export const PLATE = "plate:";

export const isPlateColor = (value: unknown): value is PlateColor =>
  typeof value === "string" && value in PLATE_COLORS;

// A stored picture, taken apart: an icon, or a bookplate (no icon), each
// with the color chosen for it, if any. "owl", "owl:plum", "plate:plum".
export function pictureOf(value: unknown): {
  icon: AvatarIcon | null;
  color: PlateColor | null;
} {
  if (typeof value !== "string") return { icon: null, color: null };
  const [head, tail] = value.split(":");
  const color = isPlateColor(tail) ? tail : null;
  if (head === PLATE.slice(0, -1)) return { icon: null, color };
  return isAvatarIcon(head)
    ? { icon: head, color }
    : { icon: null, color: null };
}

// Whether a value is one the picture picker could have stored
export function isPicture(value: unknown) {
  const { icon, color } = pictureOf(value);
  return icon !== null || color !== null;
}

// The chosen color from a stored picture, bookplate or icon
export function plateColorOf(value: unknown): PlateColor | null {
  return pictureOf(value).color;
}

// Someone who hasn't chosen keeps the same color, worked out from their
// name. Ink reads as grey, so it's there to choose but never handed out.
const DEFAULT_PLATES: PlateColor[] = [
  "forest",
  "oxblood",
  "navy",
  "ochre",
  "plum",
];

export function plateColorFor(
  firstname?: string | null,
  surname?: string | null,
): PlateColor {
  const name = `${firstname ?? ""} ${surname ?? ""}`;
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return DEFAULT_PLATES[hash % DEFAULT_PLATES.length];
}

const initialsOf = (firstname?: string | null, surname?: string | null) =>
  `${(firstname?.[0] || "").toUpperCase()}${(surname?.[0] || "").toUpperCase()}`;

// A bookplate on its own, for the picker in Settings too
export function Bookplate({
  firstname,
  surname,
  color,
  box,
  framed,
  className = "",
}: {
  firstname?: string | null;
  surname?: string | null;
  color?: PlateColor | null;
  box: string;
  framed: boolean;
  className?: string;
}) {
  const tone = PLATE_COLORS[color ?? plateColorFor(firstname, surname)];
  // Letter spacing also trails the last letter, so the same space on the
  // left keeps the pair centered
  return (
    <span
      className={`${box} ${tone} relative flex flex-shrink-0 items-center justify-center rounded-full pl-[0.03em] font-serif font-semibold tracking-[0.03em] ${className}`}
    >
      {/* The frame: a thin ring inside the edge, at sizes where it shows */}
      {framed ? (
        <span
          aria-hidden="true"
          className="absolute inset-[3px] rounded-full border border-current opacity-30"
        />
      ) : null}
      {initialsOf(firstname, surname)}
    </span>
  );
}

export function AvatarGlyph({
  icon,
  size = 20,
}: {
  icon: AvatarIcon;
  size?: number;
}) {
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

// An icon's circle: the tint and ink of its chosen color, as a bookplate in
// that color has, or plain grey
export const iconTone = (color: PlateColor | null) =>
  color
    ? PLATE_COLORS[color]
    : "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200";

const SIZES = {
  xs: { box: "w-6 h-6 text-[10px]", icon: 15 },
  sm: { box: "w-8 h-8 text-xs", icon: 20 },
  // A list beside other things, like the home page's friend activity
  list: { box: "w-9 h-9 text-xs", icon: 23 },
  md: { box: "w-10 h-10 text-sm", icon: 25 },
  lg: { box: "w-16 h-16 text-xl", icon: 38 },
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
  const picture = pictureOf(icon);
  if (!picture.icon) {
    return (
      <Bookplate
        firstname={firstname}
        surname={surname}
        color={picture.color}
        box={box}
        framed={size === "md" || size === "lg"}
        className={className}
      />
    );
  }
  return (
    <span
      className={`${box} rounded-full ${iconTone(picture.color)} font-semibold flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <AvatarGlyph icon={picture.icon} size={iconSize} />
    </span>
  );
}
