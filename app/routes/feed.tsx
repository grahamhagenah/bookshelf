import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { FeedPost, NotePrompt } from "~/components/friend-activity";
import { sendBookRequestEmail } from "~/email.server";
import { getFriendActivity, getNotePrompts } from "~/models/activity.server";
import { getBookById } from "~/models/book.server";
import { canInteract, respondAsDemoPersona } from "~/models/demo.server";
import { leaveHold, placeHold } from "~/models/hold.server";
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [user, activity, prompts] = await Promise.all([
    getUserById(userId),
    getFriendActivity(userId, { days: 90, limit: 50 }),
    getNotePrompts(userId),
  ]);
  const friendIds = user?.following.map((friend) => friend.id) ?? [];
  return json({ userId, activity, friendIds, prompts });
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
      throw new Response("Only readers of this copy can leave notes", { status: 403 });
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
  const isFriend = viewer?.following.some((friend) => friend.id === book.userId) ?? false;
  if (!viewer || book.userId === userId || !isFriend || !(await canInteract(userId, book.userId))) {
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
    if (owner && owner.emailNotifications) {
      await sendBookRequestEmail({
        toEmail: owner.email,
        toName: owner.firstname || "there",
        requesterName: senderName,
        bookTitle: book.title,
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

export default function Feed() {
  const { userId, activity, friendIds, prompts } = useLoaderData<typeof loader>();

  return (
    // A feed reads best in a narrow column
    <main className="mx-auto w-full max-w-[40rem] px-4 py-6 md:py-8">
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
    </main>
  );
}
