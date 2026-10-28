
import { Form, Link, useLocation } from "react-router";

import { SearchIcon } from "./icons";
import SearchBox from "./search-box";

// Search in the header: a box with suggestions on wider screens (beside the
// wordmark), an icon on phones (with the other icons). Hidden on the search
// page, which has its own box.
export default function Search({ as }: { as: "box" | "icon" }) {
  const { pathname } = useLocation();
  if (pathname === "/search") return null;

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
      className="md:hidden inline-flex items-center justify-center w-11 h-11 md:w-9 md:h-9 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:[&_svg]:text-forest-600 dark:hover:[&_svg]:text-forest-400 transition-colors"
    >
      <SearchIcon size={24} />
    </Link>
  );
}
