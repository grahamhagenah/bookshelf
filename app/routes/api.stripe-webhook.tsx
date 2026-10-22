import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { handleEvent, stripe } from "~/billing.server";

// Stripe tells Stacks when a subscription starts, renews, changes or ends.
// Every call is signed with STRIPE_WEBHOOK_SECRET; anything unsigned is
// turned away.

export const action = async ({ request }: ActionFunctionArgs) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return json({ error: "Not signed" }, { status: 400 });

  let event;
  try {
    // The signature covers the body exactly as sent
    event = await stripe().webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return json({ error: "Bad signature" }, { status: 400 });
  }
  await handleEvent(event);
  return json({ received: true });
};
