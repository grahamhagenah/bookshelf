import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import ActivityIcon from "~/components/activity-icon";
import Avatar from "~/components/avatar";
import { HeartIcon } from "~/components/icons";
import PersonLink from "~/components/person-link";
import Layout from "~/components / Layout/Layout";
import { getFriendActivity } from "~/models/activity.server";
import {
  DEFAULT_LOAN_WEEKS,
  LOAN_WEEKS,
  lendBook,
  loanWeeks,
} from "~/models/book.server";
import {
  createFriendship,
  getUserById,
  markNotificationAsRead,
  createBookApprovedNotification,
  getNotificationHistory,
  getPendingBookRequests,
} from "~/models/user.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import { coverSrc } from "~/utils";

export const meta: MetaFunction = () =>
  seo({ title: "Activity", noindex: true });

export const handle = {
  breadcrumb: () => <span>Activity</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [user, history, pendingBookRequests, friendActivity] = await Promise.all([
    getUserById(userId),
    getNotificationHistory(userId, 10),
    getPendingBookRequests(userId),
    getFriendActivity(userId),
  ]);
  const friendIds = user?.following.map((friend) => friend.id) ?? [];
  return json({
    user,
    history,
    pendingBookRequests,
    friendActivity,
    friendIds,
    loanChoices: { weeks: LOAN_WEEKS, defaultWeeks: DEFAULT_LOAN_WEEKS },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const senderId = formData.get("senderId");
  const notificationId = formData.get("notificationId");
  const notificationType = formData.get("notificationType");

  if (typeof senderId !== "string" || typeof notificationId !== "string") {
    return null;
  }

  // Handle friend request
  if (formData.get("friend_request") === "accept") {
    await createFriendship(userId, senderId);
    await markNotificationAsRead(notificationId, "accepted");
  } else if (formData.get("friend_request") === "decline") {
    await markNotificationAsRead(notificationId, "declined");
  }

  // Handle book request
  if (notificationType === "BOOK_REQUEST") {
    const bookId = formData.get("bookId");
    const bookTitle = formData.get("bookTitle");

    if (typeof bookId !== "string" || typeof bookTitle !== "string") {
      return null;
    }

    if (formData.get("book_request") === "approve") {
      // Lend the book to the requester
      await lendBook(bookId, senderId, loanWeeks(formData.get("weeks")));

      // Get current user's name for the approval notification
      const currentUser = await getUserById(userId);
      if (currentUser) {
        const senderName = `${currentUser.firstname} ${currentUser.surname}`;
        await createBookApprovedNotification(
          userId,
          senderId,
          senderName,
          bookTitle,
        );
      }

      await markNotificationAsRead(notificationId, "approved");
    } else if (formData.get("book_request") === "decline") {
      await markNotificationAsRead(notificationId, "declined");
    }
  }

  // Handle book approved notification (just dismiss it)
  if (notificationType === "BOOK_APPROVED") {
    if (formData.get("dismiss") === "true") {
      await markNotificationAsRead(notificationId, "dismissed");
    }
  }

  // Reader notes and loan extensions only need dismissing
  if (notificationType === "READER_NOTE" || notificationType === "LOAN_EXTENDED") {
    if (formData.get("dismiss") === "true") {
      await markNotificationAsRead(notificationId, "dismissed");
    }
  }

  // Handle book returned notification (just dismiss it)
  if (notificationType === "BOOK_RETURNED") {
    if (formData.get("dismiss") === "true") {
      await markNotificationAsRead(notificationId, "dismissed");
    }
  }

  // Handle overdue/due soon reminders (just dismiss them)
  if (
    notificationType === "OVERDUE_REMINDER" ||
    notificationType === "DUE_SOON_REMINDER"
  ) {
    if (formData.get("dismiss") === "true") {
      await markNotificationAsRead(notificationId, "dismissed");
    }
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
  "rounded-md bg-stone-700 dark:bg-stone-200 px-3 py-1.5 text-sm font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors text-center";
const secondaryButton =
  "rounded-md border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors text-center";
const quietButton =
  "rounded-md px-2 py-1.5 text-sm text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 transition-colors";

const formatDate = (dateString: string, withTime = false) =>
  new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });

interface ActivityNotification {
  id: string;
  type?: string;
  senderId: string;
  senderName: string;
  bookId?: string | null;
  bookTitle?: string | null;
  createdAt: string;
}

function Row({
  icon,
  date,
  children,
  actions,
}: {
  icon: React.ReactNode;
  date?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {icon}
        <div className="min-w-0 pt-1">
          <p className="text-stone-800 dark:text-stone-200 leading-snug">
            {children}
          </p>
          {date ? (
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
              {date}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex items-center gap-2 pl-11 sm:pl-0 flex-shrink-0">
          {actions}
        </div>
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
        <>
          <a href={`/books/${notification.bookId}`} className={secondaryButton}>
            View book
          </a>
          <button className={quietButton} type="submit" name="dismiss" value="true">
            Dismiss
          </button>
        </>
      );
      break;
    case "BOOK_APPROVED":
      text = <>{name} is lending you {book}</>;
      break;
    case "BOOK_RETURNED":
      text = <>{name} returned {book}</>;
      break;
    case "LOAN_EXTENDED":
      text = <>{name} gave you more time with {book}</>;
      actions = (
        <>
          <a href={`/books/${notification.bookId}`} className={secondaryButton}>
            View book
          </a>
          <button className={quietButton} type="submit" name="dismiss" value="true">
            Dismiss
          </button>
        </>
      );
      break;
    case "READER_NOTE":
      text = <>{name} shared their thoughts on {book}</>;
      actions = (
        <>
          <a href={`/books/${notification.bookId}`} className={secondaryButton}>
            Read it
          </a>
          <button className={quietButton} type="submit" name="dismiss" value="true">
            Dismiss
          </button>
        </>
      );
      break;
    default:
      text = <>New activity from {name}</>;
  }

  // Updates only need dismissing
  if (!actions) {
    actions = (
      <button className={quietButton} type="submit" name="dismiss" value="true">
        Dismiss
      </button>
    );
  }

  return (
    <form method="post">
      <input type="hidden" name="senderId" value={notification.senderId} />
      <input type="hidden" name="notificationId" value={notification.id} />
      <input type="hidden" name="notificationType" value={type} />
      {type === "BOOK_REQUEST" ? (
        <>
          <input type="hidden" name="bookId" value={notification.bookId || ""} />
          <input type="hidden" name="bookTitle" value={notification.bookTitle || ""} />
        </>
      ) : null}
      <Row
        icon={<ActivityIcon type={type} urgent={type === "OVERDUE_REMINDER"} />}
        date={formatDate(notification.createdAt)}
        actions={actions}
      >
        {text}
      </Row>
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
    case "BOOK_APPROVED":
      return <>{name} lent you {book}</>;
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

type FeedItem = ReturnType<typeof useLoaderData<typeof loader>>["friendActivity"][number];
interface FeedBook { id: string; title: string; cover: string }

function FeedCover({ book }: { book: FeedBook }) {
  return (
    <Link
      to={`/books/${book.id}`}
      title={book.title}
      className="block w-9 h-[54px] flex-shrink-0 overflow-hidden rounded-xs bg-stone-100 dark:bg-stone-800 ring-1 ring-stone-900/5 dark:ring-white/10 hover:opacity-90 transition-opacity"
    >
      <img
        src={coverSrc(book.cover)}
        alt={book.title}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </Link>
  );
}

// One line of what a friend has been up to
function FriendActivityItem({ item, friendIds }: { item: FeedItem; friendIds: string[] }) {
  const name = (
    <strong className="font-semibold">
      <PersonLink
        id={item.friend.id}
        name={`${item.friend.firstname} ${item.friend.surname}`}
        friendIds={friendIds}
      />
    </strong>
  );
  const bookLink = (book: FeedBook) => (
    <Link
      to={`/books/${book.id}`}
      className="font-semibold underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
    >
      {book.title}
    </Link>
  );

  let text: React.ReactNode;
  let covers: FeedBook[];
  if (item.kind === "added") {
    text =
      item.books.length === 1 ? (
        <>
          {name} added {bookLink(item.books[0])}
        </>
      ) : (
        <>
          {name} added {item.books.length} books
        </>
      );
    covers = item.books.slice(0, 6);
  } else {
    text = (
      <>
        {name} {item.kind === "loved" ? "loved" : "wrote about"} {bookLink(item.book)}
        {item.kind === "note" && item.loved ? (
          <HeartIcon size={12} filled className="ml-1.5 inline text-rose-400 align-[-1px]" />
        ) : null}
      </>
    );
    covers = [item.book];
  }

  return (
    <div className="flex items-start gap-3 py-3">
      <Avatar
        firstname={item.friend.firstname}
        surname={item.friend.surname}
        icon={item.friend.profileEmoji}
        size="sm"
      />
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-stone-800 dark:text-stone-200 leading-snug">{text}</p>
        {item.kind === "note" && item.body ? (
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300 line-clamp-2">
            &ldquo;{item.body}&rdquo;
          </p>
        ) : null}
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
          {formatDate(item.at)}
        </p>
        {item.kind === "added" && covers.length > 1 ? (
          <div className="mt-2 flex gap-2">
            {covers.map((book) => (
              <FeedCover key={book.id} book={book} />
            ))}
            {item.books.length > covers.length ? (
              <span className="self-center text-xs text-stone-400 dark:text-stone-500">
                +{item.books.length - covers.length}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {item.kind !== "added" || covers.length === 1 ? <FeedCover book={covers[0]} /> : null}
    </div>
  );
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <h2 className="text-lg font-semibold mb-2 flex items-baseline gap-2">
      {title}
      {count ? (
        <span className="text-sm font-normal text-stone-400 dark:text-stone-500">
          {count}
        </span>
      ) : null}
    </h2>
  );
}

export default function Activity() {
  const data = useLoaderData<typeof loader>();
  const unread = data.user?.notificationsReceived ?? [];
  const needsAction = unread.filter((n) => NEEDS_ACTION.has(n.type || "FRIEND_REQUEST"));
  const updates = unread.filter((n) => !NEEDS_ACTION.has(n.type || "FRIEND_REQUEST"));
  const pending = data.pendingBookRequests ?? [];
  const history = [...(data.history ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <Layout title="Activity">
      <section>
        <SectionHeading title="Needs your attention" count={needsAction.length} />
        {needsAction.length > 0 ? (
          <ul>
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
          <p className="text-stone-500 dark:text-stone-400 py-2">
            You&apos;re all caught up.
          </p>
        )}
      </section>

      {updates.length > 0 ? (
        <section>
          <SectionHeading title="Updates" count={updates.length} />
          <ul>
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
        <section>
          <SectionHeading title="Waiting on others" count={pending.length} />
          <ul>
            {pending.map((request) => (
              <li key={request.id}>
                <Row
                  icon={<ActivityIcon type="PENDING" />}
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
                </Row>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.friendActivity.length > 0 ? (
        <section>
          <SectionHeading title="From your friends" />
          <ul>
            {data.friendActivity.map((item) => (
              <li key={item.id}>
                <FriendActivityItem item={item} friendIds={data.friendIds} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section>
          <SectionHeading title="Earlier" />
          <ul>
            {history.map((notification) => (
              <li
                key={notification.id}
                className="flex items-center gap-3 py-2 text-sm text-stone-500 dark:text-stone-400"
              >
                <ActivityIcon type={notification.type} size="sm" />
                <span className="flex-1 min-w-0">{getHistoryText(notification, data.friendIds)}</span>
                <span className="text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">
                  {formatDate(notification.createdAt, true)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Layout>
  );
}
