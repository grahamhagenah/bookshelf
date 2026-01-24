import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUserId } from "~/session.server";
import { createFriendship, getUserById, deleteNotification, createBookApprovedNotification } from "~/models/user.server";
import { lendBook } from "~/models/book.server";
import Layout from "~/components / Layout/Layout";
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return {user};
}

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
    await deleteNotification(notificationId);
  } else if (formData.get("friend_request") === "decline") {
    await deleteNotification(notificationId);
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

      await deleteNotification(notificationId);
    } else if (formData.get("book_request") === "decline") {
      await deleteNotification(notificationId);
    }
  }

  // Handle book approved notification (just dismiss it)
  if (notificationType === "BOOK_APPROVED") {
    if (formData.get("dismiss") === "true") {
      await deleteNotification(notificationId);
    }
  }

  // Handle book returned notification (just dismiss it)
  if (notificationType === "BOOK_RETURNED") {
    if (formData.get("dismiss") === "true") {
      await deleteNotification(notificationId);
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
        <form method="post" className="flex justify-between items-center">
          <input type="hidden" name="senderId" value={notification.senderId} />
          <input type="hidden" name="notificationId" value={notification.id} />
          <input type="hidden" name="notificationType" value="FRIEND_REQUEST" />
          <p><PersonAddIcon className="mr-4 mb-1"/><strong>{notification.senderName + " "}</strong> sent a friend request</p>
          <div>
            <button className="mx-1 w-half rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400" type="submit" name="friend_request" value="accept">Accept</button>
            <button className="mx-1 w-half rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-800 focus:bg-slate-900" type="submit" name="friend_request" value="decline">Decline</button>
          </div>
        </form>
      );
    }

    if (notificationType === "BOOK_REQUEST") {
      return (
        <form method="post" className="flex justify-between items-center">
          <input type="hidden" name="senderId" value={notification.senderId} />
          <input type="hidden" name="notificationId" value={notification.id} />
          <input type="hidden" name="notificationType" value="BOOK_REQUEST" />
          <input type="hidden" name="bookId" value={notification.bookId || ""} />
          <input type="hidden" name="bookTitle" value={notification.bookTitle || ""} />
          <p><MenuBookIcon className="mr-4 mb-1"/><strong>{notification.senderName}</strong> wants to borrow <strong>{notification.bookTitle}</strong></p>
          <div>
            <button className="mx-1 w-half rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400" type="submit" name="book_request" value="approve">Approve</button>
            <button className="mx-1 w-half rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-800 focus:bg-slate-900" type="submit" name="book_request" value="decline">Decline</button>
          </div>
        </form>
      );
    }

    if (notificationType === "BOOK_APPROVED") {
      return (
        <form method="post" className="flex justify-between items-center">
          <input type="hidden" name="senderId" value={notification.senderId} />
          <input type="hidden" name="notificationId" value={notification.id} />
          <input type="hidden" name="notificationType" value="BOOK_APPROVED" />
          <p><CheckCircleIcon className="mr-4 mb-1 text-green-600"/><strong>{notification.senderName}</strong> approved your request for <strong>{notification.bookTitle}</strong></p>
          <div>
            <button className="mx-1 w-half rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-800 focus:bg-slate-900" type="submit" name="dismiss" value="true">Dismiss</button>
          </div>
        </form>
      );
    }

    if (notificationType === "BOOK_RETURNED") {
      return (
        <form method="post" className="flex justify-between items-center">
          <input type="hidden" name="senderId" value={notification.senderId} />
          <input type="hidden" name="notificationId" value={notification.id} />
          <input type="hidden" name="notificationType" value="BOOK_RETURNED" />
          <p><KeyboardReturnIcon className="mr-4 mb-1 text-amber-600"/><strong>{notification.senderName}</strong> returned <strong>{notification.bookTitle}</strong></p>
          <div>
            <button className="mx-1 w-half rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-800 focus:bg-slate-900" type="submit" name="dismiss" value="true">Dismiss</button>
          </div>
        </form>
      );
    }

    return null;
  };

  return (
    <Layout title="Notifications">
      <ul className="notifications">
      {(data.user?.notificationsReceived?.length ?? 0) > 0 ?
        data.user?.notificationsReceived?.map((notification) => (
          <li key={notification.id} className="my-1 bg-stone-50 rounded-lg p-5">
            {renderNotification(notification)}
          </li>
        ))
        :
        <li className="my-1 bg-stone-50 rounded-lg p-5">
          <HourglassTopIcon className="mb-1 mr-3"/>
          <h2 className="inline">You dont have any notifications just yet, but keep waiting...</h2>
        </li>}
      </ul>
    </Layout>
  )
}