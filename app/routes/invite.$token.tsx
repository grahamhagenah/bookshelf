import { data, Link, redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import invariant from "tiny-invariant";

import Avatar from "~/components/avatar";
import BookCover from "~/components/book-cover";
import { acceptFriendInvite, getInviter } from "~/models/friend.server";
import { seo } from "~/seo";
import { getUserId } from "~/session.server";

// Someone's personal invite. Signed in, opening it makes you friends on the
// spot. Signed out, it says who's asking and what's on their shelf, and
// sends you to sign up (or in) and straight back here.

export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  seo({
    title: loaderData?.inviter ? `${loaderData.inviter.firstname} invited you to Stacks` : "Invite",
    description: "Borrow and lend books with friends.",
    noindex: true,
  });

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.token, "token not found");
  const inviter = await getInviter(params.token);
  const userId = await getUserId(request);
  if (userId && inviter) {
    const result = await acceptFriendInvite(userId, params.token);
    if (result.ok) return redirect(`/friend/${result.inviterId}`);
    return data({ inviter: null, reason: result.reason, token: params.token });
  }
  return data({
    inviter,
    reason: inviter ? null : ("no-such-invite" as const),
    token: params.token,
  });
};

export default function Invite() {
  const { inviter, reason, token } = useLoaderData<typeof loader>();
  const here = `/invite/${token}`;

  if (!inviter) {
    const message =
      reason === "own-invite"
        ? "This is your own invite link. Send it to someone you'd like to borrow books with."
        : reason === "demo-boundary"
          ? "Demo accounts and real ones can't be friends with each other."
          : "That invite link doesn't work any more. Ask for a fresh one.";
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
          {reason === "own-invite"
            ? "That's your link"
            : "Invite not found"}
        </h1>
        <p className="mt-3 text-stone-600 dark:text-stone-300">{message}</p>
        <Link
          to="/friends"
          className="mt-6 inline-block text-stone-700 dark:text-stone-200 underline underline-offset-2"
        >
          Go to Friends
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-14 md:py-20 text-center">
      <div className="flex justify-center">
        <Avatar
          firstname={inviter.firstname}
          surname={inviter.surname}
          icon={inviter.profileEmoji}
          size="lg"
        />
      </div>
      <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
        {inviter.firstname} invited you to Stacks
      </h1>
      <p className="mt-3 text-pretty text-lg text-stone-600 dark:text-stone-300">
        Stacks is a lending library for the books you and your friends own. Join and
        you&apos;ll be friends with {inviter.firstname} straight away, free to borrow from
        their shelf.
      </p>

      {inviter.recent.length > 0 ? (
        <div className="mt-8">
          <ul className="grid grid-cols-6 gap-2" aria-label={`On ${inviter.firstname}'s shelf`}>
            {inviter.recent.map((book) => (
              <li key={book.id}>
                <BookCover cover={book.cover} title={book.title} author={book.author} alt={book.title} className="aspect-[2/3]" eager />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
            {inviter.bookCount} {inviter.bookCount === 1 ? "book" : "books"} on{" "}
            {inviter.firstname}&apos;s shelf
          </p>
        </div>
      ) : null}

      <div className="mt-10 flex flex-col items-center gap-3">
        <Link
          to={`/join?friend=${token}&redirectTo=${encodeURIComponent(here)}`}
          className="inline-flex w-full max-w-xs items-center justify-center rounded-md bg-forest-600 px-6 py-3 text-lg font-medium text-white hover:bg-forest-700 transition-colors"
        >
          Join {inviter.firstname} on Stacks
        </Link>
        <Link
          to={`/login?redirectTo=${encodeURIComponent(here)}`}
          className="text-stone-600 dark:text-stone-300 underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:underline"
        >
          I already have an account
        </Link>
      </div>
    </main>
  );
}
