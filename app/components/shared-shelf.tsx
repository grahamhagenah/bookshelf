import type { SerializeFrom } from "@remix-run/node";
import { Link, useFetcher, useLocation } from "@remix-run/react";

import Avatar from "~/components/avatar";
import BookCover from "~/components/book-cover";
import { HeartIcon, StacksLogo } from "~/components/icons";
import Library from "~/components/library";
import type { FriendStatus } from "~/models/user.server";
import { UPGRADE_PATH } from "~/plan";
import type { loadSharedShelf } from "~/share.server";

// A shared shelf's page, whichever address it's reached by: who it
// belongs to, a few of their favorites, the shelf, and an invite to
// become friends

export type SharedShelfData = SerializeFrom<typeof loadSharedShelf>;

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
const primaryButton =
  "inline-flex items-center justify-center rounded-md bg-forest-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-forest-700 transition-colors";
const secondaryButton =
  "inline-flex items-center justify-center rounded-md border border-stone-200 dark:border-stone-700 px-2.5 py-1 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";

const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${n === 1 ? word : `${word}s`}`;

// The page wears its owner's bookplate color: a strip across the top and
// the heart on their favorites. One of the six plates, so it stays Stacks.
const ACCENTS: Record<string, { strip: string; heart: string }> = {
  forest: {
    strip: "bg-forest-600 dark:bg-forest-400",
    heart: "text-forest-600 dark:text-forest-400",
  },
  oxblood: {
    strip: "bg-red-900 dark:bg-red-400",
    heart: "text-red-800 dark:text-red-300",
  },
  navy: {
    strip: "bg-blue-900 dark:bg-blue-400",
    heart: "text-blue-800 dark:text-blue-300",
  },
  ochre: {
    strip: "bg-amber-600 dark:bg-amber-400",
    heart: "text-amber-600 dark:text-amber-300",
  },
  plum: {
    strip: "bg-purple-900 dark:bg-purple-400",
    heart: "text-purple-800 dark:text-purple-300",
  },
  ink: {
    strip: "bg-stone-800 dark:bg-stone-300",
    heart: "text-stone-700 dark:text-stone-300",
  },
};
const accentOf = (color: string) => ACCENTS[color] ?? ACCENTS.forest;

// Where each favorite's note sits on its cover: a different spot, tilt
// and tail for each one in turn, hanging a little off the edge, so the
// row looks like it's talking rather than lined up in a table
const BUBBLE_SPOTS = [
  {
    place: "top-[8%] -right-[10%] rotate-2",
    tail: "-bottom-[6px] left-5 border-b border-r",
  },
  {
    place: "bottom-[12%] -left-[10%] -rotate-2",
    tail: "-top-[6px] right-5 border-l border-t",
  },
  {
    place: "top-[38%] -right-[12%] rotate-1",
    tail: "-left-[6px] top-3 border-b border-l",
  },
  {
    place: "top-[4%] -left-[8%] -rotate-3",
    tail: "-bottom-[6px] right-6 border-b border-r",
  },
  {
    place: "bottom-[6%] -right-[8%] rotate-3",
    tail: "-top-[6px] left-6 border-l border-t",
  },
];

// Who the shelf belongs to, in their words, and what they love
function ProfileHeader({ data }: { data: SharedShelfData }) {
  const { profile } = data;
  const { stats } = profile;
  // The favorites on this shelf are shown first and not again below, so
  // the grid is the rest of it (unless that's nothing, when it's all)
  const favoriteIds = new Set(profile.favorites.map((book) => book.id));
  const rest = data.bookListItems.filter(
    (book) => !favoriteIds.has(book.id),
  ).length;
  const setAside = rest > 0 && rest < data.bookListItems.length;
  const facts = [
    plural(stats.books, "book"),
    // How generous the shelf has been, rather than how much anyone's read
    stats.timesLent ? `lent ${plural(stats.timesLent, "time")}` : null,
    stats.mostLent && stats.mostLent.times > 1
      ? `most borrowed: ${stats.mostLent.title}`
      : null,
  ].filter(Boolean);

  return (
    <header className="pb-2">
      {/* One compact block, so the books start high on the page: the
          picture beside the name, bio and numbers */}
      <div className="flex items-start gap-3 sm:gap-4">
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
          {profile.bio ? (
            <p className="mt-1 max-w-xl text-pretty text-stone-700 dark:text-stone-300">
              {profile.bio}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {facts.join(" · ")}
          </p>
        </div>
      </div>

      {profile.favorites.length > 0 ? (
        <section aria-labelledby="favorites" className="mt-10">
          <h2
            id="favorites"
            className="flex items-center gap-1.5 text-sm font-semibold text-stone-500 dark:text-stone-400"
          >
            <HeartIcon
              size={14}
              filled
              className={accentOf(profile.color).heart}
            />
            Favorites
          </h2>
          <ul className="mt-3 grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-5 sm:gap-x-6">
            {profile.favorites.map((book, i) => {
              const spot = BUBBLE_SPOTS[i % BUBBLE_SPOTS.length];
              return (
                <li key={book.id} className="min-w-0">
                  <div className="relative">
                    <BookCover
                      cover={book.cover}
                      title={book.title}
                      author={book.author}
                      className="aspect-[2/3] w-full"
                    />
                    {/* Why it's here, in the owner's words: a speech bubble
                        stuck to the cover, somewhere different on each */}
                    {book.note ? (
                      <p
                        className={`absolute z-10 w-[104%] sm:w-[88%] ${spot.place} rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-pretty text-[11px] leading-snug text-stone-700 shadow-md transition-transform motion-safe:hover:rotate-0 motion-safe:hover:scale-105 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-200 sm:text-xs`}
                      >
                        <span className="line-clamp-5 sm:line-clamp-4">
                          {book.note}
                        </span>
                        <span
                          aria-hidden
                          className={`absolute h-2.5 w-2.5 rotate-45 border-stone-200 bg-white dark:border-stone-600 dark:bg-stone-800 ${spot.tail}`}
                        />
                      </p>
                    ) : null}
                  </div>
                  <span className="mt-1.5 block truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                    {book.title}
                  </span>
                  <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                    {book.author}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <h2 className="mt-8 text-sm font-semibold text-stone-500 dark:text-stone-400">
        {setAside ? "More on the shelf" : "On the shelf"}{" "}
        <span className="font-normal">
          {(setAside ? rest : stats.books).toLocaleString()}
        </span>
      </h2>
    </header>
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
  const fetcher = useFetcher<{ ok: boolean; limit?: string }>();
  // Back to this page, whichever address it was
  const here = useLocation().pathname;
  // The free plan's friends are all taken
  const limitMessage = fetcher.data?.limit;
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
          className={primaryButton}
        >
          Join free
        </Link>
        <Link
          // Carries the invite in case they switch to signing up
          to={`/login?${new URLSearchParams({ invite: token, redirectTo: here })}`}
          className={secondaryButton}
        >
          Sign in
        </Link>
      </>
    );
  } else if (status === "none" && limitMessage) {
    text = (
      <>
        {limitMessage}{" "}
        <Link
          to={UPGRADE_PATH}
          className="font-medium underline underline-offset-2"
        >
          See Stacks Plus
        </Link>
      </>
    );
  } else if (status === "none") {
    text = <>Add {ownerName} as a friend to borrow their books.</>;
    actions = (
      // Always the token's address, which handles the request
      <fetcher.Form method="post" action={`/share/${token}`}>
        <button type="submit" className={primaryButton}>
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
      <Link to="/notifications" className={secondaryButton}>
        See request
      </Link>
    );
  } else if (status === "friends") {
    text = <>You and {ownerFirstname} are friends.</>;
    actions = (
      <Link to={`/friend/${ownerId}`} className={secondaryButton}>
        Borrow from their shelf
      </Link>
    );
  } else if (status === "self") {
    text = <>This is your shelf as others see it from your share link.</>;
    // The page has no app header, so this is the way back
    actions = (
      <>
        <Link to="/books" className={secondaryButton}>
          My shelf
        </Link>
        <Link to="/account#sharing" className={secondaryButton}>
          Edit your page
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
      {/* The owner's color, edge to edge across the top of the page */}
      <div
        aria-hidden="true"
        className={`fixed inset-x-0 top-0 z-50 h-1 ${accentOf(data.profile.color).strip}`}
      />
      <Invite data={data} />
      <Library
        bookListItems={data.bookListItems}
        ownerName={data.ownerName}
        header={<ProfileHeader data={data} />}
        // The favorites are already at the top of the page
        shownAbove={data.profile.favorites.map((book) => book.id)}
      />
      {/* Signed in, they've already got one */}
      {data.signedIn ? null : <MakeYourOwn />}
    </>
  );
}
