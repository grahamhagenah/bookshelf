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
        <span
          key={person.id}
          className="rounded-full ring-2 ring-white dark:ring-stone-950"
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
