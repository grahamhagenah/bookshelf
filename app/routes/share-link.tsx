

import type { ActionFunctionArgs } from "react-router";

import { generateShareToken, getUserById } from "~/models/user.server";
import { publicOrigin } from "~/origin.server";
import { shelfPath } from "~/profile";
import { requireUserId } from "~/session.server";
import { SHARE_PROMPT_COOKIE, dismissCookie } from "~/share-prompt.server";

// Backs the "Share your bookshelf" prompt: make the public link, or put
// the prompt away for good

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const intent = (await request.formData()).get("intent");

  if (intent === "dismiss") {
    return Response.json(
      { dismissed: true },
      { headers: { "Set-Cookie": dismissCookie(SHARE_PROMPT_COOKIE) } },
    );
  }

  // Reuse an existing link rather than breaking one already handed out
  const user = await getUserById(userId);
  const shareToken = user?.shareToken ?? (await generateShareToken(userId));
  return Response.json({ url: `${publicOrigin(request)}${shelfPath({ handle: user?.handle, shareToken })}` });
};
