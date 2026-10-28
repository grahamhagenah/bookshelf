import { useState } from "react";

// Filters for one of your lists (Want to read, Also read, History), as the
// shelf has them: All and a few more, each with its count. A filter that
// would show nothing, or the same as All, isn't offered; with nothing left
// to choose between, there are no chips at all.
export interface ListFilter<T> {
  value: string;
  label: string;
  test: (item: T) => boolean;
}

export function useListFilter<T>(items: T[], filters: ListFilter<T>[]) {
  const [value, setValue] = useState("all");
  const options = [
    { value: "all", label: "All", count: items.length },
    ...filters.map(({ value, label, test }) => ({
      value,
      label,
      count: items.filter(test).length,
    })),
  ].filter(
    ({ value, count }) =>
      value === "all" || (count > 0 && count < items.length),
  );
  // One that's no longer offered (the last of its books went) falls back
  const active = options.some((option) => option.value === value)
    ? value
    : "all";
  const test = filters.find((filter) => filter.value === active)?.test;

  const chips =
    options.length > 1 ? (
      <div
        className="flex gap-1.5 overflow-x-auto min-w-0 [scrollbar-width:none]"
        role="group"
        aria-label="Show"
      >
        {options.map(({ value, label, count }) => (
          <button
            key={value}
            type="button"
            aria-pressed={active === value}
            onClick={() => setValue(value)}
            className={`flex-shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-sm transition-colors ${
              active === value
                ? "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:text-stone-800 dark:hover:text-stone-200"
            }`}
          >
            {label}
            <span className="ml-1.5 font-normal text-stone-400 dark:text-stone-500">
              {count}
            </span>
          </button>
        ))}
      </div>
    ) : null;

  return { shown: test ? items.filter(test) : items, chips };
}
