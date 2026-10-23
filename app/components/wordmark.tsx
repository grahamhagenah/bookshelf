// The wordmark: the name in the serif, with a small green book under the
// capital S and a little air between them. The book is sized in ems from
// the S glyph, so it follows whatever font size it's given, and it sits
// inside the descender space, so it adds no height to the line.
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif ${className}`}>
      <span className="relative">
        S
        <span
          aria-hidden="true"
          className="absolute left-[0.03em] bottom-[0.133em] h-[0.12em] w-[0.5em] rounded-[1px] bg-forest-600 dark:bg-forest-400"
        />
      </span>
      tacks
    </span>
  );
}
