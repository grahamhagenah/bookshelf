import { data, Link, useFetcher, useLoaderData, useRouteLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import Avatar from "~/components/avatar";
import BookCover from "~/components/book-cover";
import { FeedPost } from "~/components/friend-activity";
import { railLink } from "~/components/side-rail";
import { sectionHeading } from "~/components/ui";
import { prisma } from "~/db.server";
import { loadGroup } from "~/group-page.server";
import { getFriendActivity } from "~/models/activity.server";
import { getUserById } from "~/models/user.server";
import type { LoaderData } from "~/utils";

import type { GroupLayoutData } from "./groups.$groupId";

// What the people in the group have been up to: the feed, narrowed to
// them, in the same posts with the same things to do. Beside it, as the
// feed has its own: who's in the group, the books going around it now,
// and what's new on its shelves.

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { userId, group } = await loadGroup(request, params);
  const memberIds = group.members.map((member) => member.id);
  // A group-mate who isn't your friend keeps what they hide off their page
  // out of it, here as on the Books tab
  const visible = {
    OR: [
      { userId: { notIn: group.groupOnly } },
      { userId: { in: group.groupOnly }, hiddenFromPage: false },
    ],
  };
  const [activity, user, around, newest] = await Promise.all([
    getFriendActivity(userId, { among: group.openIds, groups: [group.id], days: 365, limit: 30 }),
    getUserById(userId),
    prisma.book.findMany({
      where: { userId: { in: memberIds }, borrowerId: { in: memberIds }, ...visible },
      orderBy: { borrowedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        author: true,
        cover: true,
        dueDate: true,
        user: { select: { id: true, firstname: true } },
        borrower: { select: { id: true, firstname: true } },
      },
    }),
    prisma.book.findMany({
      where: { userId: { in: group.openIds }, ...visible },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, author: true, cover: true },
    }),
  ]);
  return data({
    activity,
    userId,
    // Whose names open their shelf, as in the feed
    friendIds: user?.following.map((friend) => friend.id) ?? [],
    around,
    newest,
  });
};

const dueDay = (date: string | Date) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function GroupLately() {
  const { activity, friendIds, userId, around, newest } = useLoaderData<typeof loader>();
  const layout = useRouteLoaderData<GroupLayoutData>("routes/groups.$groupId");

  return (
    // The feed's column, with the side column beside it on wide screens
    // and under it on narrow ones
    <div className="lg:grid lg:grid-cols-[minmax(0,36rem)_18rem] lg:justify-between lg:gap-14">
      <div className="min-w-0">
        {activity.length === 0 ? (
          <p className="py-16 text-center text-stone-500 dark:text-stone-400">
            Nothing yet. Books people add, love or write about show up here.
          </p>
        ) : (
          <ul className="space-y-3">
            {activity.map((item) => (
              <li key={item.id}>
                <FeedPost item={item} friendIds={friendIds} userId={userId} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="mt-10 space-y-10 self-start lg:mt-0">
        {layout ? <People members={layout.group.members} path={layout.path} userId={userId} /> : null}
        <GoingAround books={around} userId={userId} />
        {newest.length > 0 && layout ? (
          <section aria-labelledby="group-newest">
            <Heading id="group-newest" to={layout.path} label="See all">
              New in the group
            </Heading>
            <ul className="grid grid-cols-3 gap-3">
              {newest.map((book) => (
                <li key={book.id}>
                  <Link to={`/books/${book.id}`} title={book.title} className="block hover:opacity-90 transition-opacity">
                    <BookCover cover={book.cover} title={book.title} author={book.author} className="aspect-[2/3] w-full" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function Heading({ id, children, to, label }: { id: string; children: React.ReactNode; to?: string; label?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={id} className={sectionHeading}>
        {children}
      </h2>
      {to ? (
        <Link to={to} className={`flex-shrink-0 ${railLink}`}>
          {label}
        </Link>
      ) : null}
    </div>
  );
}

type Member = NonNullable<LoaderData<GroupLayoutData>>["group"]["members"][number];

// Who's in the group, each opening their shelf, with a way to become
// friends with anyone who isn't one yet
function People({ members, path, userId }: { members: Member[]; path: string; userId: string }) {
  return (
    <section aria-labelledby="group-people">
      <Heading id="group-people" to={`${path}/people`} label="See all">
        People
      </Heading>
      <ul className="space-y-3">
        {members.map((member) => (
          <PersonRow key={member.id} member={member} isMe={member.id === userId} />
        ))}
      </ul>
    </section>
  );
}

function PersonRow({ member, isMe }: { member: Member; isMe: boolean }) {
  const befriend = useFetcher<{ success?: boolean }>();
  const asked = befriend.formData !== undefined || befriend.data?.success === true;
  const who = (
    <>
      <Avatar firstname={member.firstname} surname={member.surname} icon={member.profileEmoji} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-stone-900 dark:text-stone-100">
          {isMe ? "You" : `${member.firstname} ${member.surname}`}
        </span>
        <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
          {member.bookCount} {member.bookCount === 1 ? "book" : "books"}
        </span>
      </span>
    </>
  );
  return (
    <li className="flex items-center gap-3">
      {isMe ? (
        <span className="flex min-w-0 flex-1 items-center gap-3">{who}</span>
      ) : (
        <Link to={`/friend/${member.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 transition-opacity">
          {who}
        </Link>
      )}
      {!isMe && !member.isFriend ? (
        asked ? (
          <span className="flex-shrink-0 text-xs text-stone-400 dark:text-stone-500">Requested</span>
        ) : (
          <befriend.Form method="post" action="/friends/add" className="flex-shrink-0">
            <input type="hidden" name="friendId" value={member.id} />
            <button
              type="submit"
              className="rounded-md border border-stone-200 dark:border-stone-700 px-2 py-0.5 text-xs text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
            >
              Add friend
            </button>
          </befriend.Form>
        )
      ) : null}
    </li>
  );
}

interface LentBook {
  id: string;
  title: string;
  author: string;
  cover: string;
  dueDate: string | Date | null;
  user: { id: string; firstname: string };
  borrower: { id: string; firstname: string } | null;
}

// The group's books out with one another right now: whose, with whom, and
// when it's due back
function GoingAround({ books, userId }: { books: LentBook[]; userId: string }) {
  if (books.length === 0) return null;
  const name = (person: { id: string; firstname: string }) => (person.id === userId ? "You" : person.firstname);
  return (
    <section aria-labelledby="group-around">
      <Heading id="group-around">Going around</Heading>
      <ul className="space-y-3">
        {books.map((book) => (
          <li key={book.id}>
            <Link to={`/books/${book.id}`} className="flex items-center gap-3 rounded-md hover:opacity-80 transition-opacity">
              <BookCover cover={book.cover} title={book.title} author={book.author} compact className="aspect-[2/3] w-9 flex-shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-stone-900 dark:text-stone-100">{book.title}</span>
                <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                  {name(book.user)} → {book.borrower ? name(book.borrower) : ""}
                  {book.dueDate ? ` · due ${dueDay(book.dueDate)}` : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
