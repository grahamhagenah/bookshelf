import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import DemoButton from "~/components/demo-button";
import { GuidePage, GuideSection, proseLink } from "~/components/guide";
import { CheckCircleIcon } from "~/components/icons";
import { FREE_LIMITS, PLUS_PRICES, UPGRADE_PATH } from "~/plan";
import { hasPlus } from "~/plan.server";
import { seo } from "~/seo";
import { getUserId } from "~/session.server";

// What Stacks costs: free up to a point, Plus beyond it

export const meta: MetaFunction = () =>
  seo({
    title: "Pricing",
    description: `Stacks is free for up to ${FREE_LIMITS.books} books and ${FREE_LIMITS.friends} friends. Stacks Plus lifts both limits for $${PLUS_PRICES.monthly} a month or $${PLUS_PRICES.yearly} a year.`,
    path: "/pricing",
  });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  return json({
    signedIn: Boolean(userId),
    plus: userId ? await hasPlus(userId) : false,
  });
};

const FREE_FEATURES = [
  `Up to ${FREE_LIMITS.books} books on your shelf`,
  `Up to ${FREE_LIMITS.friends} friends`,
  "Lending with due dates and reminders",
  "A want-to-read list, with no limit",
  "Reader notes and hearts",
  "Import from Goodreads or StoryGraph",
  "A shared shelf for your household",
  "A public link to your shelf",
];

const PLUS_FEATURES = [
  "Unlimited books",
  "Unlimited friends",
  "Everything in Free",
  "One subscription covers everyone on a shared shelf",
];

function Features({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 space-y-2 text-sm text-stone-700 dark:text-stone-300">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <CheckCircleIcon size={18} className="mt-px flex-shrink-0 text-forest-600 dark:text-forest-400" />
          {item}
        </li>
      ))}
    </ul>
  );
}

const primaryButton =
  "inline-flex w-full items-center justify-center rounded-md bg-forest-600 px-4 py-2.5 font-medium text-white hover:bg-forest-700 transition-colors";
const quietButton =
  "inline-flex w-full items-center justify-center rounded-md border border-stone-200 dark:border-stone-700 px-4 py-2.5 font-medium text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";

export default function Pricing() {
  const { signedIn, plus } = useLoaderData<typeof loader>();

  return (
    <GuidePage
      eyebrow="Pricing"
      title="Free for most shelves. A few dollars for big ones."
      intro={
        <>
          Stacks is free for up to {FREE_LIMITS.books} books and {FREE_LIMITS.friends} friends,
          which covers most home libraries. If yours outgrows that, Stacks Plus lifts both limits.
        </>
      }
      cta={false}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="flex flex-col rounded-xl border border-stone-200 dark:border-stone-800 p-6">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Free</h2>
          <p className="mt-2">
            <span className="text-3xl font-bold text-stone-900 dark:text-stone-50">$0</span>
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">For as long as you like</p>
          <Features items={FREE_FEATURES} />
          <div className="mt-auto pt-6">
            {signedIn ? (
              <p className="text-center text-sm text-stone-500 dark:text-stone-400">
                {plus ? "Included in your plan" : "Your current plan"}
              </p>
            ) : (
              <Link to="/join" className={quietButton}>
                Create a free account
              </Link>
            )}
          </div>
        </section>

        <section className="flex flex-col rounded-xl border-2 border-forest-600 dark:border-forest-400 p-6">
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Stacks Plus</h2>
          <p className="mt-2">
            <span className="text-3xl font-bold text-stone-900 dark:text-stone-50">${PLUS_PRICES.monthly}</span>
            <span className="text-stone-500 dark:text-stone-400"> a month</span>
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            or ${PLUS_PRICES.yearly} a year, a third off
          </p>
          <Features items={PLUS_FEATURES} />
          <div className="mt-auto pt-6">
            {plus ? (
              <p className="text-center text-sm font-medium text-forest-700 dark:text-forest-400">
                You&apos;re on Stacks Plus
              </p>
            ) : signedIn ? (
              <Link to={UPGRADE_PATH} className={primaryButton}>
                Upgrade in Settings
              </Link>
            ) : (
              <Link to="/join" className={primaryButton}>
                Start free, upgrade any time
              </Link>
            )}
          </div>
        </section>
      </div>

      {!signedIn ? (
        // The demo button is a form, so the line is laid out as a row
        <div className="flex flex-wrap items-baseline justify-center gap-x-1 text-sm text-stone-500 dark:text-stone-400">
          <span>Not sure yet?</span>
          <DemoButton className={proseLink}>Look around a demo library</DemoButton>
          <span>— no account needed.</span>
        </div>
      ) : null}

      <GuideSection title="What counts toward the limits?">
        <p>
          <strong className="font-semibold text-stone-900 dark:text-stone-100">Books</strong> are
          the ones on your shelf. Books you&apos;ve borrowed and your want-to-read list don&apos;t
          count. If you share a shelf with someone you live with, your books count together.
        </p>
        <p>
          <strong className="font-semibold text-stone-900 dark:text-stone-100">Friends</strong> are
          people you&apos;ve become friends with on Stacks. The limit is each person&apos;s own, so
          a friend who already has {FREE_LIMITS.friends} would need room too.
        </p>
      </GuideSection>

      <GuideSection title="What if I reach a limit, or stop paying?">
        <p>
          Nothing is ever deleted or hidden. You just can&apos;t add more books or friends until
          you&apos;re back under the limit or on Plus again. Lending, notes and everything else
          keep working.
        </p>
      </GuideSection>

      <GuideSection title="Paying and canceling">
        <p>
          Payments go through Stripe, so Stacks never sees your card. Prices are in US dollars,
          and sales tax or VAT is added at checkout where it applies. Plus renews automatically;
          cancel any time from Settings and it stays on until the end of the period you&apos;ve
          paid for.
        </p>
        <p>
          More detail is in the <Link to="/terms" className={proseLink}>terms</Link>, and what
          Stacks keeps about you is in the{" "}
          <Link to="/privacy" className={proseLink}>privacy policy</Link>. Questions?{" "}
          <Link to="/feedback?from=/pricing" className={proseLink}>Send a note</Link>.
        </p>
      </GuideSection>
    </GuidePage>
  );
}
