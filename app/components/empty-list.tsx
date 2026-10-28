import { isValidElement } from "react";
import { Link } from "react-router";

import { SearchIcon } from "./icons";

// A list or page with nothing in it yet, the same way everywhere: a quiet
// icon, what it's for, and at most one way to start it. Once there's
// something in it, the page says what it's for in a line at the top
// instead.
export default function EmptyList({
  icon,
  title,
  children,
  action,
  heading: Heading = "h2",
  className = "mt-10",
}: {
  icon: React.ReactNode;
  title: string;
  // What the list is for, and how things get into it
  children: React.ReactNode;
  // A link (with a + when it adds something, a magnifying glass when it
  // goes looking), or a control of the page's own, like a form
  action?: { to: string; label: string; plus?: boolean; search?: boolean } | React.ReactElement;
  // The page's own heading, where nothing else on the page has one
  heading?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center py-10 text-center ${className}`}>
      <span className="text-stone-300 dark:text-stone-600">{icon}</span>
      <Heading className="mt-3 font-semibold text-stone-800 dark:text-stone-200">
        {title}
      </Heading>
      <p className="mt-1 max-w-sm text-pretty text-sm text-stone-500 dark:text-stone-400">
        {children}
      </p>
      {isValidElement(action) ? (
        <div className="mt-4 flex w-full justify-center">{action}</div>
      ) : action ? (
        <Link
          to={action.to}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
        >
          {action.search ? (
            <SearchIcon size={14} className="text-stone-400 dark:text-stone-500" />
          ) : action.plus ? (
            <span
              aria-hidden="true"
              className="text-base leading-none text-stone-400 dark:text-stone-500"
            >
              +
            </span>
          ) : null}
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
