import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  SerializeFrom,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useNavigation } from "@remix-run/react";

import Avatar from "~/components/avatar";
import { FeedPost, NotePrompt } from "~/components/friend-activity";
import { LoanList } from "~/components/home";
import { sendBookRequestEmail } from "~/email.server";
import { getFriendActivity, getNotePrompts } from "~/models/activity.server";
import { getBookById, getHomeBooks } from "~/models/book.server";
import { canInteract, respondAsDemoPersona } from "~/models/demo.server";
import { leaveHold, placeHold } from "~/models/hold.server";
import { shelfIds } from "~/models/household.server";
import { canLeaveNote, saveReaderNote } from "~/models/note.server";
import {
  createBookRequestNotification,
  createReaderNoteNotification,
  getUserById,
  getUserEmailById,
} from "~/models/user.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

// What friends have been adding, loving and writing about lately, as a
// feed of posts you can act on

export const meta: MetaFunction = () =>
  seo({ title: "Friend activity", noindex: true });

export const handle = {
  breadcrumb: () => <span>Friend activity</span>,
};

// Posts at a time: "Show older" adds another page's worth below. How many
// are showing lives in the URL (?shown=30), so acting on an older post and
// reloading both keep your place.
const PAGE = 15;
const MOST = 300;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const asked = Number(new URL(request.url).searchParams.get("shown"));
  const shown = Math.min(
    MOST,
    Math.max(PAGE, Number.isFinite(asked) ? Math.floor(asked) : PAGE),
  );
  const [user, activity, prompts, books] = await Promise.all([
    getUserById(userId),
    // One more than shown, to know whether there's anything older
    getFriendActivity(userId, { days: 365, limit: shown + 1 }),
    getNotePrompts(userId),
    // For the rail beside the feed: what's out on loan, both ways
    getHomeBooks(userId, await shelfIds(userId)),
  ]);
  const friends =
    user?.following.map(({ id, firstname, surname, profileEmoji }) => ({
      id,
      firstname,
      surname,
      profileEmoji,
    })) ?? [];
  return json({
    userId,
    activity: activity.slice(0, shown),
    hasOlder: activity.length > shown,
    shown,
    friendIds: friends.map((friend) => friend.id),
    friends,
    prompts,
    loans: { borrowed: books.borrowed, lent: books.lent },
  });
};

// The same things the book page lets you do, from the feed
export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const form = await request.formData();
  const intent = form.get("intent");
  const bookId = form.get("bookId");
  const book = typeof bookId === "string" ? await getBookById(bookId) : null;
  if (!book) throw new Response("Not Found", { status: 404 });

  if (intent === "toggleLove" || intent === "note") {
    if (!(await canLeaveNote(userId, book))) {
      throw new Response("Only readers of this copy can leave notes", {
        status: 403,
      });
    }
    const body = form.get("body");
    const note = await saveReaderNote(
      userId,
      book.id,
      intent === "note"
        ? { body: typeof body === "string" ? body : null }
        : { loved: form.get("loved") === "true" },
    );
    // Let the owner know when a reader hearts or writes about their book
    if (book.userId !== userId && (note.loved || note.body)) {
      const reader = await getUserById(userId);
      if (reader) {
        await createReaderNoteNotification(
          userId,
          book.userId,
          `${reader.firstname} ${reader.surname}`,
          book.id,
          book.title,
        );
      }
    }
    return json({ ok: true });
  }

  const viewer = await getUserById(userId);
  const isFriend =
    viewer?.following.some((friend) => friend.id === book.userId) ?? false;
  if (
    !viewer ||
    book.userId === userId ||
    !isFriend ||
    !(await canInteract(userId, book.userId))
  ) {
    throw new Response("Not Found", { status: 404 });
  }

  if (intent === "request") {
    if (book.borrowerId !== null) {
      throw new Response("Book is already borrowed", { status: 400 });
    }
    const senderName = `${viewer.firstname} ${viewer.surname}`;
    const bookRequest = await createBookRequestNotification(
      userId,
      book.userId,
      senderName,
      book.id,
      book.title,
    );
    // Demo friends approve on the spot
    await respondAsDemoPersona(bookRequest.id);
    const owner = await getUserEmailById(book.userId);
    if (owner && owner.emailNotifications && owner.emailVerifiedAt) {
      await sendBookRequestEmail({
        toEmail: owner.email,
        toUserId: book.userId,
        toName: owner.firstname || "there",
        requesterName: senderName,
        bookTitle: book.title,
        bookAuthor: book.author,
        bookCover: book.cover,
      });
    }
    return json({ ok: true });
  }

  if (intent === "placeHold") {
    if (!book.borrowerId || book.borrowerId === userId) {
      throw new Response("Can't wait for this book", { status: 400 });
    }
    await placeHold(book.id, userId);
    return json({ ok: true });
  }
  if (intent === "leaveHold") {
    await leaveHold(book.id, userId);
    return json({ ok: true });
  }
  throw new Response("Unknown action", { status: 400 });
};

// Beside the feed on wide screens: who you're following (the feed is
// theirs), then your loans both ways. The same shape as the home page,
// mirrored.
function Rail({
  loans,
  friends,
}: {
  loans: SerializeFrom<typeof loader>["loans"];
  friends: SerializeFrom<typeof loader>["friends"];
}) {
  const heading = "text-lg font-semibold text-stone-900 dark:text-stone-100";
  const link =
    "text-sm text-stone-500 dark:text-stone-400 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100 hover:underline";
  const anyLoans = loans.borrowed.length + loans.lent.length > 0;
  // A glance, not the whole ledger: the home page has every loan
  const FEW = 4;
  const more =
    Math.max(0, loans.borrowed.length - FEW) +
    Math.max(0, loans.lent.length - FEW);
  return (
    <aside className="hidden space-y-10 self-start lg:block">
      <section aria-labelledby="rail-friends">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="rail-friends" className={heading}>
            Friends
            <span className="ml-1.5 text-sm font-normal text-stone-400 dark:text-stone-500">
              {friends.length}
            </span>
          </h2>
          <Link to="/friends" className={link}>
            {friends.length > 0 ? "See all" : "Find friends"}
          </Link>
        </div>
        {friends.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {friends.slice(0, 12).map((friend) => (
              <li key={friend.id}>
                <Link
                  to={`/friend/${friend.id}`}
                  title={`${friend.firstname} ${friend.surname}`}
                  className="block rounded-full ring-2 ring-transparent hover:ring-stone-300 dark:hover:ring-stone-600 transition-shadow"
                >
                  <Avatar
                    firstname={friend.firstname}
                    surname={friend.surname}
                    icon={friend.profileEmoji}
                    size="md"
                  />
                  <span className="sr-only">
                    {friend.firstname} {friend.surname}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-400 dark:text-stone-500">
            Friends&apos; books show up here once you have some.
          </p>
        )}
      </section>

      {anyLoans ? (
        <section aria-labelledby="rail-loans">
          <h2 id="rail-loans" className={`${heading} mb-3`}>
            Loans
          </h2>
          <div className="space-y-6">
            {loans.borrowed.length > 0 ? (
              <LoanList
                id="rail-borrowing"
                title="Borrowing"
                books={loans.borrowed.slice(0, FEW).map((book) => ({
                  book,
                  person: book.owner,
                }))}
                personLabel="From"
                empty=""
              />
            ) : null}
            {loans.lent.length > 0 ? (
              <LoanList
                id="rail-lent"
                title="Lent out"
                books={loans.lent.slice(0, FEW).map((book) => ({
                  book,
                  person: book.borrower,
                }))}
                personLabel="To"
                empty=""
              />
            ) : null}
          </div>
          {more > 0 ? (
            <Link to="/#loans" className={`mt-3 inline-block ${link}`}>
              {more} more on your home page
            </Link>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}

export default function Feed() {
  const {
    userId,
    activity,
    hasOlder,
    shown,
    friendIds,
    friends,
    prompts,
    loans,
  } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const loadingOlder =
    navigation.state === "loading" && navigation.location.pathname === "/feed";

  return (
    // The feed reads best in a narrow column; it lines up under the logo
    // like every other page, with the rail in the room that leaves
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8 lg:grid lg:grid-cols-[minmax(0,40rem)_minmax(0,1fr)] lg:gap-14">
      <div className="min-w-0">
        <h1 className="sr-only">Friend activity</h1>
        {prompts.length > 0 ? (
          <div className="mb-6">
            <NotePrompt books={prompts} />
          </div>
        ) : null}
        {activity.length > 0 ? (
          <ul className="space-y-3">
            {activity.map((item) => (
              <li key={item.id}>
                <FeedPost item={item} friendIds={friendIds} userId={userId} />
              </li>
            ))}
          </ul>
        ) : null}
        {activity.length > 0 ? (
          <div className="mt-6 text-center">
            {hasOlder ? (
              <Link
                to={`?shown=${shown + PAGE}`}
                replace
                preventScrollReset
                className={`inline-flex items-center justify-center rounded-md border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors ${
                  loadingOlder ? "pointer-events-none opacity-60" : ""
                }`}
              >
                {loadingOlder ? "Loading…" : "Show older"}
              </Link>
            ) : (
              <p className="text-sm text-stone-400 dark:text-stone-500">
                That&apos;s everything from the past year.
              </p>
            )}
          </div>
        ) : (
          <div className="py-16 text-center text-stone-500 dark:text-stone-400">
            {friendIds.length === 0 ? (
              <>
                <p>Add friends to see the books they add and love.</p>
                <Link
                  to="/friends"
                  className="mt-2 inline-block text-stone-700 dark:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100"
                >
                  Find friends
                </Link>
              </>
            ) : (
              <p>Nothing new from your friends lately.</p>
            )}
          </div>
        )}
      </div>
      <Rail loans={loans} friends={friends} />
    </main>
  );
}
