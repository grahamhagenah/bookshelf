import type { ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { redirect } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import { createFriendship } from "~/models/user.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { getUserById } from "~/models/user.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return {user};
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const senderId = formData.get("senderId");

  await createFriendship(userId, senderId)

  return redirect(`/friends`);
};

export default function Notifications() {

  const data = useLoaderData<typeof loader>();

  // Create action for each button to determine server functions
  // Look into creating layout components to establish consistency

  return (
    <div className="flex h-4/6 flex-col justify-center">
      <div className="mx-auto w-full max-w-2xl px-8">
        <h1 className="text-4xl mb-20">Notifications</h1>
        <ul className="notifications">
          
          {data.user?.notificationsReceived.map((notification) => (
            <li key={notification.id} className="my-3 bg-stone-50 rounded-lg p-5">
              <form className="flex justify-between items-center">
                <input type="hidden" name="senderId" value={notification.senderId} />
                <p><strong>{notification.senderName + " "}</strong> sent a friend request</p>
                <div>
                  <button className="mx-1 w-half rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400" type="submit">Accept</button>
                  <button className="mx-1 w-half rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-800 focus:bg-slate-900" type="submit">Decline</button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}