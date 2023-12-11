import { Link } from "@remix-run/react";

export default function BookIndexPage() {
  return (
    <p>
      No book selected. Select a book on the left, or{" "}
      <Link to="new" className="text-blue-500 underline">
        create a new book.
      </Link>
    </p>
  );
}
