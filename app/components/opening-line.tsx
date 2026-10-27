// A book's first sentence, set large in the serif with no label over it:
// it speaks for itself. The heading is there for screen readers only.
export const openingLineType =
  "font-serif text-xl md:text-2xl font-semibold italic leading-snug";

export default function OpeningLine({ sentence }: { sentence: string }) {
  return (
    <section className="mt-10 max-w-prose">
      <h2 className="sr-only">Opening line</h2>
      {/* The opening quote mark hangs in the margin, so the words line up;
          phones have no margin to spare */}
      <blockquote
        className={`${openingLineType} md:-indent-[0.4em] text-pretty text-stone-700 dark:text-stone-300`}
      >
        “{sentence}”
      </blockquote>
    </section>
  );
}
