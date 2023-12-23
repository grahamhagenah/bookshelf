import type { ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { requireUserId } from "~/session.server";
import { createFriendship } from "~/models/user.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { getUserById } from "~/models/user.server";
import { deleteNotification } from "~/models/user.server";
import Layout from "~/components / Layout/Layout";
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return {user};
}

export const action = async ({ request }: ActionFunctionArgs) => {

  const userId = await requireUserId(request);
  const formData = await request.formData();
  const senderId = formData.get("senderId");
  const notificationId = formData.get("notificationId")

  if(formData.get("friend_request") === "accept"){
    await createFriendship(userId, senderId)
    await deleteNotification(notificationId)
  }
  else if(formData.get("friend_request") === "decline") {
    await deleteNotification(notificationId)
  }

  return null
};

export default function Notifications() {

  const data = useLoaderData<typeof loader>();

  return (
    <Layout title="Notifications">
      <ul className="notifications md:w-3/4">
      {data.user?.notificationsReceived > 0 ?
        data.user?.notificationsReceived.map((notification) => (
          <li key={notification.id} className="my-1 bg-stone-50 rounded-lg p-5">
            <form method="post" className="flex justify-between items-center">
              <input type="hidden" name="senderId" value={notification.senderId} />
              <input type="hidden" name="notificationId" value={notification.id} />
              <p><PersonAddIcon className="mr-4 mb-1"/><strong>{notification.senderName + " "}</strong> sent a friend request</p>
              <div>
                <button className="mx-1 w-half rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400" type="submit" name="friend_request" value="accept">Accept</button>
                <button className="mx-1 w-half rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-800 focus:bg-slate-900" type="submit" name="friend_request" value="decline">Decline</button>
              </div>
            </form>
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