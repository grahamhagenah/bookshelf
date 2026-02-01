import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUserId } from "~/session.server";
import { createFriendship, getUserById, markNotificationAsRead, createBookApprovedNotification, getNotificationHistory, getPendingBookRequests } from "~/models/user.server";
import { lendBook } from "~/models/book.server";
import Layout from "~/components / Layout/Layout";
import Breadcrumbs from "~/components/breadcrumbs";
import { PersonAddIcon, HourglassIcon, MenuBookIcon, CheckCircleIcon, KeyboardReturnIcon, HistoryIcon, ClockIcon } from "~/components/icons";

export const handle = {
  breadcrumb: () => <span>Notifications</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [user, history, pendingBookRequests] = await Promise.all([
    getUserById(userId),
    getNotificationHistory(userId, 10),
    getPendingBookRequests(userId),
  ]);
  return json({ user, history, pendingBookRequests });
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
      await lendBook(bookId, senderId);

      // Get current user's name for the approval notification
      const currentUser = await getUserById(userId);
      if (currentUser) {
        const senderName = `${currentUser.firstname} ${currentUser.surname}`;
        await createBookApprovedNotification(userId, senderId, senderName, bookTitle);
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

  // Handle book returned notification (just dismiss it)
  if (notificationType === "BOOK_RETURNED") {
    if (formData.get("dismiss") === "true") {
      await markNotificationAsRead(notificationId, "dismissed");
    }
  }

  // Handle overdue/due soon reminders (just dismiss them)
  if (notificationType === "OVERDUE_REMINDER" || notificationType === "DUE_SOON_REMINDER") {
    if (formData.get("dismiss") === "true") {
      await markNotificationAsRead(notificationId, "dismissed");
    }
  }

  return null;
};

export default function Notifications() {

  const data = useLoaderData<typeof loader>();

  const renderNotification = (notification: {
    id: string;
    type?: string;
    senderId: string;
    senderName: string;
    bookId?: string | null;
    bookTitle?: string | null;
  }) => {
    const notificationType = notification.type || "FRIEND_REQUEST";

    if (notificationType === "FRIEND_REQUEST") {
      return (
        <form method="post" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <input type="hidden" name="senderId" value={notification.senderId} />
          <input type="hidden" name="notificationId" value={notification.id} />
          <input type="hidden" name="notificationType" value="FRIEND_REQUEST" />
          <p className="flex items-start sm:items-center gap-3">
            <PersonAddIcon className="flex-shrink-0" />
            <span><strong>{notification.senderName}</strong> sent a friend request</span>
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button className="flex-1 sm:flex-none rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400" type="submit" name="friend_request" value="accept">Accept</button>
            <button className="flex-1 sm:flex-none rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-800 focus:bg-slate-900" type="submit" name="friend_request" value="decline">Decline</button>
          </div>
        </form>
      );
    }

    if (notificationType === "BOOK_REQUEST") {
      return (
        <form method="post" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <input type="hidden" name="senderId" value={notification.senderId} />
          <input type="hidden" name="notificationId" value={notification.id} />
          <input type="hidden" name="notificationType" value="BOOK_REQUEST" />
          <input type="hidden" name="bookId" value={notification.bookId || ""} />
          <input type="hidden" name="bookTitle" value={notification.bookTitle || ""} />
          <p className="flex items-start sm:items-center gap-3">
            <MenuBookIcon className="flex-shrink-0" />
            <span><strong>{notification.senderName}</strong> wants to borrow <strong>{notification.bookTitle}</strong></span>
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button className="flex-1 sm:flex-none rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400" type="submit" name="book_request" value="approve">Approve</button>
            <button className="flex-1 sm:flex-none rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-800 focus:bg-slate-900" type="submit" name="book_request" value="decline">Decline</button>
          </div>
        </form>
      );
    }

    if (notificationType === "BOOK_APPROVED") {
      return (
        <form method="post" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <input type="hidden" name="senderId" value={notification.senderId} />
          <input type="hidden" name="notificationId" value={notification.id} />
          <input type="hidden" name="notificationType" value="BOOK_APPROVED" />
          <p className="flex items-start sm:items-center gap-3">
            <CheckCircleIcon className="flex-shrink-0 text-green-600" />
            <span><strong>{notification.senderName}</strong> approved your request for <strong>{notification.bookTitle}</strong></span>
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button className="flex-1 sm:flex-none rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-800 focus:bg-slate-900" type="submit" name="dismiss" value="true">Dismiss</button>
          </div>
        </form>
      );
    }

    if (notificationType === "BOOK_RETURNED") {
      return (
        <form method="post" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <input type="hidden" name="senderId" value={notification.senderId} />
          <input type="hidden" name="notificationId" value={notification.id} />
          <input type="hidden" name="notificationType" value="BOOK_RETURNED" />
          <p className="flex items-start sm:items-center gap-3">
            <KeyboardReturnIcon className="flex-shrink-0 text-amber-600" />
            <span><strong>{notification.senderName}</strong> returned <strong>{notification.bookTitle}</strong></span>
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button className="flex-1 sm:flex-none rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-800 focus:bg-slate-900" type="submit" name="dismiss" value="true">Dismiss</button>
          </div>
        </form>
      );
    }

    if (notificationType === "OVERDUE_REMINDER") {
      return (
        <form method="post" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <input type="hidden" name="senderId" value={notification.senderId} />
          <input type="hidden" name="notificationId" value={notification.id} />
          <input type="hidden" name="notificationType" value="OVERDUE_REMINDER" />
          <p className="flex items-start sm:items-center gap-3">
            <ClockIcon className="flex-shrink-0 text-red-600" />
            <span><strong>{notification.bookTitle}</strong> is overdue — please return it to <strong>{notification.senderName}</strong></span>
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <a href={`/books/${notification.bookId}`} className="flex-1 sm:flex-none rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 text-center">View Book</a>
            <button className="flex-1 sm:flex-none rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-800 focus:bg-slate-900" type="submit" name="dismiss" value="true">Dismiss</button>
          </div>
        </form>
      );
    }

    if (notificationType === "DUE_SOON_REMINDER") {
      return (
        <form method="post" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <input type="hidden" name="senderId" value={notification.senderId} />
          <input type="hidden" name="notificationId" value={notification.id} />
          <input type="hidden" name="notificationType" value="DUE_SOON_REMINDER" />
          <p className="flex items-start sm:items-center gap-3">
            <ClockIcon className="flex-shrink-0 text-amber-600" />
            <span><strong>{notification.bookTitle}</strong> is due soon — remember to return it to <strong>{notification.senderName}</strong></span>
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <a href={`/books/${notification.bookId}`} className="flex-1 sm:flex-none rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 text-center">View Book</a>
            <button className="flex-1 sm:flex-none rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-800 focus:bg-slate-900" type="submit" name="dismiss" value="true">Dismiss</button>
          </div>
        </form>
      );
    }

    return null;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getHistoryIcon = (type: string) => {
    switch (type) {
      case "FRIEND_REQUEST":
        return <PersonAddIcon className="mr-3 text-gray-400" />;
      case "BOOK_REQUEST":
        return <MenuBookIcon className="mr-3 text-gray-400" />;
      case "BOOK_APPROVED":
        return <CheckCircleIcon className="mr-3 text-gray-400" />;
      case "BOOK_RETURNED":
        return <KeyboardReturnIcon className="mr-3 text-gray-400" />;
      case "OVERDUE_REMINDER":
      case "DUE_SOON_REMINDER":
        return <ClockIcon className="mr-3 text-gray-400" />;
      default:
        return <HistoryIcon className="mr-3 text-gray-400" />;
    }
  };

  const getHistoryText = (notification: {
    type: string;
    senderName: string;
    bookTitle?: string | null;
    actionTaken?: string | null;
  }) => {
    const action = notification.actionTaken || "actioned";

    switch (notification.type) {
      case "FRIEND_REQUEST":
        return (
          <>
            <strong>{notification.senderName}</strong> friend request — <span className="text-gray-500">{action}</span>
          </>
        );
      case "BOOK_REQUEST":
        return (
          <>
            <strong>{notification.senderName}</strong> requested <strong>{notification.bookTitle}</strong> — <span className="text-gray-500">{action}</span>
          </>
        );
      case "BOOK_APPROVED":
        return (
          <>
            <strong>{notification.senderName}</strong> approved <strong>{notification.bookTitle}</strong> — <span className="text-gray-500">{action}</span>
          </>
        );
      case "BOOK_RETURNED":
        return (
          <>
            <strong>{notification.senderName}</strong> returned <strong>{notification.bookTitle}</strong> — <span className="text-gray-500">{action}</span>
          </>
        );
      case "OVERDUE_REMINDER":
        return (
          <>
            <strong>{notification.bookTitle}</strong> overdue reminder — <span className="text-gray-500">{action}</span>
          </>
        );
      case "DUE_SOON_REMINDER":
        return (
          <>
            <strong>{notification.bookTitle}</strong> due soon reminder — <span className="text-gray-500">{action}</span>
          </>
        );
      default:
        return <span>Notification — {action}</span>;
    }
  };

  return (
    <>
    <Breadcrumbs />
    <Layout title="Notifications">
      <section className="border rounded-lg p-4 sm:p-6">
        <h2 className="text-xl font-semibold mb-4">New</h2>
        {(data.user?.notificationsReceived?.length ?? 0) > 0 ? (
          <ul className="space-y-3">
            {data.user?.notificationsReceived?.map((notification) => (
              <li key={notification.id} className="bg-gray-50 rounded-lg p-4">
                {renderNotification(notification)}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 text-gray-500 py-4">
            <HourglassIcon />
            <span>No new notifications</span>
          </div>
        )}
      </section>

      {data.pendingBookRequests && data.pendingBookRequests.length > 0 && (
        <section className="border rounded-lg p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <HourglassIcon className="text-amber-500" />
            Pending Requests
          </h2>
          <ul className="space-y-3">
            {data.pendingBookRequests.map((request) => (
              <li key={request.id} className="bg-amber-50 dark:bg-amber-950 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="flex items-start sm:items-center gap-3">
                    <MenuBookIcon className="flex-shrink-0 text-amber-600" />
                    <span className="text-amber-800 dark:text-amber-200">
                      Waiting for <strong>{request.receiver.firstname} {request.receiver.surname}</strong> to respond to your request for <strong>{request.bookTitle}</strong>
                    </span>
                  </p>
                  <a
                    href={`/books/${request.bookId}`}
                    className="flex-shrink-0 rounded bg-amber-500 px-4 py-2 text-white hover:bg-amber-600 text-center text-sm"
                  >
                    View Book
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.history && data.history.length > 0 && (
        <section className="border rounded-lg p-4 sm:p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <HistoryIcon className="text-gray-400" />
            Recent Activity
          </h2>
          <ul className="space-y-2">
            {[...data.history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((notification) => (
              <li key={notification.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 py-3 px-3 bg-gray-50 rounded-lg text-gray-600 text-sm">
                <div className="flex items-start sm:items-center gap-3">
                  <span className="flex-shrink-0">{getHistoryIcon(notification.type)}</span>
                  <span>{getHistoryText(notification)}</span>
                </div>
                <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0 ml-7 sm:ml-0">
                  {formatDate(notification.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Layout>
    </>
  );
}