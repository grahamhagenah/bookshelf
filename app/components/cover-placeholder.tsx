// Shown while a cover loads, or instead of one that fails to load: a plain
// tile with the title and author, in one of a few grays picked from the
// title so the shelf isn't a wall of identical blocks.
const TINTS = [
  "bg-stone-100",
  "bg-stone-200 dark:bg-stone-800",
  "bg-stone-50 dark:bg-stone-900",
  "bg-stone-200/60 dark:bg-stone-800/70",
];

function tintFor(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TINTS[Math.abs(hash) % TINTS.length];
}

export default function CoverPlaceholder({
  title,
  author,
  className = "",
  large = false,
  compact = false,
}: {
  title: string;
  author?: string | null;
  className?: string;
  large?: boolean;
  // Too small for words: the title's first letter, like a spine
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden text-stone-500 dark:text-stone-400 ${tintFor(title)} ${className}`}
        aria-hidden="true"
      >
        <span className="font-serif text-lg font-semibold leading-none">{title.trim().charAt(0).toUpperCase()}</span>
      </div>
    );
  }
  if (large) {
    return (
      <div
        className={`flex flex-col justify-between overflow-hidden p-5 text-stone-800 dark:text-stone-100 ${tintFor(title)} ${className}`}
      >
        <span className="font-medium leading-snug line-clamp-4 [overflow-wrap:anywhere] text-xl">{title}</span>
        {author ? (
          <span className="text-stone-500 dark:text-stone-400 line-clamp-2 text-sm">{author}</span>
        ) : null}
      </div>
    );
  }
  // Sized to the tile itself, not the screen: a feed thumbnail gets small
  // type, tight edges and just the title, and words that wrap break
  // between syllables rather than letters
  return (
    <div className={`@container overflow-hidden ${tintFor(title)} ${className}`}>
      <div className="flex h-full flex-col justify-between p-1 @[4rem]:p-2 @[6.5rem]:p-3 text-stone-800 dark:text-stone-100">
        <span
          lang="en"
          className="font-medium leading-tight @[4rem]:leading-snug line-clamp-5 @[4rem]:line-clamp-4 hyphens-auto [overflow-wrap:break-word] text-[9px] @[4rem]:text-[11px] @[6.5rem]:text-xs @[8rem]:text-sm"
        >
          {title}
        </span>
        {author ? (
          <span className="hidden @[4rem]:block">
            <span className="text-stone-500 dark:text-stone-400 line-clamp-2 text-[10px] @[6.5rem]:text-[11px] @[8rem]:text-xs">
              {author}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
