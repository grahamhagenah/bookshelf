import Avatar from "~/components/avatar";

// A few people side by side, each overlapping the last, for a group
export default function Faces({
  people,
  size = "sm",
  max = 5,
}: {
  people: { id: string; firstname: string; surname: string; profileEmoji: string | null }[];
  size?: "sm" | "md";
  max?: number;
}) {
  return (
    <span className="flex -space-x-2">
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
