import type { ActionFunctionArgs } from "@remix-run/node";
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