
import { Link, useFetcher, useLocation } from "react-router";

import Avatar from "~/components/avatar";
import BookCover from "~/components/book-cover";
import { HeartIcon, LocationIcon, StacksLogo } from "~/components/icons";
import Library from "~/components/library";
import type { FriendStatus } from "~/models/user.server";
import { favoritesTip } from "~/profile";
import type { loadSharedShelf } from "~/share.server";
import { agoInWords, type LoaderData } from "~/utils";

import { primaryButton, quietButton } from "./ui";

const primaryAction = `${primaryButton("sm")} inline-flex items-center justify-center`;
const quietAction = `${quietButton("sm")} inline-flex items-center justify-center`;

// A shared shelf's page, whichever address it's reached by: who it
// belongs to, a few of their favorites, the shelf, and an invite to
// become friends

export type SharedShelfData = LoaderData<typeof loadSharedShelf>;

// "18 books on Jordan Avery's shelf, including Dune, Piranesi and Circe."
export function shelfSummary(name: string, count: number, titles: string[]) {
  const books = `${count} ${count === 1 ? "book" : "books"} on ${name}'s shelf`;
  if (titles.length === 0) return `${books}. Browse them on Stacks.`;
  const list =
    titles.length === 1
      ? titles[0]
      : `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
  return `${books}, including ${list}.`;
}

// Small, so the bar stays out of the shelf's way

const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${n === 1 ? word : `${word}s`}`;

// The heart on their favorites wears the owner's bookplate color. One of
// the six plates, so it stays Stacks.
const HEARTS: Record<string, string> = {
  forest: "text-forest-600 dark:text-forest-400",
  oxblood: "text-red-800 dark:text-red-300",
  navy: "text-blue-800 dark:text-blue-300",
  ochre: "text-amber-600 dark:text-amber-300",
  plum: "text-purple-800 dark:text-purple-300",
  ink: "text-stone-700 dark:text-stone-300",
};
const heartOf = (color: string) => HEARTS[color] ?? HEARTS.forest;

// Favorites stand a little off the page, like books on a table, where the
// shelf's covers below lie flat
const lifted =
  "shadow-[0_1px_2px_rgb(0_0_0/0.08),0_10px_24px_-8px_rgb(0_0_0/0.35)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_10px_24px_-8px_rgb(0_0_0/0.7)]";

// A section's name in small capitals over a hairline, so the parts of the
// page read as parts
function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="flex items-center gap-1.5 border-b border-stone-200 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500 dark:border-stone-800 dark:text-stone-400"
    >
      {children}
    </h2>
  );
}

// What they've added and loved lately: one row of covers, newest first,
// each saying which and when
function RecentActivity({ data }: { data: SharedShelfData }) {
  const { recent, color } = data.profile;
  if (recent.length === 0) return null;
  return (
    <section aria-labelledby="recent" className="mt-10">
      <SectionHeading id="recent">Recent activity</SectionHeading>
      {/* One row, like a shelf: four across on a phone, six on a wider
          screen, smaller than the favorites above */}
      <ul className="mt-5 grid grid-cols-4 items-start gap-x-3 sm:grid-cols-6 sm:gap-x-5">
        {recent.map((book, index) => {
          const cover = (
            <BookCover
              cover={book.cover}
              title={book.title}
              author={book.author}
              sizes="(min-width: 640px) 150px, 25vw"
              className="aspect-[2/3] w-full transition-opacity duration-200 group-hover:opacity-90"
            />
          );
          return (
            <li
              key={`${book.kind}-${book.id}`}
              className={`min-w-0 ${index >= 4 ? "hidden sm:block" : ""}`}
            >
              {book.onShelf ? (
                <Link to={`/books/${book.id}`} className="group block">
                  {cover}
                  <span className="sr-only">{book.title}</span>
                </Link>
              ) : (
                <div aria-label={book.title} role="img">
                  {cover}
                </div>
              )}
              <p className="mt-2 flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                {book.kind === "loved" ? (
                  <HeartIcon size={12} filled className={`flex-shrink-0 ${heartOf(color)}`} />
                ) : null}
                <span className="truncate">
                  <span className="sr-only sm:not-sr-only">
                    {book.kind === "loved" ? "Loved " : "Added "}
                  </span>
                  {agoInWords(book.at)}
                </span>
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Who the shelf belongs to, in their words, and what they love
function ProfileHeader({ data }: { data: SharedShelfData }) {
  const { profile } = data;
  const { stats } = profile;
  // On your own page only
  const tip =
    data.friendStatus === "self"
      ? favoritesTip(profile, data.bookListItems[0])
      : null;
  // How generous the shelf has been, rather than how much anyone's read
  const mostLent =
    stats.mostLent && stats.mostLent.times > 1 ? stats.mostLent.title : null;
  const numbers = [
    { label: stats.books === 1 ? "Book" : "Books", value: stats.books },
    { label: "Lent", value: stats.timesLent },
    { label: stats.friends === 1 ? "Friend" : "Friends", value: stats.friends },
  ];

  return (
    <header className="pb-2">
      {/* Who they are on the left, their numbers on the right; on a phone
          the numbers go under, so the name has the width */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <Avatar
            firstname={data.ownerFirstname}
            surname={data.ownerSurname}
            icon={data.ownerIcon}
            size="md"
            // Bigger from tablet width up; on a phone the bio gets the room
            className="sm:h-16 sm:w-16 sm:text-xl"
          />
          <div className="min-w-0">
            {/* The handle is already in the address, so it isn't repeated here */}
            <h1 className="text-balance text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-2xl">
              {data.ownerName}
            </h1>
            {profile.location ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400">
                <LocationIcon size={14} className="flex-shrink-0" />
                <span className="truncate">{profile.location}</span>
              </p>
            ) : null}
            {profile.bio ? (
              <p className="mt-2 max-w-xl text-pretty text-stone-700 dark:text-stone-300">
                {profile.bio}
              </p>
            ) : null}
            {mostLent ? (
              <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
                Most borrowed: {mostLent}
              </p>
            ) : null}
          </div>
        </div>

        {/* The numbers, each over its name, with a hairline between */}
        <dl className="flex flex-shrink-0 divide-x divide-stone-200 dark:divide-stone-800">
          {numbers.map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col-reverse px-4 text-center first:pl-0 last:pr-0 sm:px-5"
            >
              <dt className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">
                {label}
              </dt>
              <dd className="text-xl font-semibold tabular-nums text-stone-900 dark:text-stone-50">
                {value.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {profile.favorites.length > 0 ? (
        <section aria-labelledby="favorites" className="mt-10">
          <SectionHeading id="favorites">
            <HeartIcon size={13} filled className={heartOf(profile.color)} />
            Favorites
          </SectionHeading>
          {/* Four across, bigger than the shelf's covers, so they're what
              a visitor sees first; five when there are five, so none sits
              alone on a row */}
          <ul
            className={`mt-5 grid grid-cols-2 items-start gap-x-5 gap-y-8 sm:gap-x-8 ${
              profile.favorites.length > 4 ? "sm:grid-cols-5" : "sm:grid-cols-4"
            }`}
          >
            {profile.favorites.map((book) => {
              const contents = (
                <>
                  <BookCover
                    cover={book.cover}
                    title={book.title}
                    author={book.author}
                    // Four or five across from small tablets up, two on phones
                    sizes="(min-width: 640px) 240px, 50vw"
                    className={`aspect-[2/3] w-full transition-opacity duration-200 group-hover:opacity-90 ${lifted}`}
                  />
                  <span className="mt-3 block text-sm leading-snug">
                    <span className="line-clamp-2 font-medium text-stone-800 dark:text-stone-200">
                      {book.title}
                    </span>
                    {book.author ? (
                      <span className="mt-0.5 line-clamp-1 text-stone-500 dark:text-stone-400">
                        <span className="sr-only">by </span>
                        {book.author}
                      </span>
                    ) : null}
                  </span>
                </>
              );
              return (
                <li key={book.id} className="min-w-0">
                  {book.onShelf ? (
                    // To the book's page, as the covers on the shelf below go
                    <Link
                      to={`/books/${book.id}`}
                      className="group relative block"
                    >
                      {contents}
                    </Link>
                  ) : (
                    // Borrowed from a friend: their book's page isn't one
                    // a visitor can open, so it's just the cover
                    <div className="relative">{contents}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <RecentActivity data={data} />

      {tip ? (
        <aside
          aria-label="Tip"
          className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 px-4 py-3 text-sm text-stone-600 dark:text-stone-300"
        >
          <p className="min-w-0 flex-1 basis-64">
            <span className="font-semibold text-stone-900 dark:text-stone-100">
              Tip:
            </span>{" "}
            {tip.text}{" "}
            <span className="text-stone-400 dark:text-stone-500">
              Only you see this.
            </span>
          </p>
          {tip.link ? (
            <Link
              to={tip.link.to}
              className="font-medium text-stone-900 dark:text-stone-100 underline decoration-stone-300 dark:decoration-stone-600 underline-offset-2 hover:decoration-current"
            >
              {tip.link.label}
            </Link>
          ) : null}
        </aside>
      ) : null}

    </header>
  );
}

// Where the shelf starts, under the favorites: its own heading, so it
// reads as the next part of the page
function ShelfHeading({ data }: { data: SharedShelfData }) {
  // The favorites on this shelf are shown first and not again below, so
  // the grid is the rest of it (unless that's nothing, when it's all)
  const favoriteIds = new Set(data.profile.favorites.map((book) => book.id));
  const rest = data.bookListItems.filter(
    (book) => !favoriteIds.has(book.id),
  ).length;
  const setAside = rest > 0 && rest < data.bookListItems.length;
  return (
    <h2 className="flex flex-wrap items-baseline gap-x-2.5 text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100">
      {data.ownerFirstname}&rsquo;s shelf{" "}
      {/* With the favorites shown above, these are the others */}
      <span className="text-base font-normal tracking-normal text-stone-500 dark:text-stone-400">
        {setAside
          ? `${rest.toLocaleString()} more`
          : plural(data.profile.stats.books, "book")}
      </span>
    </h2>
  );
}

// The line above a shared shelf that turns a visit into a friendship:
// join (or sign in) and ask to be friends, so the books can be borrowed
function Invite({ data }: { data: SharedShelfData }) {
  const {
    shareToken: token,
    ownerId,
    ownerFirstname,
    ownerName,
    signedIn,
  } = data;
  const friendStatus = data.friendStatus as FriendStatus | null;
  const fetcher = useFetcher<{ ok: boolean }>();
  // Back to this page, whichever address it was
  const here = useLocation().pathname;
  // Show the request as sent straight away
  const status =
    fetcher.state !== "idle" && friendStatus === "none"
      ? "requested"
      : friendStatus;

  let text: React.ReactNode;
  let actions: React.ReactNode = null;

  if (!signedIn) {
    // On a phone the profile below says whose shelf this is; the bar keeps
    // to the logo and the two buttons
    text = (
      <>
        <strong className="font-semibold text-stone-900 dark:text-stone-100">
          {ownerName}
        </strong>{" "}
        shares their shelf on{" "}
        <Link
          to="/"
          className="text-stone-700 dark:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-white hover:decoration-stone-500"
        >
          Stacks
        </Link>
        . Join free to borrow their books.
      </>
    );
    actions = (
      <>
        <Link
          to={`/join?${new URLSearchParams({ invite: token, redirectTo: here })}`}
          className={primaryAction}
        >
          Join free
        </Link>
        <Link
          // Carries the invite in case they switch to signing up
          to={`/login?${new URLSearchParams({ invite: token, redirectTo: here })}`}
          className={quietAction}
        >
          Sign in
        </Link>
      </>
    );
  } else if (status === "none") {
    text = <>Add {ownerName} as a friend to borrow their books.</>;
    actions = (
      // Always the token's address, which handles the request
      <fetcher.Form method="post" action={`/share/${token}`}>
        <button type="submit" className={primaryAction}>
          Add friend
        </button>
      </fetcher.Form>
    );
  } else if (status === "requested") {
    text = (
      <>
        Friend request sent. You can borrow {ownerFirstname}&apos;s books once
        they accept.
      </>
    );
  } else if (status === "invited") {
    text = <>{ownerName} has asked to be your friend.</>;
    actions = (
      <Link to="/notifications" className={quietAction}>
        See request
      </Link>
    );
  } else if (status === "friends") {
    text = <>You and {ownerFirstname} are friends.</>;
    actions = (
      <Link to={`/friend/${ownerId}`} className={quietAction}>
        Borrow from their shelf
      </Link>
    );
  } else if (status === "self") {
    text = <>This is your shelf as others see it from your share link.</>;
    // The page has no app header, so this is the way back
    actions = (
      <>
        <Link to="/books" className={quietAction}>
          My shelf
        </Link>
        <Link to="/account#sharing" className={quietAction}>
          Edit your public shelf
        </Link>
      </>
    );
  } else {
    // A demo visitor on a real person's shelf
    return null;
  }

  // A quiet line above the page: the shelf belongs to its owner, so Stacks
  // keeps to the buttons here and introduces itself at the bottom instead.
  // A long note wraps to its own line on a phone.
  return (
    <div className="px-4 md:px-8 pt-3 md:pt-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-stone-500 dark:text-stone-400">
        <p
          className={`min-w-0 flex-1 leading-snug ${
            // Signed out, or on your own page, the note is wide-screen only and
            // mustn't hold space on a phone
            !signedIn || status === "self" ? "hidden sm:block" : "basis-48"
          }`}
        >
          {text}
        </p>
        {actions ? (
          <div className="ml-auto flex flex-shrink-0 gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

// Where Stacks introduces itself, after the shelf: for visitors who've
// looked through it and might like one of their own
function MakeYourOwn() {
  return (
    <div className="mt-12 px-4 text-center md:px-8">
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-full border border-stone-200 dark:border-stone-800 px-4 py-2 text-sm text-stone-600 dark:text-stone-300 hover:border-stone-400 hover:text-stone-900 dark:hover:border-stone-600 dark:hover:text-stone-100 transition-colors"
      >
        <StacksLogo size={18} />
        Make your own shelf on Stacks
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export default function SharedShelf({ data }: { data: SharedShelfData }) {
  return (
    <>
      <Invite data={data} />
      <Library
        bookListItems={data.bookListItems}
        ownerName={data.ownerName}
        header={<ProfileHeader data={data} />}
        // The favorites are already at the top of the page
        shownAbove={data.profile.favorites.map((book) => book.id)}
        shelfHeading={<ShelfHeading data={data} />}
        // A few rows, so a big library doesn't bury the favorites
        preview={24}
      />
      {/* Signed in, they've already got one */}
      {data.signedIn ? null : <MakeYourOwn />}
    </>
  );
}
