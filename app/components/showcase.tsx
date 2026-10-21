import { coverSrc } from "~/utils";

import { BorrowedIcon, HeartIcon, LentIcon } from "./icons";

// A staged glimpse of the app for the landing page: cards styled like the
// real ones, tilted and overlapping, showing how lending works (what's
// due, choosing a loan length, a reminder sent). Decorative, so hidden
// from screen readers.

const cover = (isbn: string) =>
  coverSrc(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`);

const COVERS = {
  stationEleven: cover("9780804172448"),
  gilead: cover("9780312424404"),
  hobbit: cover("9780547928227"),
  klara: cover("9780593318171"),
};

const panel =
  "absolute rounded-lg bg-white dark:bg-stone-900 shadow-soft ring-1 ring-stone-900/5 dark:ring-white/10";

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[480px] w-full max-w-[420px] select-none sm:h-[505px]"
    >
      {children}
    </div>
  );
}

function Heart({ size = 12 }: { size?: number }) {
  return (
    <HeartIcon size={size} filled className="inline align-[-1px] text-rose-400" />
  );
}

function Cover({ src, className = "" }: { src: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      className={`aspect-[2/3] rounded-xs object-cover ring-1 ring-stone-900/5 ${className}`}
    />
  );
}

interface CardBook {
  title: string;
  cover: string;
  status?: "lent" | "borrowed" | "available";
  hearts?: number;
  className: string;
}

// A book as it appears in the library grid
function BookCard({ book, width = "w-[34%]" }: { book: CardBook; width?: string }) {
  return (
    <div className={`${panel} ${width} p-2 ${book.className}`}>
      <Cover src={book.cover} className="w-full" />
      <p className="mt-1.5 truncate text-xs text-stone-700 dark:text-stone-300">
        {book.title}
      </p>
      <p className="mt-0.5 flex h-4 items-center justify-between gap-1 text-[11px]">
        {book.status === "lent" ? (
          <span className="inline-flex items-center gap-1 text-stone-500 dark:text-stone-400">
            <LentIcon size={11} />
            Lent out
          </span>
        ) : book.status === "available" ? (
          <span className="inline-flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
            <span className="h-1.5 w-1.5 rounded-full bg-stone-400 dark:bg-stone-500" />
            Available
          </span>
        ) : book.status === "borrowed" ? (
          <span className="inline-flex items-center gap-1 font-medium text-stone-900 dark:text-stone-100">
            <BorrowedIcon size={11} />
            Borrowed
          </span>
        ) : (
          <span />
        )}
        {book.hearts ? (
          <span className="inline-flex items-center gap-1 text-stone-400 dark:text-stone-500">
            <Heart size={10} />
            {book.hearts}
          </span>
        ) : null}
      </p>
    </div>
  );
}

// A small dark label, stuck on at an angle
function Tag({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span
      className={`absolute z-30 rounded-md bg-stone-900 px-2 py-1 text-[11px] font-medium text-white shadow-soft dark:bg-stone-100 dark:text-stone-900 ${className}`}
    >
      {children}
    </span>
  );
}

function Check() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function ShowcaseLending() {
  return (
    <Stage>
      {/* What's due, both ways */}
      <div className={`${panel} left-0 right-[10%] top-0 z-30 -rotate-1 p-3.5`}>
        <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">Coming up</p>
        <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-300">
          <span className="font-semibold text-stone-900 dark:text-stone-100">Station Eleven</span>{" "}
          is with Priya Patel ·{" "}
          <span className="font-semibold text-stone-900 dark:text-stone-100">3 days late</span>
        </p>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          <span className="font-semibold text-stone-900 dark:text-stone-100">Gilead</span> goes
          back to Maya Chen · tomorrow
        </p>
      </div>

      {[
        {
          title: "Station Eleven",
          cover: COVERS.stationEleven,
          status: "lent" as const,
          hearts: 2,
          className: "left-[2%] top-[27%] sm:top-[23%] -rotate-3",
        },
        {
          title: "Gilead",
          cover: COVERS.gilead,
          status: "borrowed" as const,
          className: "left-[34%] top-[30%] sm:top-[26%] z-10 rotate-2",
        },
        {
          title: "The Hobbit",
          cover: COVERS.hobbit,
          status: "available" as const,
          hearts: 4,
          className: "right-0 top-[25%] sm:top-[21%] rotate-6",
        },
      ].map((book) => (
        <BookCard key={book.title} book={book} width="w-[32%]" />
      ))}

      <Tag className="right-[-2%] top-[24%] rotate-[9deg] sm:top-[20%]">Lent 6 times</Tag>

      {/* Choosing how long to lend for */}
      <div className={`${panel} bottom-[8%] left-[6%] right-[14%] z-20 rotate-1 p-3.5`}>
        <div className="flex items-center gap-3">
          <Cover src={COVERS.klara} className="w-8" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-stone-800 dark:text-stone-200">
              Lend <span className="font-semibold">Klara and the Sun</span> to Sam
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-stone-200 dark:border-stone-700 px-2 py-0.5 text-xs text-stone-700 dark:text-stone-200">
                4 weeks
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
              <span className="rounded-md bg-stone-700 dark:bg-stone-200 px-2 py-0.5 text-xs font-medium text-white dark:text-stone-900">
                Lend it
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* A nudge already on its way */}
      <div className="absolute bottom-0 right-[2%] z-30 flex -rotate-2 items-center gap-2 rounded-full bg-stone-900 dark:bg-stone-100 px-3.5 py-2 text-xs font-medium text-white dark:text-stone-900 shadow-soft">
        <Check />
        Reminder sent to Priya
      </div>
    </Stage>
  );
}
