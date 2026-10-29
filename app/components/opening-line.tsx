// A book's first sentence, in the serif a printed page would use, behind a
// hanging quote mark: the book speaking, not the app. No label; the mark
// says what it is. As wide as the description under it.
export const openingLineType = "font-serif text-lg md:text-xl leading-relaxed";

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

// Some editions set their first words in capitals (SIR WALTER ELLIOT, of
// Kellynch Hall); in a quote they'd shout, so they get ordinary capitals
export function calmCapitals(sentence: string) {
  return sentence.replace(/^(?:[A-Z][A-Z'’.-]+[\s,]+)+/, (lead) =>
    lead.replace(/[A-Z][A-Z'’.-]+/g, (word) => word[0] + word.slice(1).toLowerCase()),
  );
}

export default function OpeningLine({ sentence }: { sentence: string }) {
  return (
    <section className="relative mt-10 max-w-150 pl-7 md:pl-8">
      <h2 className="sr-only">First line</h2>
      {/* The quote mark hangs in the margin and says what this is */}
      <span
        aria-hidden="true"
        className="absolute left-0 -top-2 font-serif text-5xl leading-none text-stone-300 dark:text-stone-600"
      >
        &ldquo;
      </span>
      <p
        className={`${openingLineType} text-pretty text-stone-500 dark:text-stone-400`}
      >
        {calmCapitals(trimOpening(sentence))}
      </p>
    </section>
  );
}
