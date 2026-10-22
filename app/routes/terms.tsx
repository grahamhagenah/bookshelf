import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { GuidePage, GuideSection, proseLink } from "~/components/guide";
import { FREE_LIMITS, PLUS_PRICES } from "~/plan";
import { seo } from "~/seo";

// The terms of using Stacks, in plain words

export const meta: MetaFunction = () =>
  seo({
    title: "Terms",
    description: "The terms for using Stacks, including Stacks Plus subscriptions.",
    path: "/terms",
  });

export const TERMS_UPDATED = "October 22, 2026";

const strong = "font-semibold text-stone-900 dark:text-stone-100";

export default function Terms() {
  return (
    <GuidePage
      eyebrow={`Last updated ${TERMS_UPDATED}`}
      title="Terms of use"
      intro={
        <>
          Stacks (bookstacks.app) is made and run by Graham Hagenah. By using it you agree to these
          terms. They&apos;re written to be read; if anything is unclear,{" "}
          <Link to="/feedback?from=/terms" className={proseLink}>ask</Link>.
        </>
      }
      cta={false}
    >
      <GuideSection title="Your account">
        <p>
          You need to be at least 13 to use Stacks. Use your real name and an email address you can
          read, keep your password to yourself, and keep one account per person. You&apos;re
          responsible for what happens under your account.
        </p>
        <p>
          The demo is a sandbox anyone can try; it, and everything in it, is deleted after a day.
        </p>
      </GuideSection>

      <GuideSection title="What you put on Stacks">
        <p>
          Your shelf, notes and everything else you add stay yours. You let Stacks store them and
          show them to the people you choose: your friends, anyone you share a shelf with, and
          anyone you give your public link to. Don&apos;t post anything unlawful, hateful, or that
          isn&apos;t yours to share, and don&apos;t use Stacks to harass anyone.
        </p>
      </GuideSection>

      <GuideSection title="Lending between friends">
        <p>
          Stacks keeps track of who has which book and when it&apos;s due, but the books and the
          arrangements are between you and your friends. Stacks isn&apos;t responsible for a book
          that comes back late, damaged, or not at all.
        </p>
      </GuideSection>

      <GuideSection title="The free plan and Stacks Plus">
        <p>
          The free plan holds {FREE_LIMITS.books} books and {FREE_LIMITS.friends} friends. Stacks
          Plus lifts both limits for ${PLUS_PRICES.monthly} a month or ${PLUS_PRICES.yearly} a
          year, in US dollars, plus any sales tax or VAT that applies. One subscription covers
          everyone on a shared shelf.
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-stone-300 dark:marker:text-stone-600">
          <li>
            <strong className={strong}>Renewal.</strong> Plus renews automatically at the end of
            each month or year until you cancel.
          </li>
          <li>
            <strong className={strong}>Canceling.</strong> Cancel any time from Settings. Plus
            stays on until the end of the period you&apos;ve paid for, then your account goes back
            to the free plan.
          </li>
          <li>
            <strong className={strong}>Refunds.</strong> Payments aren&apos;t refunded for part of
            a period, except where the law says otherwise. If you were charged by mistake,{" "}
            <Link to="/feedback?from=/terms" className={proseLink}>get in touch</Link> and
            it&apos;ll be put right.
          </li>
          <li>
            <strong className={strong}>Payments.</strong> Stripe processes payments, and Stacks
            never sees your card. At checkout Stripe, or its Link service, may act as the seller
            and collect tax; its terms apply to the payment too.
          </li>
          <li>
            <strong className={strong}>Changes.</strong> If the price or the free plan&apos;s
            limits change, you&apos;ll hear by email at least 30 days before it affects you.
            Going over a limit never deletes or hides anything.
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="Using Stacks fairly">
        <p>
          Don&apos;t try to break into accounts or the service, overload it, scrape it, or use it
          to send spam. Accounts that do may be suspended.
        </p>
      </GuideSection>

      <GuideSection title="Book details">
        <p>
          Titles, covers and descriptions come from{" "}
          <a href="https://openlibrary.org" target="_blank" rel="noreferrer" className={proseLink}>
            Open Library
          </a>{" "}
          and can be wrong. You can edit them on your own books.
        </p>
      </GuideSection>

      <GuideSection title="Stopping">
        <p>
          You can stop using Stacks whenever you like. You can export your shelf, and delete your
          account, from Settings; deleting it cancels any subscription. Stacks may close an account
          that breaks these terms, and will tell you why.
        </p>
      </GuideSection>

      <GuideSection title="The fine print">
        <p>
          Stacks is provided as it is, without guarantees that it will always be available or free
          of mistakes. As far as the law allows, Stacks isn&apos;t liable for indirect losses, and
          its total liability to you is limited to what you&apos;ve paid in the last 12 months.
          Nothing here takes away rights you have under consumer law where you live.
        </p>
        <p>
          These terms may change as Stacks does. For significant changes you&apos;ll get notice by
          email or on the site before they take effect. What Stacks keeps about you is in the{" "}
          <Link to="/privacy" className={proseLink}>privacy policy</Link>.
        </p>
      </GuideSection>
    </GuidePage>
  );
}
