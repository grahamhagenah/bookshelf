// @vitest-environment node
// The default import, as Stripe documents it
// eslint-disable-next-line import-x/no-named-as-default
import type Stripe from "stripe";

import { makeUser, prisma } from "../test/db";
import { routeArgs } from "../test/route";

import { applySubscription, stripe } from "./billing.server";
import { createHouseholdInvite, joinHousehold } from "./models/household.server";
import { getPlanUsage, hasPlus } from "./plan.server";
import { action as webhook } from "./routes/api.stripe-webhook";

// Fake keys: nothing here talks to Stripe
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";
});

const DAY = 24 * 60 * 60;
const inAMonth = Math.floor(Date.now() / 1000) + 30 * DAY;

// A subscription as Stripe sends it, cut down to what Stacks reads
function subscription(over: Partial<Stripe.Subscription> & { userId?: string } = {}) {
  const { userId, ...rest } = over;
  return {
    id: "sub_1",
    object: "subscription",
    customer: "cus_1",
    status: "active",
    metadata: userId ? { userId } : {},
    items: { data: [{ current_period_end: inAMonth, price: { unit_amount: 300, recurring: { interval: "month" } } }] },
    start_date: Math.floor(Date.now() / 1000),
    cancel_at: null,
    cancel_at_period_end: false,
    ...rest,
  } as unknown as Stripe.Subscription;
}

const planOf = (id: string) =>
  prisma.user.findUniqueOrThrow({
    where: { id },
    select: { plan: true, subscriptionStatus: true, planRenewsAt: true, planEndsAt: true, stripeCustomerId: true },
  });

test("a new subscription turns Plus on, found by the account it names", async () => {
  const me = await makeUser("Me");
  await applySubscription(subscription({ userId: me.id }));
  const plan = await planOf(me.id);
  expect(plan).toMatchObject({ plan: "plus", subscriptionStatus: "active", stripeCustomerId: "cus_1", planEndsAt: null });
  // What they pay, for the dashboard
  expect(
    await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { planInterval: true, planAmount: true } }),
  ).toEqual({ planInterval: "month", planAmount: 300 });
  expect(plan.planRenewsAt?.getTime()).toBe(inAMonth * 1000);
});

test("canceling keeps Plus to the end of the period, then ends it", async () => {
  const me = await makeUser("Me");
  await applySubscription(subscription({ userId: me.id, customer: "cus_2", id: "sub_2" }));
  await applySubscription(subscription({ customer: "cus_2", id: "sub_2", cancel_at_period_end: true }));
  expect(await planOf(me.id)).toMatchObject({ plan: "plus" });
  expect((await planOf(me.id)).planEndsAt?.getTime()).toBe(inAMonth * 1000);

  await applySubscription(subscription({ customer: "cus_2", id: "sub_2", status: "canceled" }));
  expect(await planOf(me.id)).toMatchObject({ plan: "free", planEndsAt: null, planRenewsAt: null });
});

test("a failed payment keeps Plus while Stripe retries", async () => {
  const me = await makeUser("Me");
  await applySubscription(subscription({ userId: me.id, customer: "cus_3", id: "sub_3", status: "past_due" }));
  expect(await planOf(me.id)).toMatchObject({ plan: "plus", subscriptionStatus: "past_due" });
  expect((await getPlanUsage(me.id)).own).toMatchObject({ paid: true, pastDue: true });
});

test("an old subscription ending leaves a newer one alone", async () => {
  const me = await makeUser("Me");
  await applySubscription(subscription({ userId: me.id, customer: "cus_4", id: "sub_new" }));
  await applySubscription(subscription({ customer: "cus_4", id: "sub_old", status: "canceled" }));
  expect(await planOf(me.id)).toMatchObject({ plan: "plus" });
});

test("one subscription covers the whole shared shelf", async () => {
  const payer = await makeUser("Priya");
  const housemate = await makeUser("Sam");
  await joinHousehold(housemate.id, await createHouseholdInvite(payer.id));
  await applySubscription(subscription({ userId: payer.id, customer: "cus_5", id: "sub_5" }));
  expect(await hasPlus(housemate.id)).toBe(true);
  expect(await getPlanUsage(housemate.id)).toMatchObject({ plus: true, coveredBy: "Priya", own: null });
});

test("the webhook acts on signed events and turns away anything else", async () => {
  const me = await makeUser("Me");
  const event = {
    id: "evt_1",
    object: "event",
    type: "customer.subscription.created",
    data: { object: subscription({ userId: me.id, customer: "cus_6", id: "sub_6" }) },
  };
  const payload = JSON.stringify(event);
  const post = (signature: string) =>
    webhook(
      routeArgs(
        new Request("http://localhost/api/stripe-webhook", {
          method: "POST",
          body: payload,
          headers: { "stripe-signature": signature },
        }),
      ),
    );

  expect((await post("t=1,v1=forged")).status).toBe(400);
  expect(await planOf(me.id)).toMatchObject({ plan: "free" });

  const signature = await stripe().webhooks.generateTestHeaderStringAsync({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  });
  expect((await post(signature)).status).toBe(200);
  expect(await planOf(me.id)).toMatchObject({ plan: "plus" });
});
