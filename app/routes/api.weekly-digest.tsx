import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { renderDigest, sendDigestEmail } from "~/email.server";
import { buildDigest, digestIsEmpty, getDigestRecipients } from "~/models/digest.server";
import { getUserById, isUserAdmin } from "~/models/user.server";
import { getUserId } from "~/session.server";

// Sends the weekly email to everyone with something to hear about. Run
// once a week by a cron job, with ?key=CRON_SECRET_KEY. An admin can
// open ?preview=1 to see their own digest as it would be sent.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("preview")) {
    const userId = await getUserId(request);
    const user = userId && (await isUserAdmin(userId)) ? await getUserById(userId) : null;
    if (!user) return json({ error: "Admins only" }, { status: 403 });
    const digest = await buildDigest(user.id);
    if (digestIsEmpty(digest)) {
      return new Response("Nothing to send this week.", { headers: { "Content-Type": "text/plain" } });
    }
    const { html } = renderDigest({ toName: user.firstname, digest });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const expectedKey = process.env.CRON_SECRET_KEY;
  if (expectedKey && url.searchParams.get("key") !== expectedKey) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let sent = 0;
  let skipped = 0;
  for (const user of await getDigestRecipients()) {
    const digest = await buildDigest(user.id);
    if (digestIsEmpty(digest)) {
      skipped++;
      continue;
    }
    const result = await sendDigestEmail({ toEmail: user.email, toName: user.firstname, digest });
    if (result.success) sent++;
    else skipped++;
  }
  return json({ success: true, sent, skipped });
};
