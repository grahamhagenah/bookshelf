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
}: {
  title: string;
  author?: string | null;
  className?: string;
  large?: boolean;
}) {
  return (
    <div
      className={`flex flex-col justify-between overflow-hidden rounded-lg text-stone-800 dark:text-stone-100 ${tintFor(title)} ${
        large ? "p-5" : "p-2.5 sm:p-3"
      } ${className}`}
    >
      <span className={`font-medium leading-snug line-clamp-4 ${large ? "text-xl" : "text-xs sm:text-sm"}`}>{title}</span>
      {author ? (
        <span className={`text-stone-500 dark:text-stone-400 line-clamp-2 ${large ? "text-sm" : "text-[11px] sm:text-xs"}`}>
          {author}
        </span>
      ) : null}
    </div>
  );
}
