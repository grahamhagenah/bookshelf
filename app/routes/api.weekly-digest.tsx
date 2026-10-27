

import type { LoaderFunctionArgs } from "react-router";

import { cronAuthorized } from "~/cron.server";
import { renderDigest, sendDigestEmail } from "~/email.server";
import { buildDigest, digestIsEmpty, getDigestRecipients } from "~/models/digest.server";
import { getUserById, isUserAdmin } from "~/models/user.server";
import { pageUrl } from "~/page-url";
import { getUserId } from "~/session.server";

// Sends the weekly email to everyone with something to hear about. Run
// once a week by GitHub's scheduled workflow, which holds CRON_SECRET_KEY. An admin can
// open ?preview=1 to see their own digest as it would be sent.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = pageUrl(request);

  if (url.searchParams.get("preview")) {
    const userId = await getUserId(request);
    const user = userId && (await isUserAdmin(userId)) ? await getUserById(userId) : null;
    if (!user) return Response.json({ error: "Admins only" }, { status: 403 });
    const digest = await buildDigest(user.id);
    if (digestIsEmpty(digest)) {
      return new Response("Nothing to send this week.", { headers: { "Content-Type": "text/plain" } });
    }
    const { html } = renderDigest({ toUserId: user.id, toName: user.firstname, digest });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (!cronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sent = 0;
  let skipped = 0;
  for (const user of await getDigestRecipients()) {
    const digest = await buildDigest(user.id);
    if (digestIsEmpty(digest)) {
      skipped++;
      continue;
    }
    const result = await sendDigestEmail({
      toEmail: user.email,
      toUserId: user.id,
      toName: user.firstname,
      digest,
    });
    if (result.success) sent++;
    else skipped++;
  }
  return Response.json({ success: true, sent, skipped });
};
