// Shown while a cover loads, or instead of one that fails to load: a
// plain cloth-bound book with the title and author, in one of a few soft,
// muted tints picked from the title so a shelf isn't a wall of identical
// blocks. Everything is sized to the tile itself (container units), so it
// reads the same on a feed thumbnail as on a book's own page.
const TINTS = [
  // Sage
  "bg-[#dfe5dc] text-[#2f3b31] dark:bg-[#252d27] dark:text-[#d3ddd4]",
  // Dusty blue
  "bg-[#dce2e9] text-[#2c3642] dark:bg-[#242a32] dark:text-[#d2dae4]",
  // Clay
  "bg-[#ebdfd7] text-[#4a3329] dark:bg-[#312824] dark:text-[#e6d6cc]",
  // Sand
  "bg-[#ebe4d4] text-[#433a27] dark:bg-[#2f2b23] dark:text-[#e2dac6]",
  // Heather
  "bg-[#e5dde5] text-[#3d3040] dark:bg-[#2c2730] dark:text-[#ddd2df]",
  // Stone
  "bg-[#e6e3e1] text-[#36302c] dark:bg-[#292624] dark:text-[#dcd7d3]",
];

function hash(text: string) {
  let value = 0;
  for (let i = 0; i < text.length; i++) {
    value = text.charCodeAt(i) + ((value << 5) - value);
  }
  return Math.abs(value);
}

function tintFor(title: string) {
  return TINTS[hash(title) % TINTS.length];
}

// The title's size, in hundredths of the tile's width: as big as a cover
// would set it, smaller for a long title, and never so big that its
// longest word has to break. A serif letter is about 0.6em wide at most,
// and the text has about 76% of the tile's width.
function titleSize(title: string) {
  const longestWord = Math.max(
    ...title.split(/\s+/).map((word) => word.length),
    1,
  );
  const byLength =
    title.length <= 12
      ? 14
      : title.length <= 24
        ? 12.5
        : title.length <= 40
          ? 11
          : 9.5;
  // A very long word gets a floor and breaks between syllables instead
  return Math.max(9, Math.min(byLength, 76 / (0.6 * longestWord)));
}

export default function CoverPlaceholder({
  title,
  author,
  className = "",
  compact = false,
  roomBelow = false,
}: {
  title: string;
  author?: string | null;
  className?: string;
  // Too small for words: the title's first letter, like a spine
  compact?: boolean;
  // A button sits over the foot of the tile; the author moves up above it
  roomBelow?: boolean;
}) {
  const tint = tintFor(title);

  if (compact) {
    return (
      <div
        className={`@container flex items-center justify-center overflow-hidden ${tint} ${className}`}
        aria-hidden="true"
      >
        <span className="font-serif text-[max(10px,45cqw)] font-semibold leading-none opacity-80">
          {title.trim().charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  const size = titleSize(title);
  // As many lines as fit above the author, so a long title is cut off
  // with an ellipsis rather than running into it
  const lines = Math.max(2, Math.floor(96 / (size * 1.15)));

  return (
    <div
      className={`@container overflow-hidden ${tint} ${className}`}
      aria-hidden="true"
    >
      <div className="relative h-full">
        {/* The spine: a slightly darker band down the left edge, with a
          crease where the board meets it */}
        <span className="absolute inset-y-0 left-0 w-[5cqw] bg-black/[0.06] dark:bg-black/25" />
        <span className="absolute inset-y-0 left-[5cqw] w-px bg-white/40 dark:bg-white/[0.06]" />

        <div
          className={`flex h-full flex-col justify-between pt-[10cqw] pl-[14cqw] pr-[9cqw] ${
            roomBelow ? "pb-[calc(10cqw+2.5rem)]" : "pb-[10cqw]"
          }`}
        >
          <div>
            <span
              lang="en"
              className="block font-serif font-semibold leading-[1.12] tracking-[-0.01em] hyphens-auto [overflow-wrap:break-word] text-balance"
              style={{
                fontSize: `max(8px, ${size}cqw)`,
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: lines,
                overflow: "hidden",
              }}
            >
              {title}
            </span>
            {/* A short rule under the title, as on a printed cover */}
            <span className="mt-[6cqw] hidden h-px w-[16cqw] bg-current opacity-30 @[5rem]:block" />
          </div>
          {author ? (
            <span className="hidden @[4.5rem]:block">
              <span className="line-clamp-2 text-[max(7px,7cqw)] font-medium uppercase leading-[1.25] tracking-[0.08em] opacity-65">
                {author}
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
