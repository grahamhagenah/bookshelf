import { coverSrc } from "~/utils";

import { BorrowedIcon, HeartIcon, LentIcon, SearchIcon } from "./icons";

// Staged glimpses of the app for the landing page: cards styled like the
// real ones, tilted and overlapping. The default export, about lending,
// sits beside the headline; the others illustrate the sections below.
// Decorative, so hidden from screen readers.

const cover = (isbn: string) =>
  coverSrc(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`);

const COVERS = {
  stationEleven: cover("9780804172448"),
  gilead: cover("9780312424404"),
  hobbit: cover("9780547928227"),
  klara: cover("9780593318171"),
  neverLetMeGo: cover("9781400078776"),
  jonathanStrange: cover("9780765356154"),
  midnightLibrary: cover("9780525559474"),
  anxiousPeople: cover("9781501160837"),
  hailMary: cover("9780593135204"),
  piranesi: cover("9781635575637"),
  circe: cover("9780316556347"),
  dune: cover("9780441172719"),
};

const panel =
  "absolute rounded-lg bg-white dark:bg-stone-900 shadow-soft ring-1 ring-stone-900/5 dark:ring-white/10";

function Stage({
  children,
  height = "h-[480px] sm:h-[505px]",
}: {
  children: React.ReactNode;
  height?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative mx-auto w-full max-w-[420px] select-none ${height}`}
    >
      {children}
    </div>
  );
}

function Initials({ text, small = false }: { text: string; small?: boolean }) {
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 font-semibold text-stone-700 dark:text-stone-200 ${
        small ? "h-7 w-7 text-[10px] ring-2 ring-white dark:ring-stone-900" : "h-8 w-8 text-xs"
      }`}
    >
      {text}
    </span>
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
              <span className="rounded-md bg-forest-600 dark:bg-forest-500 px-2 py-0.5 text-xs font-medium text-white">
                Lend it
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* A nudge already on its way */}
      <div className="absolute bottom-0 right-[2%] z-30 flex -rotate-2 items-center gap-2 rounded-full bg-stone-900 dark:bg-stone-100 px-3.5 py-2 text-xs font-medium text-white shadow-soft">
        <Check />
        Reminder sent to Priya
      </div>
    </Stage>
  );
}

// Search across friends' shelves, and browse one of them
export function ShowcaseFriends() {
  return (
    <Stage height="h-[450px] sm:h-[470px]">
      <div className={`${panel} left-[3%] right-0 top-0 z-30 rotate-1 p-3`}>
        <div className="flex h-8 items-center gap-2 rounded-md bg-stone-100 dark:bg-stone-800 px-2.5 text-sm text-stone-800 dark:text-stone-200">
          <SearchIcon size={14} />
          ishiguro
          <span className="-ml-1.5 h-4 w-px bg-stone-500" />
        </div>
        <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          On your friends&apos; shelves
        </p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <Cover src={COVERS.neverLetMeGo} className="w-7" />
          <p className="min-w-0 flex-1 text-sm leading-tight text-stone-800 dark:text-stone-200">
            <span className="font-medium">Never Let Me Go</span>
            <span className="block text-xs text-stone-500 dark:text-stone-400">Priya Patel</span>
          </p>
          <span className="rounded-md bg-forest-600 dark:bg-forest-500 px-2 py-0.5 text-xs font-medium text-white">
            Ask to borrow
          </span>
        </div>
        <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
          Add to your shelf
        </p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <Cover src={COVERS.klara} className="w-7" />
          <p className="min-w-0 flex-1 text-sm leading-tight text-stone-800 dark:text-stone-200">
            <span className="font-medium">Klara and the Sun</span>
            <span className="block text-xs text-stone-500 dark:text-stone-400">2021</span>
          </p>
          <span className="rounded-md border border-stone-200 dark:border-stone-700 px-2 py-0.5 text-xs text-stone-700 dark:text-stone-200">
            + Add
          </span>
        </div>
      </div>

      <div className={`${panel} left-0 right-[7%] top-[46%] z-20 -rotate-2 p-3.5`}>
        <div className="flex items-center gap-2.5">
          <Initials text="PP" />
          <p className="text-sm text-stone-800 dark:text-stone-200">
            <span className="font-semibold">Priya Patel&apos;s shelf</span>
            <span className="text-stone-500 dark:text-stone-400"> · 5 books</span>
          </p>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[COVERS.jonathanStrange, COVERS.midnightLibrary, COVERS.neverLetMeGo, COVERS.anxiousPeople].map(
            (src) => (
              <Cover key={src} src={src} className="w-full" />
            ),
          )}
        </div>
      </div>

      <div className="absolute bottom-0 right-0 z-30 flex rotate-2 items-center gap-2 rounded-full bg-stone-900 dark:bg-stone-100 px-3.5 py-2 text-xs font-medium text-white shadow-soft">
        <Check />
        Asked Priya for Never Let Me Go
      </div>
    </Stage>
  );
}

// Hearts, notes, and where a copy has been
export function ShowcaseNotes() {
  return (
    <Stage height="h-[410px] sm:h-[470px]">
      <BookCard
        width="w-[46%]"
        book={{
          title: "Project Hail Mary",
          cover: COVERS.hailMary,
          hearts: 5,
          className: "left-[2%] top-[4%] -rotate-3",
        }}
      />

      <span className="absolute left-[30%] top-0 z-30 inline-flex rotate-6 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm text-rose-700 shadow-soft dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
        <HeartIcon size={14} filled className="text-rose-500" />
        Loved
        <span className="text-rose-400">5</span>
      </span>

      <div className={`${panel} right-0 top-[10%] w-[58%] z-20 rotate-2 p-3.5`}>
        <div className="flex items-start gap-2.5">
          <Initials text="SO" />
          <div className="min-w-0">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              <span className="font-semibold text-stone-900 dark:text-stone-100">Sam Okafor</span>{" "}
              <Heart size={10} />
            </p>
            <p className="mt-0.5 text-pretty text-sm text-stone-700 dark:text-stone-300">
              &ldquo;Rocky is the best character in any book I&apos;ve read this year.&rdquo;
            </p>
          </div>
        </div>
      </div>

      <div className={`${panel} right-[4%] top-[40%] w-[60%] z-20 -rotate-2 p-3.5`}>
        <div className="flex items-start gap-2.5">
          <Initials text="PP" />
          <div className="min-w-0">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              <span className="font-semibold text-stone-900 dark:text-stone-100">Priya Patel</span>{" "}
              <Heart size={10} />
            </p>
            <p className="mt-0.5 text-pretty text-sm text-stone-700 dark:text-stone-300">
              &ldquo;Read it in one weekend. Hand it to anyone who liked The Martian.&rdquo;
            </p>
          </div>
        </div>
      </div>

      <div className={`${panel} bottom-[6%] left-[6%] right-[10%] z-30 rotate-1 p-3.5`}>
        <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
          This copy has been to
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
          {[
            ["SO", "Sam"],
            ["MC", "Maya"],
            ["PP", "Priya"],
          ].map(([initials, name], index) => (
            <span key={initials} className="flex items-center gap-2">
              {index > 0 ? <span className="text-stone-300 dark:text-stone-600">→</span> : null}
              <span className="flex items-center gap-1.5">
                <Initials text={initials} small />
                {name}
              </span>
            </span>
          ))}
        </div>
      </div>
    </Stage>
  );
}

// A share link, and how it looks when you text it to someone
export function ShowcaseShare() {
  return (
    <Stage height="h-[340px] sm:h-[420px]">
      <div className={`${panel} left-0 right-[8%] top-0 z-20 -rotate-1 p-3.5`}>
        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          Share your bookshelf
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate rounded-md border border-stone-200 dark:border-stone-700 px-2.5 py-1 text-xs text-stone-500 dark:text-stone-400">
            bookstacks.site/share/jordan-avery
          </span>
          <span className="rounded-md bg-forest-600 dark:bg-forest-500 px-2.5 py-1 text-xs font-medium text-white">
            Copy
          </span>
        </div>
      </div>

      {/* The link, unfurled in a message */}
      <div className="absolute right-0 top-[30%] z-30 w-[80%] rotate-2 rounded-2xl rounded-br-md bg-stone-200 dark:bg-stone-800 p-1.5 shadow-soft">
        <div className="overflow-hidden rounded-xl bg-white dark:bg-stone-900">
          <div className="flex justify-center gap-2 bg-stone-100 dark:bg-stone-950 px-4 py-4">
            {[COVERS.piranesi, COVERS.circe, COVERS.dune, COVERS.hailMary].map((src) => (
              <Cover key={src} src={src} className="w-[22%] shadow-soft" />
            ))}
          </div>
          <div className="px-3 py-2.5">
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Jordan Avery&apos;s bookshelf · Stacks
            </p>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
              14 books, including Piranesi, Circe and Dune.
            </p>
            <p className="mt-1 text-[11px] text-stone-400">bookstacks.site</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-[4%] z-30 flex -rotate-2 items-center gap-2 rounded-full bg-stone-900 dark:bg-stone-100 px-3.5 py-2 text-xs font-medium text-white shadow-soft">
        <Check />
        Link copied
      </div>
    </Stage>
  );
}
