import Stripe from "stripe";

import { prisma } from "~/db.server";
import { PLUS_PRICES } from "~/plan";

// Stacks Plus through Stripe: Checkout to subscribe, Stripe's customer
// portal to change card or cancel, and a webhook that keeps each account's
// plan in step. Without STRIPE_SECRET_KEY it's all off and Settings says
// payments are coming.

const APP_URL = process.env.APP_URL || "http://localhost:3000";

export type Interval = "monthly" | "yearly";
export const isInterval = (value: unknown): value is Interval =>
  value === "monthly" || value === "yearly";

let client: Stripe | null = null;
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY isn't set");
  client ??= new Stripe(key);
  return client;
}

export const billingEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY);

// The prices are found by lookup key, and made the first time they're
// needed, so a new Stripe account (test or live) needs no setup
const LOOKUP_KEYS: Record<Interval, string> = {
  monthly: "stacks_plus_monthly",
  yearly: "stacks_plus_yearly",
};

// Stripe's tax category for a web app people pay for themselves; needed
// when Stripe handles sales tax (Managed Payments)
const TAX_CODE = "txcd_10103000";

async function priceFor(interval: Interval) {
  // Both prices at once: the other one says which product to add to
  const { data } = await stripe().prices.list({
    lookup_keys: Object.values(LOOKUP_KEYS),
    active: true,
    expand: ["data.product"],
  });
  const found = data.find((price) => price.lookup_key === LOOKUP_KEYS[interval]);
  const product = data.map((price) => price.product).find((each) => typeof each !== "string");
  // A product made before it had a tax category gets one
  if (product && typeof product !== "string" && !product.deleted && !product.tax_code) {
    await stripe().products.update(product.id, { tax_code: TAX_CODE });
  }
  if (found) return found.id;

  const price = await stripe().prices.create({
    currency: "usd",
    unit_amount: PLUS_PRICES[interval] * 100,
    recurring: { interval: interval === "monthly" ? "month" : "year" },
    lookup_key: LOOKUP_KEYS[interval],
    product:
      product && typeof product !== "string"
        ? product.id
        : (
            await stripe().products.create({
              name: "Stacks Plus",
              description: "Unlimited books and friends on Stacks",
              tax_code: TAX_CODE,
            })
          ).id,
  });
  return price.id;
}

// Their Stripe customer, made on first use and remembered
async function customerFor(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, firstname: true, surname: true, stripeCustomerId: true },
  });
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe().customers.create({
    email: user.email,
    name: `${user.firstname} ${user.surname}`,
    metadata: { userId },
  });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

// Where Upgrade sends someone: Stripe's own checkout page
export async function checkoutUrl(userId: string, interval: Interval) {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: await customerFor(userId),
    client_reference_id: userId,
    line_items: [{ price: await priceFor(interval), quantity: 1 }],
    subscription_data: { metadata: { userId } },
    allow_promotion_codes: true,
    // Back to Settings, which confirms the upgrade straight away rather
    // than waiting for the webhook
    success_url: `${APP_URL}/account?checkout={CHECKOUT_SESSION_ID}#plan`,
    cancel_url: `${APP_URL}/account#plan`,
  });
  if (!session.url) throw new Error("Stripe gave no checkout page");
  return session.url;
}

// Where Manage sends someone: Stripe's portal for their card and plan
export async function portalUrl(userId: string) {
  const session = await stripe().billingPortal.sessions.create({
    customer: await customerFor(userId),
    return_url: `${APP_URL}/account#plan`,
  });
  return session.url;
}

// Statuses that keep Plus on. Past due keeps it while Stripe retries the card.
const KEEPS_PLUS = new Set(["active", "trialing", "past_due"]);

const toDate = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000) : null);

// Brings an account in line with its subscription. Called by the webhook
// and when someone comes back from checkout; safe to run twice.
export async function applySubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const user =
    (await prisma.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true, stripeSubscriptionId: true } })) ??
    (subscription.metadata.userId
      ? await prisma.user.findUnique({
          where: { id: subscription.metadata.userId },
          select: { id: true, stripeSubscriptionId: true },
        })
      : null);
  if (!user) return null;

  const plus = KEEPS_PLUS.has(subscription.status);
  // An old subscription ending doesn't touch a newer one
  if (!plus && user.stripeSubscriptionId && user.stripeSubscriptionId !== subscription.id) {
    return user.id;
  }
  const renewsAt = toDate(subscription.items.data[0]?.current_period_end);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: plus ? "plus" : "free",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      planRenewsAt: plus ? renewsAt : null,
      // Cancelled, still paid up until the end of the period
      planEndsAt: plus
        ? (toDate(subscription.cancel_at) ?? (subscription.cancel_at_period_end ? renewsAt : null))
        : null,
    },
  });
  return user.id;
}

// The webhook's events that matter here
export async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await applySubscription(await stripe().subscriptions.retrieve(id));
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(event.data.object);
      return;
  }
}

// Coming back from checkout: confirm it now, so Settings shows Plus at once
export async function confirmCheckout(userId: string, sessionId: string) {
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
  if (session.client_reference_id !== userId || !session.subscription) return;
  const subscription =
    typeof session.subscription === "string"
      ? await stripe().subscriptions.retrieve(session.subscription)
      : session.subscription;
  await applySubscription(subscription);
}

// Deleting an account stops its billing too
export async function cancelBilling(userIds: string[]) {
  if (!billingEnabled()) return;
  const subscribed = await prisma.user.findMany({
    where: { id: { in: userIds }, stripeSubscriptionId: { not: null }, plan: "plus" },
    select: { stripeSubscriptionId: true },
  });
  for (const { stripeSubscriptionId } of subscribed) {
    if (!stripeSubscriptionId) continue;
    try {
      await stripe().subscriptions.cancel(stripeSubscriptionId);
    } catch (error) {
      console.error("Couldn't cancel a subscription for a deleted account", error);
    }
  }
}
