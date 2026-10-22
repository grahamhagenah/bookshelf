import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";

import { billingEnabled, checkoutUrl, isInterval, portalUrl } from "~/billing.server";
import { getDemoGroup } from "~/models/demo.server";
import { requireUserId } from "~/session.server";

// The Upgrade and Manage buttons in Settings: each sends you on to the
// right Stripe page

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  if (!billingEnabled()) return json({ error: "Payments aren't set up yet" }, { status: 503 });
  if (await getDemoGroup(userId)) return json({ error: "The demo can't subscribe" }, { status: 403 });

  const form = await request.formData();
  const intent = form.get("intent");
  try {
    if (intent === "checkout") {
      const interval = form.get("interval");
      if (!isInterval(interval)) return json({ error: "Pick monthly or yearly" }, { status: 400 });
      return redirect(await checkoutUrl(userId, interval));
    }
    if (intent === "portal") return redirect(await portalUrl(userId));
  } catch (error) {
    // Back to Settings with a note, never Stripe's raw error
    console.error("Stripe refused", error);
    return redirect("/account?billing=failed#plan");
  }
  return json({ error: "Unknown action" }, { status: 400 });
};
