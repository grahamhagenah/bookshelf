import Avatar from "~/components/avatar";

// Each face overlaps the last by about a quarter
const OVERLAP = { "2xs": "-space-x-1", xs: "-space-x-1.5", sm: "-space-x-2", md: "-space-x-2.5" } as const;

// A few people side by side, each overlapping the last: a group, a shared
// shelf. Decorative, since a name or count always sits beside it.
export default function Faces({
  people,
  size = "sm",
  max = 5,
}: {
  people: { id: string; firstname: string; surname: string; profileEmoji: string | null }[];
  size?: keyof typeof OVERLAP;
  max?: number;
}) {
  return (
    <span aria-hidden="true" className={`flex flex-shrink-0 ${OVERLAP[size]}`}>
      {people.slice(0, max).map((person) => (
        // On a solid circle the page's color: the pictures' tints are
        // see-through, and would show the face behind through the overlap.
        // Positioned, like the initials circle inside, so each face is
        // drawn over the one before it rather than initials over pictures
        <span
          key={person.id}
          className="relative rounded-full bg-white ring-2 ring-white dark:bg-stone-950 dark:ring-stone-950"
        >
          <Avatar
            firstname={person.firstname}
            surname={person.surname}
            icon={person.profileEmoji}
            size={size}
          />
        </span>
      ))}
    </span>
  );
}
