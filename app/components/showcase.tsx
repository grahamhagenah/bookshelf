import { coverSrc } from "~/utils";

import { Bookplate } from "./avatar";
import { BorrowedIcon, HeartIcon, LentIcon, SearchIcon } from "./icons";

// Staged glimpses of the app for the landing page: cards styled like the
// real ones, tilted and overlapping. The default export, about lending,
// sits beside the headline; the others illustrate the sections below.
// Decorative, so hidden from screen readers.

export const cover = (isbn: string) =>
  coverSrc(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`);

const COVERS = {
  stationEleven: cover("9780804172448"),
  demonCopperhead: cover("9780063251922"),
  seaOfTranquility: cover("9780593321447"),
  gentlemanInMoscow: cover("9780670026197"),
  gilead: cover("9780312424404"),
  klara: cover("9780593318171"),
  neverLetMeGo: cover("9781400078776"),
  jonathanStrange: cover("9780765356154"),
  midnightLibrary: cover("9780525559474"),
  anxiousPeople: cover("9781501160837"),
  hailMary: cover("9780593135204"),
  piranesi: cover("9781635575637"),
  circe: cover("9780316556347"),
  dune: cover("9780441172719"),
  overstory: cover("9780393635522"),
};

const skin =
  "rounded-lg bg-white dark:bg-stone-900 shadow-soft ring-1 ring-stone-900/5 dark:ring-white/10";
const panel = `absolute ${skin}`;

function Stage({
  children,
  height = "h-[480px] sm:h-[505px]",
  width = "max-w-[420px]",
}: {
  children: React.ReactNode;
  height?: string;
  width?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative mx-auto w-full select-none ${width} ${height}`}
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
  status?: "lent" | "borrowed";
  hearts?: number;
  className: string;
}

// A book as it appears in the library grid: where it is as a tag on the
// cover, hearts beside the title
function BookCard({ book, width = "w-[34%]" }: { book: CardBook; width?: string }) {
  return (
    <div className={`${panel} ${width} p-2 ${book.className}`}>
      <div className="relative">
        <Cover src={book.cover} className="w-full" />
        {book.status === "lent" || book.status === "borrowed" ? (
          <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-white/95 dark:bg-stone-950/90 px-1.5 py-0.5 text-[10px] leading-4 text-stone-700 dark:text-stone-200 shadow-sm">
            {book.status === "lent" ? <LentIcon size={10} /> : <BorrowedIcon size={10} />}
            {book.status === "lent" ? "Lent out" : "Borrowed"}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 flex items-start gap-1.5 text-xs">
        <span className="min-w-0 flex-1 text-pretty leading-tight text-stone-700 dark:text-stone-300">
          {book.title}
        </span>
        {book.hearts ? (
          <span className="inline-flex flex-shrink-0 items-center gap-1 text-[11px] text-stone-400 dark:text-stone-500">
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

// The four books the lending glimpse is told with: one out on loan, one
// borrowed, one much loved, and one about to be lent
export interface LendingSet {
  lent: { title: string; cover: string; hearts: number };
  borrowed: { title: string; cover: string };
  loved: { title: string; cover: string; hearts: number; lentTimes: number };
  lending: { title: string; cover: string };
}

export const LENDING_SET: LendingSet = {
  lent: { title: "Demon Copperhead", cover: COVERS.demonCopperhead, hearts: 3 },
  borrowed: { title: "Sea of Tranquility", cover: COVERS.seaOfTranquility },
  loved: { title: "A Gentleman in Moscow", cover: COVERS.gentlemanInMoscow, hearts: 5, lentTimes: 8 },
  lending: { title: "Dune", cover: COVERS.dune },
};

export default function ShowcaseLending({ set = LENDING_SET }: { set?: LendingSet }) {
  // The page's main picture, so it gets more room than the others
  return (
    <Stage width="max-w-[496px]" height="h-[530px] sm:h-[540px]">
      {/* What's due, both ways */}
      <div className={`${panel} left-0 right-[10%] top-0 z-30 -rotate-1 p-3.5`}>
        <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">Due soon</p>
        <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-300">
          <span className="font-semibold text-stone-900 dark:text-stone-100">{set.lent.title}</span>{" "}
          is with Priya Patel ·{" "}
          <span className="font-semibold text-stone-900 dark:text-stone-100">3 days late</span>
        </p>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          <span className="font-semibold text-stone-900 dark:text-stone-100">{set.borrowed.title}</span>{" "}
          goes back to Maya Chen · tomorrow
        </p>
      </div>

      {[
        {
          ...set.lent,
          status: "lent" as const,
          className: "left-[2%] top-[31%] sm:top-[23%] -rotate-3",
        },
        {
          ...set.borrowed,
          status: "borrowed" as const,
          className: "left-[34%] top-[34%] sm:top-[26%] z-10 rotate-2",
        },
        {
          ...set.loved,
          className: "right-0 top-[29%] sm:top-[21%] rotate-6",
        },
      ].map((book) => (
        <BookCard key={book.title} book={book} width="w-[32%]" />
      ))}

      <Tag className="right-[-2%] top-[28%] rotate-[9deg] sm:top-[20%]">
        Lent {set.loved.lentTimes} times
      </Tag>

      {/* The last row: choosing how long to lend for, and a nudge already on
          its way beside it. On a phone the nudge drops under the panel. */}
      <div className="absolute bottom-[7%] left-[2%] right-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className={`${skin} rotate-1 p-3.5 pr-4`}>
          <div className="flex items-center gap-3">
            <Cover src={set.lending.cover} className="w-8" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-stone-800 dark:text-stone-200">
                Lend <span className="font-semibold">{set.lending.title}</span> to Sam
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md border border-stone-200 dark:border-stone-700 px-2 py-0.5 text-xs text-stone-700 dark:text-stone-200">
                  4 weeks
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
                <span className="rounded-md bg-forest-600 px-2 py-0.5 text-xs font-medium text-white">
                  Lend it
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex -rotate-2 items-center gap-2 whitespace-nowrap rounded-full bg-stone-900 dark:bg-stone-100 px-3.5 py-2 text-xs font-medium text-white dark:text-stone-900 shadow-soft">
          <Check />
          Reminder sent to Priya
        </div>
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
          <span className="rounded-md bg-forest-600 px-2 py-0.5 text-xs font-medium text-white">
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

// Your shelf's own page, as anyone with the link sees it: a browser window
// at your address, with your bookplate, a line about you, your favorites
// and the shelf beneath
export function ShowcasePage() {
  return (
    <Stage height="h-[350px] sm:h-[390px]">
      <div className={`${panel} inset-x-0 top-[3%] z-20 -rotate-1 overflow-hidden`}>
        {/* The window's top: three dots and the address */}
        <div className="flex items-center gap-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 px-3 py-2">
          <span className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-700" />
            <span className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-700" />
            <span className="h-2 w-2 rounded-full bg-stone-300 dark:bg-stone-700" />
          </span>
          <span className="flex-1 truncate rounded-md bg-white dark:bg-stone-900 px-2.5 py-1 text-center text-xs text-stone-500 dark:text-stone-400 ring-1 ring-stone-900/5 dark:ring-white/10">
            bookstacks.app/<span className="font-medium text-stone-800 dark:text-stone-200">@maya</span>
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            <Bookplate firstname="Maya" surname="Chen" color="plum" box="h-12 w-12 text-base" framed />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight tracking-tight text-stone-900 dark:text-stone-50">Maya Chen</p>
              <p className="mt-0.5 text-sm leading-snug text-stone-700 dark:text-stone-300">
                Sci-fi, slow mornings, always happy to lend
              </p>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">142 books · lent 31 times</p>
            </div>
          </div>

          <p className="mt-4 flex items-center gap-1 text-xs font-semibold text-stone-500 dark:text-stone-400">
            <Heart size={11} />
            Favorites
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[COVERS.circe, COVERS.piranesi, COVERS.hailMary, COVERS.klara].map((src) => (
              <Cover key={src} src={src} className="w-full" />
            ))}
          </div>

          <p className="mt-4 text-xs font-semibold text-stone-500 dark:text-stone-400">
            On the shelf <span className="font-normal">142</span>
          </p>
          {/* Cut off at the window's edge, as a long shelf would be */}
          <div className="mt-2 grid h-16 grid-cols-5 gap-2 overflow-hidden">
            {[COVERS.dune, COVERS.stationEleven, COVERS.overstory, COVERS.gilead, COVERS.neverLetMeGo].map((src) => (
              <Cover key={src} src={src} className="w-full" />
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-[2%] right-[4%] z-30 flex rotate-2 items-center gap-2 rounded-full bg-stone-900 dark:bg-stone-100 px-3.5 py-2 text-xs font-medium text-white dark:text-stone-900 shadow-soft">
        <Check />
        Link copied
      </div>
    </Stage>
  );
}
