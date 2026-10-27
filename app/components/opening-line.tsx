// A book's first sentence, set the way a novel opens a chapter: the first
// few words in spaced capitals, no label and no quote marks, so it reads as
// the book itself. The heading is there for screen readers only.
export const openingLineType = "text-xl md:text-[1.375rem] leading-normal";

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
  const { lead, rest } = splitLeadIn(sentence);
  return (
    <section className="mt-10 max-w-prose">
      <h2 className="sr-only">Opening line</h2>
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
