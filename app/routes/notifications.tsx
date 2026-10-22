import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import ActivityIcon from "~/components/activity-icon";
import Avatar from "~/components/avatar";
import PersonLink from "~/components/person-link";
import Layout from "~/components / Layout/Layout";
import { prisma } from "~/db.server";
import {
  DEFAULT_LOAN_WEEKS,
  LOAN_WEEKS,
  lendBook,
  loanWeeks,
} from "~/models/book.server";
import { answerFriendRequest } from "~/models/friend.server";
import { shelfIds } from "~/models/household.server";
import {
  getUserById,
  markNotificationAsRead,
  createBookApprovedNotification,
  getNotificationHistory,
  getPendingBookRequests,
  getReceivedNotification,
  dismissUpdates,
} from "~/models/user.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

export const meta: MetaFunction = () =>
  seo({ title: "Activity", noindex: true });

export const handle = {
  breadcrumb: () => <span>Activity</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [user, history, pendingBookRequests] = await Promise.all([
    getUserById(userId),
    getNotificationHistory(userId, 30),
    getPendingBookRequests(userId),
  ]);
  const friendIds = user?.following.map((friend) => friend.id) ?? [];
  return json({
    user,
    history,
    pendingBookRequests,
    friendIds,
    loanChoices: { weeks: LOAN_WEEKS, defaultWeeks: DEFAULT_LOAN_WEEKS },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const notificationId = formData.get("notificationId");

  if (formData.get("intent") === "dismissAll") {
    await dismissUpdates(userId, [...NEEDS_ACTION]);
    return null;
  }

  // Everything below acts on a notification sent to you, and on what it
  // says (who sent it, which book), never on ids from the form
  const notification =
    typeof notificationId === "string"
      ? await getReceivedNotification(userId, notificationId)
      : null;
  if (!notification) return null;
  const type = notification.type || "FRIEND_REQUEST";

  if (type === "FRIEND_REQUEST") {
    const answer = formData.get("friend_request");
    if (answer === "accept" || answer === "decline") {
      await answerFriendRequest(userId, notification.id, answer === "accept");
    }
    return null;
  }

  if (type === "BOOK_REQUEST") {
    const answer = formData.get("book_request");
    const book = notification.bookId
      ? await prisma.book.findUnique({
          where: { id: notification.bookId },
          select: { userId: true, borrowerId: true, title: true },
        })
      : null;
    if (answer === "approve" && book && !book.borrowerId) {
      // Only a book on your own shelf (yours or your household's)
      if (!(await shelfIds(userId)).includes(book.userId)) return null;
      await lendBook(notification.bookId!, notification.senderId, loanWeeks(formData.get("weeks")));
      const currentUser = await getUserById(userId);
      if (currentUser) {
        await createBookApprovedNotification(
          userId,
          notification.senderId,
          `${currentUser.firstname} ${currentUser.surname}`,
          notification.bookTitle ?? book.title,
        );
      }
      await markNotificationAsRead(notification.id, "approved");
    } else if (answer === "decline") {
      await markNotificationAsRead(notification.id, "declined");
    }
    return null;
  }

  // Everything else only needs dismissing
  if (formData.get("dismiss") === "true") {
    await markNotificationAsRead(notification.id, "dismissed");
  }
  return null;
};

// Requests and reminders the user has to do something about
const NEEDS_ACTION = new Set([
  "FRIEND_REQUEST",
  "BOOK_REQUEST",
  "OVERDUE_REMINDER",
  "DUE_SOON_REMINDER",
]);

const primaryButton =
  "rounded-md bg-forest-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-700 transition-colors text-center";
const secondaryButton =
  "rounded-md border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors text-center";

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// "Today", "Yesterday", then the date
function when(dateString: string, withTime = false) {
  const date = new Date(dateString);
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const day =
    days === 0
      ? "Today"
      : days === 1
        ? "Yesterday"
        : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return withTime || days <= 1 ? `${day}, ${time}` : day;
}

// Which bunch an older notification goes in
function bucket(dateString: string) {
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(dateString))) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  if (days < 31) return "This month";
  return "Older";
}

interface ActivityNotification {
  id: string;
  type?: string;
  senderId: string;
  senderName: string;
  bookId?: string | null;
  bookTitle?: string | null;
  createdAt: string;
  sender?: { profileEmoji: string | null } | null;
}

// One notification, as a card of its own: who, what, when, and what you
// can do
function Card({
  type,
  person,
  date,
  children,
  actions,
  dismiss,
}: {
  type: string;
  person: { name: string; icon?: string | null };
  date?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  dismiss?: boolean;
}) {
  const [firstname, ...rest] = person.name.split(" ");
  return (
    <div className="flex gap-3 rounded-xl border border-stone-200 dark:border-stone-800 p-4">
      <span className="relative h-10 flex-shrink-0">
        <Avatar firstname={firstname} surname={rest.join(" ")} icon={person.icon} />
        <span className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-white dark:ring-stone-950">
          <ActivityIcon type={type} urgent={type === "OVERDUE_REMINDER"} size="xs" />
        </span>
      </span>
      {/* What happened on the left, what you can do about it on the right
          (underneath, on phones) */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="leading-snug text-stone-800 dark:text-stone-200">{children}</p>
          {date ? <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">{date}</p> : null}
        </div>
        {actions ? (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {dismiss ? (
        <button
          type="submit"
          name="dismiss"
          value="true"
          aria-label="Dismiss"
          title="Dismiss"
          className="-mr-2 -mt-2 flex h-7 w-7 flex-shrink-0 items-center justify-center self-start rounded-full sm:mt-0 sm:self-center text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

interface LoanChoices {
  weeks: readonly number[];
  defaultWeeks: number;
}

function ActivityItem({
  notification,
  friendIds,
  loanChoices,
}: {
  notification: ActivityNotification;
  friendIds: string[];
  loanChoices: LoanChoices;
}) {
  const type = notification.type || "FRIEND_REQUEST";
  const name = (
    <strong className="font-semibold">
      <PersonLink
        id={notification.senderId}
        name={notification.senderName}
        friendIds={friendIds}
      />
    </strong>
  );
  const book = <strong className="font-semibold">{notification.bookTitle}</strong>;

  let text: React.ReactNode;
  let actions: React.ReactNode;

  switch (type) {
    case "FRIEND_REQUEST":
      text = <>{name} wants to be friends</>;
      actions = (
        <>
          <button className={primaryButton} type="submit" name="friend_request" value="accept">
            Accept
          </button>
          <button className={secondaryButton} type="submit" name="friend_request" value="decline">
            Decline
          </button>
        </>
      );
      break;
    case "BOOK_REQUEST":
      text = <>{name} would like to borrow {book}</>;
      actions = (
        <>
          <label className="sr-only" htmlFor={`weeks-${notification.id}`}>
            Loan length
          </label>
          <select
            id={`weeks-${notification.id}`}
            name="weeks"
            defaultValue={loanChoices.defaultWeeks}
            className="h-[34px] rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 text-sm text-stone-700 dark:text-stone-200 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10"
          >
            {loanChoices.weeks.map((weeks) => (
              <option key={weeks} value={weeks}>
                for {weeks} {weeks === 1 ? "week" : "weeks"}
              </option>
            ))}
          </select>
          <button className={primaryButton} type="submit" name="book_request" value="approve">
            Lend it
          </button>
          <button className={secondaryButton} type="submit" name="book_request" value="decline">
            Decline
          </button>
        </>
      );
      break;
    case "OVERDUE_REMINDER":
    case "DUE_SOON_REMINDER":
      text =
        type === "OVERDUE_REMINDER" ? (
          <>
            {book} is overdue. Time to return it to {name}.
          </>
        ) : (
          <>
            {book} is due back to {name} soon
          </>
        );
      actions = (
        <a href={`/books/${notification.bookId}`} className={secondaryButton}>
          View book
        </a>
      );
      break;
    case "WANT_MATCH":
      // A friend added a book from your want-to-read list
      text = (
        <>
          {name} added {book}, which is on your want-to-read list
        </>
      );
      actions = (
        <a href={`/books/${notification.bookId}`} className={secondaryButton}>
          View book
        </a>
      );
      break;
    case "FRIEND_JOINED":
      // Someone signed up (or came over) from your invite link
      text = <>{name} joined from your invite. You&apos;re friends now.</>;
      actions = (
        <a href={`/friend/${notification.senderId}`} className={secondaryButton}>
          See their shelf
        </a>
      );
      break;
    case "BOOK_APPROVED":
      text = <>{name} is lending you {book}</>;
      break;
    case "HOLD_READY":
      // You were first in line when the book came back
      text = (
        <>
          {book} is back, and you were next in line. We&apos;ve asked {name} for
          you.
        </>
      );
      break;
    case "BOOK_RETURNED":
      text = <>{name} returned {book}</>;
      break;
    case "LOAN_EXTENDED":
      text = <>{name} gave you more time with {book}</>;
      actions = (
        <a href={`/books/${notification.bookId}`} className={secondaryButton}>
          View book
        </a>
      );
      break;
    case "READER_NOTE":
      text = <>{name} shared their thoughts on {book}</>;
      actions = (
        <a href={`/books/${notification.bookId}#notes`} className={secondaryButton}>
          Read it
        </a>
      );
      break;
    default:
      text = <>New activity from {name}</>;
  }

  // Anything but a request can simply be dismissed
  const dismissable = type !== "FRIEND_REQUEST" && type !== "BOOK_REQUEST";

  return (
    <form method="post">
      {/* The server looks the rest up from the notification itself */}
      <input type="hidden" name="notificationId" value={notification.id} />
      <Card
        type={type}
        person={{ name: notification.senderName, icon: notification.sender?.profileEmoji }}
        date={when(notification.createdAt)}
        actions={actions}
        dismiss={dismissable}
      >
        {text}
      </Card>
    </form>
  );
}

const getHistoryText = (
  notification: {
  type: string;
  senderId: string;
  senderName: string;
  bookTitle?: string | null;
  actionTaken?: string | null;
},
  friendIds: string[],
) => {
  const action = notification.actionTaken || "done";
  const name = (
    <span className="text-stone-700 dark:text-stone-300">
      <PersonLink
        id={notification.senderId}
        name={notification.senderName}
        friendIds={friendIds}
      />
    </span>
  );
  const book = <span className="text-stone-700 dark:text-stone-300">{notification.bookTitle}</span>;

  switch (notification.type) {
    case "FRIEND_REQUEST":
      return <>Friend request from {name}, {action}</>;
    case "BOOK_REQUEST":
      return <>{name} asked to borrow {book}, {action}</>;
    case "FRIEND_JOINED":
      return <>{name} joined from your invite</>;
    case "BOOK_APPROVED":
      return <>{name} lent you {book}</>;
    case "HOLD_READY":
      return <>Your turn came up for {book}</>;
    case "WANT_MATCH":
      return <>{name} added {book}, from your want-to-read list</>;
    case "BOOK_RETURNED":
      return <>{name} returned {book}</>;
    case "READER_NOTE":
      return <>{name} shared their thoughts on {book}</>;
    case "LOAN_EXTENDED":
      return <>{name} extended your loan of {book}</>;
    case "OVERDUE_REMINDER":
      return <>{book} was overdue</>;
    case "DUE_SOON_REMINDER":
      return <>{book} was due soon</>;
    default:
      return <>Activity, {action}</>;
  }
};

function SectionHeading({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="flex items-baseline gap-2 text-lg font-semibold">
        {title}
        {count ? (
          <span className="text-sm font-normal text-stone-400 dark:text-stone-500">{count}</span>
        ) : null}
      </h2>
      {children}
    </div>
  );
}

const BUCKETS = ["Today", "Yesterday", "This week", "This month", "Older"];

export default function Activity() {
  const data = useLoaderData<typeof loader>();
  const unread = data.user?.notificationsReceived ?? [];
  const needsAction = unread.filter((n) => NEEDS_ACTION.has(n.type || "FRIEND_REQUEST"));
  const updates = unread.filter((n) => !NEEDS_ACTION.has(n.type || "FRIEND_REQUEST"));
  const pending = data.pendingBookRequests ?? [];
  const history = [...(data.history ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const earlier = BUCKETS.map((label) => ({
    label,
    items: history.filter((n) => bucket(n.createdAt) === label),
  })).filter((group) => group.items.length > 0);
  const section = "max-w-3xl";
  const list = "space-y-3";

  return (
    <Layout title="Activity">
      <section className={section}>
        <SectionHeading title="Needs you" count={needsAction.length} />
        {needsAction.length > 0 ? (
          <ul className={list}>
            {needsAction.map((notification) => (
              <li key={notification.id}>
                <ActivityItem
                  notification={notification}
                  friendIds={data.friendIds}
                  loanChoices={data.loanChoices}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-200 dark:border-stone-800 px-4 py-6 text-center text-stone-500 dark:text-stone-400">
            You&apos;re all caught up.
          </p>
        )}
      </section>

      {updates.length > 0 ? (
        <section className={section}>
          <SectionHeading title="New" count={updates.length}>
            <form method="post">
              <input type="hidden" name="intent" value="dismissAll" />
              <button
                type="submit"
                className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              >
                Mark all as read
              </button>
            </form>
          </SectionHeading>
          <ul className={list}>
            {updates.map((notification) => (
              <li key={notification.id}>
                <ActivityItem
                  notification={notification}
                  friendIds={data.friendIds}
                  loanChoices={data.loanChoices}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {pending.length > 0 ? (
        <section className={section}>
          <SectionHeading title="Waiting on others" count={pending.length} />
          <ul className={list}>
            {pending.map((request) => (
              <li key={request.id}>
                <Card
                  type="PENDING"
                  person={{ name: `${request.receiver.firstname} ${request.receiver.surname}` }}
                  date={`Asked ${when(request.createdAt).toLowerCase()}`}
                  actions={
                    <a href={`/books/${request.bookId}`} className={secondaryButton}>
                      View book
                    </a>
                  }
                >
                  You asked{" "}
                  <strong className="font-semibold">
                    <PersonLink
                      id={request.receiver.id}
                      name={`${request.receiver.firstname} ${request.receiver.surname}`}
                      friendIds={data.friendIds}
                    />
                  </strong>{" "}
                  to borrow{" "}
                  <strong className="font-semibold">{request.bookTitle}</strong>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {earlier.length > 0 ? (
        <section className={section}>
          <SectionHeading title="Earlier" />
          <div className="space-y-5">
            {earlier.map((group) => (
              <div key={group.label}>
                <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
                  {group.label}
                </h3>
                <ul className="divide-y divide-stone-100 dark:divide-stone-800 rounded-xl border border-stone-200 dark:border-stone-800">
                  {group.items.map((notification) => (
                    <li
                      key={notification.id}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-500 dark:text-stone-400"
                    >
                      <ActivityIcon type={notification.type} size="sm" />
                      <span className="min-w-0 flex-1">
                        {getHistoryText(notification, data.friendIds)}
                      </span>
                      <span className="flex-shrink-0 text-xs text-stone-400 dark:text-stone-500">
                        {when(notification.createdAt, true)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </Layout>
  );
}
