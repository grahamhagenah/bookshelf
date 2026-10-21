import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { generateShareToken, getUserById } from "~/models/user.server";
import { publicOrigin } from "~/origin.server";
import { requireUserId } from "~/session.server";
import { SHARE_PROMPT_COOKIE } from "~/share-prompt.server";

// Backs the "Share your bookshelf" prompt: make the public link, or put
// the prompt away for good

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const intent = (await request.formData()).get("intent");

  if (intent === "dismiss") {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    return json(
      { dismissed: true },
      {
        headers: {
          "Set-Cookie": `${SHARE_PROMPT_COOKIE}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${secure}`,
        },
      },
    );
  }

  // Reuse an existing link rather than breaking one already handed out
  const user = await getUserById(userId);
  const token = user?.shareToken ?? (await generateShareToken(userId));
  return json({ url: `${publicOrigin(request)}/share/${token}` });
};
