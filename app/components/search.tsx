import { Form, useLocation } from "@remix-run/react";

import { SearchIcon } from "./icons";
import SearchBox from "./search-box";

// Search in the header: a box with suggestions on wider screens, an icon on
// phones. Hidden on the search page, which has its own box.
export default function Search() {
  const { pathname } = useLocation();
  if (pathname === "/search") return null;

  return (
    <>
      <Form
        method="get"
        action="/search"
        role="search"
        className="hidden md:block w-48 lg:w-56"
      >
        <SearchBox variant="header" />
      </Form>
      <a
        href="/search"
        aria-label="Search books"
        title="Search books"
        className="md:hidden inline-flex items-center justify-center w-11 h-11 md:w-9 md:h-9 rounded-full text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
      >
        <SearchIcon size={20} />
      </a>
    </>
  );
}
