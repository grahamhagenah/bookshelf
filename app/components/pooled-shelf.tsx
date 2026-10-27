import { useEffect, useRef, useState } from "react";
import { Form, Link, NavLink, useNavigate, useNavigation, useSearchParams, useSubmit } from "react-router";

import { LentIcon, SearchIcon } from "~/components/icons";
import { GRIDS, GridCover } from "~/components/library";
import type { PoolWork } from "~/models/pool.server";
import type { loadPooledShelf } from "~/pooled-shelf.server";
import { coverSizeOf, libraryViewOf, useOptionalUser } from "~/utils";

// Many people's books as one shelf, looking like My shelf: a filter bar,
// then one entry per book with whoever has it. Until you search or
// filter, books from your want-to-read list come first. A group's Shelf
// tab and your friends' books are both this.

type ShelfWork = PoolWork;

// "Maya", "Maya and Sam", "Maya, Sam and 4 others"
function whoHasIt(work: ShelfWork) {
  const names = [...new Set(work.copies.map((copy) => copy.owner.firstname))];
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const others = names.length - 2;
  return `${names[0]}, ${names[1]} and ${others} ${others === 1 ? "other" : "others"}`;
}

// Where the book stands, as My shelf tags a cover: nothing when a copy's
// free, else whether they're all out or held back
function standing(work: ShelfWork) {
  if (work.copies.some((copy) => copy.available)) return null;
  return work.copies.some((copy) => copy.lent) ? "Lent out" : "Not lending";
}

const control =
  "h-8 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 pl-2.5 pr-7 text-sm text-stone-700 dark:text-stone-200 focus:outline-none focus:border-stone-400";

export type PooledShelfData = Awaited<ReturnType<typeof loadPooledShelf>>;

export default function PooledShelf({
  data: { search, results, wanted, lenders, groups, group, pageSize },
  empty,
}: {
  data: PooledShelfData;
  // What to say when nobody's added a book yet
  empty: React.ReactNode;
}) {
  const viewer = useOptionalUser();
  const viewMode = libraryViewOf(viewer);
  const grid = GRIDS[coverSizeOf(viewer)];
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const submit = useSubmit();
  const loading = useNavigation().state === "loading";

  // The filter box keeps what's typed while results load; Clear, or going
  // back, puts the address's in
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const [text, setText] = useState(search.q);
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setText(search.q);
  }, [search.q]);

  // This page's address with some filters changed; Show more starts over
  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    next.delete("shown");
    next.delete("joined");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    return query ? `?${query}` : "?";
  };
  const go = (changes: Record<string, string | null>) =>
    navigate(hrefWith(changes), { replace: true, preventScrollReset: true });

  if (results.counts.all === 0 && !search.filtered) {
    return (
      <section className="rounded-xl border border-stone-200 dark:border-stone-800 px-6 py-12 text-center">
        {empty}
      </section>
    );
  }

  const statuses = (
    [
      ["all", "All", results.counts.all],
      ["available", "Available", results.counts.available],
      ["lent", "Lent out", results.counts.lent],
    ] as const
  ).filter(([value, , n]) => value === "all" || value === search.status || (n > 0 && n < results.counts.all));

  // Whose books is only offered when there's a choice to make
  const pickWho = lenders.length > 1 || groups.length > 0;

  return (
    <>
      {/* As My shelf's filter bar: find, narrow and order, in one line on
          wider screens. On phones the search takes the top line (beside
          the sort menu when it's the only one), the two menus split the
          next line evenly, and the pills get a line of their own. */}
      <div className="mb-6 flex flex-wrap md:flex-nowrap items-center gap-2">
        <Form
          ref={formRef}
          method="get"
          role="search"
          className={`relative min-w-0 md:w-56 md:flex-none ${pickWho ? "w-full" : "flex-1"}`}
          onChange={() => {
            clearTimeout(timer.current);
            timer.current = setTimeout(
              () => submit(formRef.current, { replace: true, preventScrollReset: true }),
              300,
            );
          }}
        >
          <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400">
            <SearchIcon size={14} />
          </div>
          <input
            ref={inputRef}
            type="search"
            name="q"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Filter books"
            aria-label="Filter by title or author"
            autoComplete="off"
            className="h-8 w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 pl-8 pr-2 text-sm placeholder:text-stone-400 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10"
          />
          {search.who ? <input type="hidden" name="who" value={search.who} /> : null}
          {search.status !== "all" ? <input type="hidden" name="status" value={search.status} /> : null}
          {search.sort !== "newest" ? <input type="hidden" name="sort" value={search.sort} /> : null}
        </Form>
        {statuses.length > 1 ? (
          <div
            className="order-last w-full md:order-none md:w-auto flex gap-1.5 overflow-x-auto min-w-0 [scrollbar-width:none]"
            role="group"
            aria-label="Show"
          >
            {statuses.map(([value, label, n]) => (
              <Link
                key={value}
                to={hrefWith({ status: value === "all" ? null : value })}
                replace
                preventScrollReset
                aria-pressed={search.status === value}
                className={`flex-shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-sm transition-colors ${
                  search.status === value
                    ? "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                    : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:text-stone-800 dark:hover:text-stone-200"
                }`}
              >
                {label}
                <span className="ml-1.5 font-normal text-stone-400 dark:text-stone-500">{n}</span>
              </Link>
            ))}
          </div>
        ) : null}
        <div
          className={`flex items-center gap-2 md:ml-auto md:w-auto md:flex-shrink-0 ${
            pickWho ? "w-full" : "flex-shrink-0"
          }`}
        >
          {pickWho ? (
            <Select
              grow
              label="Whose books"
              value={search.who ?? ""}
              onChange={(value) => go({ who: value || null })}
              options={[
                ["", "Everyone"],
                ...(groups.length > 0
                  ? [{ section: "Groups", options: groups.map((g) => [`g:${g.id}`, g.name] as const) }]
                  : []),
                ...(lenders.length > 1
                  ? [
                      {
                        section: "People",
                        options: lenders.map((m) => [m.id, `${m.firstname} ${m.surname}`] as const),
                      },
                    ]
                  : []),
              ]}
            />
          ) : null}
          <Select
            grow={pickWho}
            label="Sort"
            value={search.sort}
            onChange={(value) => go({ sort: value === "newest" ? null : value })}
            options={[
              ["newest", "Newest"],
              ["title", "Title"],
              ["author", "Author"],
            ]}
          />
        </div>
      </div>

      {/* Narrowed to a group: say so, with the way to its page */}
      {group ? (
        <p className="-mt-2 mb-6 text-sm text-stone-500 dark:text-stone-400">
          Just {group.name}.{" "}
          <Link
            to={group.path}
            className="text-stone-700 dark:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-white"
          >
            Go to the group
          </Link>
        </p>
      ) : null}

      {wanted.length > 0 ? (
        <section aria-labelledby="wanted" className="mb-8">
          <h2 id="wanted" className="mb-3 text-sm font-medium text-stone-500 dark:text-stone-400">
            From your want-to-read list
          </h2>
          <Shelf works={wanted} grid={grid} viewMode={viewMode} />
        </section>
      ) : null}

      <div className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
        {wanted.length > 0 ? (
          <h2 className="mb-3 text-sm font-medium text-stone-500 dark:text-stone-400">Everything</h2>
        ) : null}
        {results.works.length === 0 ? (
          <div className="py-16 text-center text-stone-500 dark:text-stone-400">
            <p>No books match.</p>
            <Link
              to="?"
              replace
              preventScrollReset
              className="mt-2 inline-block text-sm text-stone-700 dark:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600"
            >
              Clear filters
            </Link>
          </div>
        ) : (
          <Shelf works={results.works} grid={grid} viewMode={viewMode} />
        )}
        {results.total > results.works.length ? (
          <div className="mt-8 text-center">
            <Link
              to={hrefWith({ shown: String(search.shown + pageSize) })}
              replace
              preventScrollReset
              className="inline-flex h-8 items-center rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
            >
              Show more
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
}

// A small menu, styled as My shelf's controls
function Select({
  label,
  value,
  onChange,
  options,
  grow = false,
}: {
  label: string;
  // On phones, take an even share of the line
  grow?: boolean;
  value: string;
  onChange: (value: string) => void;
  // Choices, some of them under a heading of their own
  options: readonly (
    | readonly [string, string]
    | { section: string; options: readonly (readonly [string, string])[] }
  )[];
}) {
  const option = ([optionValue, optionLabel]: readonly [string, string]) => (
    <option key={optionValue} value={optionValue}>
      {optionLabel}
    </option>
  );
  return (
    <span className={`relative ${grow ? "min-w-0 flex-1 md:flex-none" : ""}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${control} appearance-none truncate ${grow ? "w-full md:w-auto" : ""} md:max-w-[11rem]`}
      >
        {options.map((entry) =>
          "section" in entry ? (
            <optgroup key={entry.section} label={entry.section}>
              {entry.options.map(option)}
            </optgroup>
          ) : (
            option(entry)
          ),
        )}
      </select>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}

// My shelf's grid (or list, by the same setting), one entry per book. It
// opens the copy you could borrow soonest.
function Shelf({
  works,
  grid,
  viewMode,
}: {
  works: ShelfWork[];
  grid: (typeof GRIDS)[keyof typeof GRIDS];
  viewMode: string;
}) {
  if (viewMode === "list") {
    return (
      <ol className="border-t border-stone-100 dark:border-stone-800">
        {works.map((work) => {
          const tag = standing(work);
          return (
            <li key={work.key} className="border-b border-stone-100 dark:border-stone-800">
              <NavLink
                to={`/books/${work.copies[0].bookId}`}
                className="flex items-center gap-3 px-2 py-2.5 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
              >
                <div className="min-w-0 flex-grow">
                  <span className="font-medium text-stone-900 dark:text-stone-100">{work.title}</span>
                  <span className="text-stone-400 dark:text-stone-500"> · </span>
                  <span className="text-stone-500 dark:text-stone-400">{work.author}</span>
                </div>
                <span className="flex-shrink-0 truncate text-sm text-stone-500 dark:text-stone-400">{whoHasIt(work)}</span>
                {tag ? (
                  <span className="flex-shrink-0 rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-1 text-xs text-stone-600 dark:text-stone-300">
                    {tag}
                  </span>
                ) : null}
              </NavLink>
            </li>
          );
        })}
      </ol>
    );
  }
  return (
    <ol className={`grid gap-3 sm:gap-4 ${grid.columns}`}>
      {works.map((work, index) => {
        const tag = standing(work);
        return (
          <li key={work.key}>
            <NavLink to={`/books/${work.copies[0].bookId}`} className="group block">
              <div className="relative">
                <GridCover
                  cover={work.cover}
                  eager={index < 7}
                  sizes={grid.sizes}
                  title={work.title}
                  author={work.author}
                  className="w-full aspect-[2/3] transition-opacity duration-200 group-hover:opacity-90"
                />
                {tag ? (
                  <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-white/95 dark:bg-stone-950/90 px-1.5 py-0.5 text-[11px] leading-4 text-stone-700 dark:text-stone-200 shadow-sm">
                    {tag === "Lent out" ? <LentIcon size={11} /> : null}
                    {tag}
                  </span>
                ) : null}
              </div>
              <span className="mt-1.5 block truncate text-sm text-stone-700 dark:text-stone-300">{work.title}</span>
              <span className="mt-0.5 block truncate text-xs text-stone-400 dark:text-stone-500">{whoHasIt(work)}</span>
            </NavLink>
          </li>
        );
      })}
    </ol>
  );
}
