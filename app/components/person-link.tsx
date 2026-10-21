import { Link } from "@remix-run/react";

// A person's name that opens their bookshelf when they're a friend.
// Anyone else stays plain text, since only friends' shelves can be viewed.
export default function PersonLink({
  id,
  name,
  friendIds,
}: {
  id: string;
  name: string;
  friendIds: string[];
}) {
  if (!friendIds.includes(id)) return <>{name}</>;
  return (
    <Link
      to={`/friend/${id}`}
      className="underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
    >
      {name}
    </Link>
  );
}
