import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import BookCover from "~/components/book-cover";
import Faces from "~/components/faces";
import { getGroupByToken, joinGroup } from "~/models/group.server";
import { seo } from "~/seo";
import { getUserId } from "~/session.server";

// A group's link. Signed in, opening it puts you in the group and makes
// you friends with everyone there. Signed out, it says who's in it and
// what they have, and sends you to sign up (or in) and straight back here.

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  seo({
    title: data?.group ? `Join ${data.group.name} on Stacks` : "Group",
    description: "Borrow and lend books with the people you know.",
    noindex: true,
  });

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.token, "token not found");
  const userId = await getUserId(request);
  if (userId) {
    const result = await joinGroup(userId, params.token);
    if (result.ok) return redirect(`/groups/${result.groupId}?joined=1`);
    return json({ group: null, reason: result.reason, token: params.token });
  }
  const group = await getGroupByToken(params.token);
  return json({
    group,
    reason: group ? null : ("no-such-group" as const),
    token: params.token,
  });
};

// "Maya", "Maya and Sam", "Maya, Sam and 4 others"
function whoIsIn(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const others = names.length - 2;
  return `${names[0]}, ${names[1]} and ${others} ${others === 1 ? "other" : "others"}`;
}

export default function JoinGroup() {
  const { group, reason, token } = useLoaderData<typeof loader>();
  const here = `/g/${token}`;

  if (!group) {
    const [title, message] =
      reason === "full"
        ? ["This group is full", "Groups hold up to 50 people. Ask someone in it about starting another."]
        : reason === "demo-boundary"
          ? ["Not from the demo", "Demo accounts and real ones can't be in a group together."]
          : ["Group not found", "That link doesn't work any more. Ask someone in the group for a fresh one."];
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">{title}</h1>
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

  const names = group.members.map((member) => member.firstname);
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-14 md:py-20 text-center">
      <div className="flex justify-center">
        <Faces people={group.members} size="md" />
      </div>
      <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
        Join {group.name} on Stacks
      </h1>
      <p className="mt-3 text-pretty text-lg text-stone-600 dark:text-stone-300">
        {names.length === 1
          ? `${names[0]} started this group to lend books to people they know.`
          : `${whoIsIn(names)} lend books to each other here.`}{" "}
        Join and you&apos;ll be friends with everyone in the group, free to borrow from
        their shelves.
      </p>

      {group.recent.length > 0 ? (
        <div className="mt-8">
          <ul className="grid grid-cols-6 gap-2" aria-label={`On ${group.name}'s shelves`}>
            {group.recent.map((book) => (
              <li key={book.id}>
                <BookCover
                  cover={book.cover}
                  title={book.title}
                  author={book.author}
                  alt={book.title}
                  className="aspect-[2/3]"
                  eager
                />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
            {group.bookCount} {group.bookCount === 1 ? "book" : "books"} on their shelves
          </p>
        </div>
      ) : null}

      <div className="mt-10 flex flex-col items-center gap-3">
        <Link
          to={`/join?group=${token}&redirectTo=${encodeURIComponent(here)}`}
          className="inline-flex w-full max-w-xs items-center justify-center rounded-md bg-forest-600 px-6 py-3 text-lg font-medium text-white hover:bg-forest-700 transition-colors"
        >
          Join {group.name}
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
