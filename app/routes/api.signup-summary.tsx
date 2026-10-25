import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { cronAuthorized } from "~/cron.server";
import { sendDailySignupSummaries } from "~/models/admin.server";

// Emails the day's sign-ups to admins who chose a daily summary. Run once
// a day by GitHub's scheduled workflow, which holds CRON_SECRET_KEY.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!cronAuthorized(request)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }
  return json({ success: true, ...(await sendDailySignupSummaries()) });
};
