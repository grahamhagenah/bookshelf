import { useFetcher, useNavigate } from "@remix-run/react";
import { useEffect, useId, useRef, useState } from "react";

import type { SuggestResponse } from "~/routes/api.search-suggest";

import { SearchIcon } from "./icons";


type Option =
  | {
      kind: "friend";
      id: string;
      title: string;
      author: string;
      owner: string;
      available: boolean;
    }
  | { kind: "openLibrary"; title: string; author: string | null }
  | { kind: "search"; text: string };

const DEBOUNCE_MS = 200;

// The search field with suggestions as you type. Picking a friend's book
// opens it; picking an Open Library title searches for it. The "header"
// variant is compact, starts a fresh search and clears itself after a pick.
export default function SearchBox({
  defaultValue = "",
  variant = "page",
}: {
  defaultValue?: string;
  variant?: "page" | "header";
}) {
  const inHeader = variant === "header";
  const friendsFetcher = useFetcher<SuggestResponse>();
  const openLibraryFetcher = useFetcher<SuggestResponse>();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Keep the box in step with back/forward navigation
  useEffect(() => setValue(defaultValue), [defaultValue]);

  const query = value.trim();
  useEffect(() => {
    if (!open || query.length < 2) return;
    const timer = setTimeout(() => {
      const q = encodeURIComponent(query);
      friendsFetcher.load(`/api/search-suggest?q=${q}`);
      openLibraryFetcher.load(`/api/search-suggest?q=${q}&source=openLibrary`);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // fetcher.load is stable enough here; re-running on the fetchers would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  // Only show suggestions that belong to what's in the box now
  const friends =
    friendsFetcher.data?.query === query ? friendsFetcher.data.friends : null;
  const openLibrary =
    openLibraryFetcher.data?.query === query
      ? openLibraryFetcher.data.openLibrary
      : null;
  const options: Option[] = [
    ...(friends ?? []).map((book) => ({
      kind: "friend" as const,
      ...book,
    })),
    ...(openLibrary ?? []).map((book) => ({
      kind: "openLibrary" as const,
      ...book,
    })),
    ...(query.length >= 2 ? [{ kind: "search" as const, text: query }] : []),
  ];
  const showList = open && query.length >= 2;

  const runSearch = (text: string) => {
    setOpen(false);
    // On the search page, keep the Open Library filters; elsewhere start fresh
    const params = new URLSearchParams(inHeader ? "" : window.location.search);
    params.set("q", text);
    params.delete("page");
    navigate(`/search?${params.toString()}`);
  };

  const choose = (option: Option) => {
    if (option.kind === "friend") {
      setOpen(false);
      navigate(`/books/${option.id}`);
    } else if (option.kind === "openLibrary") {
      setValue(option.title);
      runSearch(option.title);
    } else {
      runSearch(option.text);
    }
    if (inHeader) setValue("");
    inputRef.current?.blur();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? options.length - 1 : index - 1));
    } else if (event.key === "Enter" && active >= 0 && options[active]) {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
      if (inHeader) inputRef.current?.blur();
    }
  };

  const optionId = (index: number) => `${listId}-option-${index}`;
  const firstOpenLibrary = options.findIndex((o) => o.kind === "openLibrary");
  // Open Library is the slow one; say so while it's still on its way
  const isLoading = !openLibrary && openLibraryFetcher.state === "loading";

  return (
    <div className="relative flex-1">
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
        <SearchIcon size={inHeader ? 16 : 18} />
      </div>
      <input
        ref={inputRef}
        type="text"
        name="q"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={inHeader ? "Search books" : "Search by title or author"}
        aria-label={inHeader ? "Search books" : "Search by title or author"}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        className={`w-full rounded-md border border-stone-200 dark:border-stone-700 dark:bg-stone-900 placeholder:text-stone-400 ${
          inHeader
            ? "h-9 pl-9 pr-3 text-sm bg-stone-50 focus:bg-white"
            : "pl-10 pr-4 py-2.5 text-base bg-white"
        } focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors`}
      />

      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          // In the header the box is narrow, so the list is wider than it
          className={`absolute top-full z-30 mt-1 overflow-hidden ${
            inHeader ? "right-0 w-[min(26rem,calc(100vw-2rem))]" : "left-0 right-0"
          } rounded-lg border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 py-1 shadow-soft text-left`}
          // Keep focus in the input so a click registers before blur closes it
          onMouseDown={(event) => event.preventDefault()}
        >
          {options.map((option, index) => {
            const heading =
              index === 0 && option.kind === "friend"
                ? "On your friends' shelves"
                : index === firstOpenLibrary
                  ? "From Open Library"
                  : null;
            return (
              <li key={optionId(index)} role="presentation">
                {heading ? (
                  <p
                    className={`px-3 pb-1 text-xs font-semibold text-stone-400 dark:text-stone-500 ${index > 0 ? "pt-2" : "pt-1"}`}
                  >
                    {heading}
                  </p>
                ) : null}
                <div
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  tabIndex={-1}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  onKeyDown={() => undefined}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${
                    index === active ? "bg-stone-100 dark:bg-stone-800" : ""
                  } ${option.kind === "search" ? "border-t border-stone-100 dark:border-stone-800 mt-1" : ""}`}
                >
                  {option.kind === "search" ? (
                    <span className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                      <SearchIcon size={14} className="text-stone-400" />
                      Search for &ldquo;{option.text}&rdquo;
                    </span>
                  ) : (
                    <>
                      <span className="min-w-0 truncate">
                        <span className="text-stone-900 dark:text-stone-100">
                          {option.title}
                        </span>
                        {option.author ? (
                          <span className="text-stone-400 dark:text-stone-500">
                            {" "}
                            · {option.author}
                          </span>
                        ) : null}
                      </span>
                      {option.kind === "friend" ? (
                        <span className="flex-shrink-0 text-xs text-stone-400 dark:text-stone-500">
                          {option.owner}
                          {option.available ? "" : " · lent out"}
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
              </li>
            );
          })}
          {isLoading ? (
            <li
              role="presentation"
              className="px-3 py-2 text-xs text-stone-400 dark:text-stone-500"
            >
              Looking on Open Library…
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
