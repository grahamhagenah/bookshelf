import { Link } from "react-router";

// One of your lists with nothing in it yet: what it's for, and the way to
// start it. Once there's something in it, the page says what it's for in
// a line at the top instead.
export default function EmptyList({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  // What the list is for, and how things get into it
  children: React.ReactNode;
  action?: { to: string; label: string };
}) {
  return (
    <div className="mt-10 flex flex-col items-center py-10 text-center">
      <span className="text-stone-300 dark:text-stone-600">{icon}</span>
      <h2 className="mt-3 font-semibold text-stone-800 dark:text-stone-200">
        {title}
      </h2>
      <p className="mt-1 max-w-sm text-pretty text-sm text-stone-500 dark:text-stone-400">
        {children}
      </p>
      {action ? (
        <Link
          to={action.to}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
        >
          <span
            aria-hidden="true"
            className="text-base leading-none text-stone-400 dark:text-stone-500"
          >
            +
          </span>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
