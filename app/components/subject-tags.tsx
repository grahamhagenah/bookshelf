// What a book is about, as small square-cornered tags under the author,
// rather than a run of words in the line by the title
export default function SubjectTags({
  subjects,
  title,
  className = "",
}: {
  subjects: string[];
  // The book's own title, which Open Library sometimes lists as a subject
  title?: string | null;
  className?: string;
}) {
  const shown = subjects.filter(
    (subject) => subject.toLowerCase() !== title?.trim().toLowerCase(),
  );
  if (shown.length === 0) return null;
  return (
    <ul aria-label="Subjects" className={`flex flex-wrap gap-1.5 ${className}`}>
      {shown.map((subject) => (
        <li
          key={subject}
          className="rounded border border-stone-200 dark:border-stone-700 px-2 py-0.5 text-xs text-stone-600 dark:text-stone-300"
        >
          {subject}
        </li>
      ))}
    </ul>
  );
}
