import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { GuidePage, GuideSection, proseLink } from "~/components/guide";
import { seo } from "~/seo";

// What Stacks keeps about people, who sees it, and who helps run it

export const meta: MetaFunction = () =>
  seo({
    title: "Privacy",
    description: "What Stacks keeps about you, who can see it, and how to take it with you or delete it.",
    path: "/privacy",
  });

const UPDATED = "October 22, 2026";

const strong = "font-semibold text-stone-900 dark:text-stone-100";
const list = "list-disc space-y-2 pl-5 marker:text-stone-300 dark:marker:text-stone-600";

export default function Privacy() {
  return (
    <GuidePage
      eyebrow={`Last updated ${UPDATED}`}
      title="Privacy"
      intro={
        <>
          Stacks keeps what it needs to run your shelf and nothing more. There are no ads, no
          trackers or analytics, and your information is never sold.
        </>
      }
      cta={false}
    >
      <GuideSection title="What Stacks keeps">
        <ul className={list}>
          <li>
            <strong className={strong}>Your account:</strong> your name, email address, profile
            icon and settings. Your password is stored only as a one-way hash, so nobody can read
            it.
          </li>
          <li>
            <strong className={strong}>Your shelf:</strong> the books you add and their details,
            your want-to-read list, reader notes and hearts, and when you marked books read.
          </li>
          <li>
            <strong className={strong}>Between you and friends:</strong> who your friends are,
            friend and borrow requests, loans and due dates, places in line, and anyone you share
            a shelf with.
          </li>
          <li>
            <strong className={strong}>Messages you send:</strong> feedback, with the page you
            sent it from.
          </li>
          <li>
            <strong className={strong}>Stacks Plus:</strong> Stripe&apos;s reference numbers for
            you and your subscription, its status, and when it renews or ends. Your card details
            go straight to Stripe; Stacks never sees them.
          </li>
          <li>
            <strong className={strong}>Cookies:</strong> one to keep you signed in, and two that
            remember you&apos;ve dismissed a banner. Nothing for tracking.
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="Who can see what">
        <ul className={list}>
          <li>
            <strong className={strong}>Your friends</strong> see your shelf, which of your books
            are on loan, and the notes you leave on books they can see.
          </li>
          <li>
            <strong className={strong}>Anyone you share a shelf with</strong> sees and manages the
            shelf with you; your notes and friends stay your own.
          </li>
          <li>
            <strong className={strong}>Anyone with your public link</strong> sees your name and
            the books on your shelf. You can turn the link off in Settings.
          </li>
          <li>
            <strong className={strong}>Stacks&apos; admin</strong> can see account details to help
            with problems and keep the service running, and doesn&apos;t look further than that
            needs.
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="Who helps run Stacks">
        <p>These services handle some of your information for Stacks, and only for that:</p>
        <ul className={list}>
          <li>
            <strong className={strong}>Fly.io</strong> runs the server, in the United States.
          </li>
          <li>
            <strong className={strong}>Cloudflare R2</strong> stores backups of the database,
            kept for 30 days.
          </li>
          <li>
            <strong className={strong}>Resend</strong> sends the emails.
          </li>
          <li>
            <strong className={strong}>Stripe</strong> takes payments for Stacks Plus.
          </li>
          <li>
            <strong className={strong}>Open Library</strong> supplies book details and covers. Your
            searches are sent to it from the Stacks server, not your browser, and covers come from
            Stacks&apos; own copy.
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="Email">
        <p>
          Stacks emails you to confirm your address, when a friend asks to borrow a book, and with
          a weekly roundup. Each email has a link at the bottom to stop that kind, and you can
          change both in Settings. Account emails, like password resets, always come through.
        </p>
      </GuideSection>

      <GuideSection title="Taking it with you, or deleting it">
        <p>
          You can download your shelf as a spreadsheet from Settings, and change your details
          there any time. To delete your account and everything in it,{" "}
          <Link to="/feedback?from=/privacy" className={proseLink}>ask through the feedback page</Link>
          . Deleted data is gone from the live site
          straight away and from backups within 30 days. Demo accounts delete themselves after a
          day.
        </p>
        <p>
          Wherever you live, you can ask what Stacks keeps about you, have it corrected, or have it
          deleted.
        </p>
      </GuideSection>

      <GuideSection title="Children">
        <p>Stacks isn&apos;t meant for anyone under 13, and doesn&apos;t knowingly keep their information.</p>
      </GuideSection>

      <GuideSection title="Changes">
        <p>
          If this policy changes in a way that matters, you&apos;ll hear about it by email or on
          the site first. The terms of using Stacks are{" "}
          <Link to="/terms" className={proseLink}>here</Link>. Questions?{" "}
          <Link to="/feedback?from=/privacy" className={proseLink}>Send a note</Link>.
        </p>
      </GuideSection>
    </GuidePage>
  );
}
