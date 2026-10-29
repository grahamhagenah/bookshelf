import { useEffect, useRef, useState } from "react";

// A long passage cut to its first four lines, fading out (cut by height,
// so no ellipsis), with Read more for the rest. Guessed long from its length first (so the server and the
// first paint agree), then measured once it's on screen.
export default function ClampedText({
  id,
  text,
  className = "",
}: {
  id: string;
  text: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(text.length > 320);
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const passage = ref.current;
    if (passage && !open) setLong(passage.scrollHeight > passage.clientHeight + 1);
  }, [open, text]);
  const clipped = long && !open;

  return (
    <>
      <p
        ref={ref}
        id={id}
        className={`max-w-150 whitespace-pre-wrap text-pretty leading-relaxed text-stone-700 dark:text-stone-300 ${
          clipped
            ? "max-h-[6.5em] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
            : ""
        } ${className}`}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={id}
          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-stone-700 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white"
        >
          {open ? "Show less" : "Read more"}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      ) : null}
    </>
  );
}
