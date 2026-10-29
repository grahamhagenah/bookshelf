// A book's first sentence, set the way a novel opens a chapter: the first
// few words in spaced capitals, no quote marks, so it reads as the book
// itself. A small label says what it is, and it's as wide as the
// description under it.
export const openingLineType = "text-xl md:text-[1.375rem] leading-normal";

// Long enough to be a wall at this size
const LONG = 28;

// A long first sentence ends at its first natural pause (a semicolon,
// colon or dash) once it's said enough, with an ellipsis; failing that, at
// a comma. One with no pause in the right place is kept whole.
export function trimOpening(sentence: string) {
  const words = sentence.trim().split(/\s+/);
  if (words.length <= LONG) return sentence.trim();
  const pauseAfter = (marks: RegExp) =>
    words.findIndex((word, index) => index >= 11 && index < 32 && marks.test(word));
  let end = pauseAfter(/[;:—–]$|^[—–]$/);
  if (end < 0) end = pauseAfter(/,$/);
  if (end < 0) return sentence.trim();
  // A dash on its own ends the words before it
  const kept = /^[—–]$/.test(words[end]) ? words.slice(0, end) : words.slice(0, end + 1);
  return `${kept.join(" ").replace(/[\s;:,—–]+$/, "")}…`;
}

// Up to three words, always leaving at least one in ordinary type
function splitLeadIn(sentence: string) {
  const words = sentence.trim().split(/\s+/);
  const count = Math.min(3, words.length - 1);
  return {
    lead: words.slice(0, count).join(" "),
    rest: words.slice(count).join(" "),
  };
}

export default function OpeningLine({ sentence }: { sentence: string }) {
  const { lead, rest } = splitLeadIn(trimOpening(sentence));
  return (
    <section className="mt-10 max-w-150">
      <h2 className="mb-2 text-sm font-semibold text-stone-500 dark:text-stone-400">
        First line
      </h2>
      <p
        className={`${openingLineType} text-pretty text-stone-700 dark:text-stone-300`}
      >
        {lead ? (
          <>
            <span className="text-[0.82em] font-semibold uppercase tracking-[0.07em] text-stone-900 dark:text-stone-100">
              {lead}
            </span>{" "}
          </>
        ) : null}
        {rest}
      </p>
    </section>
  );
}
