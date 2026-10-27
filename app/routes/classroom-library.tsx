import { Link } from "react-router";
import type { MetaFunction } from "react-router";

import { GuidePage, GuideSection, proseLink } from "~/components/guide";
import { ShowcaseDesk } from "~/components/showcase";
import { FREE_LIMITS, PLUS_PRICES } from "~/plan";
import { seo } from "~/seo";

// For teachers looking for a way to check books in and out of a classroom
// library: the check-out desk, a class list of names, and what's kept
// about students

export const meta: MetaFunction = () =>
  seo({
    title: "A simple classroom library checkout",
    description:
      "Check classroom library books in and out with a scan and a tap on a student's name. No student accounts or email, late books flagged for you, and free to start.",
    path: "/classroom-library",
  });

const STEPS: [string, React.ReactNode][] = [
  [
    "Add your books.",
    <>
      Scan the barcodes with your phone, or{" "}
      <Link to="/import" className={proseLink}>
        import a spreadsheet
      </Link>{" "}
      with Title and Author columns. Several copies of one book are a class set, and that&apos;s fine.
    </>,
  ],
  [
    "Paste in your class list.",
    "One name a line, on the check-out desk. Students need no accounts and no email.",
  ],
  [
    "Check out with a scan.",
    "Scan a book and tap the student's name. It's due back in two weeks, or however long you choose. A barcode reader plugged into a classroom computer works as well as a phone's camera.",
  ],
  ["Check in with a scan.", "Scan it again when it comes back, and it's back on the shelf."],
  [
    "See what's out.",
    "The desk lists every book that's out, who has it, and what's late. Late books come to your alerts, and to your email if you like.",
  ],
];

export default function ClassroomLibrary() {
  return (
    <GuidePage
      eyebrow="Classroom libraries"
      title="A classroom library checkout that takes a second"
      intro={
        <>
          Classroom libraries lose books the same way: a student takes one home, nobody writes
          it down, and by spring the shelf is half empty. Stacks keeps the list for you, and
          checking a book out is a scan and a tap.
        </>
      }
    >
      <GuideSection title="How it works">
        <ol className="space-y-3">
          {STEPS.map(([step, detail], index) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                {index + 1}
              </span>
              <span>
                <strong className="font-semibold text-stone-900 dark:text-stone-100">{step}</strong>{" "}
                {detail}
              </span>
            </li>
          ))}
        </ol>
        <div className="pt-4">
          <ShowcaseDesk />
        </div>
      </GuideSection>

      <GuideSection title="Your students' privacy">
        <p>
          Only the names you type are kept, and they&apos;re seen by you alone, or by a colleague
          you share the shelf with. Students never get an email or an account, and first names or
          initials work fine. At the end of the year, remove a name and its loans go with it. The{" "}
          <Link to="/privacy" className={proseLink}>
            privacy policy
          </Link>{" "}
          has the details.
        </p>
      </GuideSection>

      <GuideSection title="What it costs">
        <p>
          Free for up to {FREE_LIMITS.books} books, or {FREE_LIMITS.sharedBooks} on a shelf you
          share with a colleague. A bigger library is ${PLUS_PRICES.monthly} a month or $
          {PLUS_PRICES.yearly} a year with{" "}
          <Link to="/pricing" className={proseLink}>
            Stacks Plus
          </Link>
          . It works in any browser, on a phone or a classroom computer, with nothing to install.
        </p>
      </GuideSection>
    </GuidePage>
  );
}
