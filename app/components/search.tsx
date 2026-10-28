
import { Form, Link, useLocation } from "react-router";

import { SearchIcon } from "./icons";
import SearchBox from "./search-box";
import { hereIcon } from "./ui";

// Search in the header: a box with suggestions on wider screens (beside the
// wordmark), an icon on phones (with the other icons). The box steps aside
// on the search page, which has its own; the icon stays, marked as the page
// you're on, so the icons beside it don't shift.
export default function Search({ as }: { as: "box" | "icon" }) {
  const here = useLocation().pathname === "/search";
  if (here && as === "box") return null;

  return as === "box" ? (
    <Form
      method="get"
      action="/search"
      role="search"
      className="hidden md:block w-full max-w-xs lg:max-w-sm"
    >
      <SearchBox variant="header" />
    </Form>
  ) : (
    <Link
      to="/search"
      aria-label="Search books"
      title="Search books"
      aria-current={here ? "page" : undefined}
      className={`md:hidden inline-flex items-center justify-center w-11 h-11 md:w-9 md:h-9 rounded-full transition-colors ${
        here
          ? hereIcon
          : "text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:[&_svg]:text-forest-600 dark:hover:[&_svg]:text-forest-400"
      }`}
    >
      <SearchIcon size={24} />
    </Link>
  );
}
