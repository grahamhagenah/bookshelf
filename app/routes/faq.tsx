import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { isValidElement } from "react";

import { sectionHeading } from "~/components/ui";
import { FREE_LIMITS, PLUS_PRICES } from "~/plan";
import { seo, structuredData } from "~/seo";

// Plain answers to the questions people ask about Stacks: what it is,
// how it differs from the reading trackers, and how lending works

export const meta: MetaFunction = () => [
  ...seo({
    title: "FAQ",
    description:
      "What Stacks is, how it differs from Goodreads and StoryGraph, and how lending, notes, shared shelves and importing work.",
    path: "/faq",
  }),
  // The same questions and answers, machine-readable
  structuredData({
    "@type": "FAQPage",
    mainEntity: sections.flatMap((section) =>
      section.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: textOf(item.a) },
      })),
    ),
  }),
];

// The words in an answer, without its links and paragraphs
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean")
    return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) {
    const text = textOf(node.props.children);
    return node.type === "p" ? `${text} ` : text;
  }
  return "";
}

export const handle = {
  breadcrumb: () => <span>FAQ</span>,
};

const link =
  "text-stone-900 dark:text-stone-100 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:decoration-stone-500";

const sections: {
  heading: string;
  items: { q: string; a: React.ReactNode }[];
}[] = [
  {
    heading: "The idea",
    items: [
      {
        q: "What is Stacks?",
        a: (
          <>
            A lending library for the books you own. You list the books on your
            shelf, your friends list theirs, and you borrow from each other.
            Each book page knows where that copy is, who has had it, and what
            the people who read it thought.
          </>
        ),
      },
      {
        q: "How is it different from Goodreads or StoryGraph?",
        a: (
          <>
            <p>
              Those are for tracking your reading: what you&apos;ve read, how
              you rated it, what to read next. Stacks is about the physical
              copies and the people around you. The unit isn&apos;t &ldquo;a
              book&rdquo; but &ldquo;your copy of it&rdquo;, and the point is to
              get it into a friend&apos;s hands.
            </p>
            <p className="mt-3">
              So there are no star ratings, no reviews of books in general, no
              recommendation engine and no feed of strangers. Notes stay with
              the copy as it passes between friends, like a penciled line inside
              the cover. If you already keep a list on Goodreads or StoryGraph,
              you can{" "}
              <Link to="/import" className={link}>
                import it
              </Link>{" "}
              and carry on using both. There&apos;s a{" "}
              <Link to="/goodreads-alternative" className={link}>
                fuller comparison
              </Link>{" "}
              too.
            </p>
          </>
        ),
      },
      {
        q: "Do I have to lend my books out?",
        a: (
          <>
            No. Every request comes to you and you can decline it. Plenty of
            people use Stacks as a catalog of what they own and borrow from
            friends without lending much themselves.
          </>
        ),
      },
      {
        q: "Does it cost anything?",
        a: (
          <>
            It&apos;s free for up to {FREE_LIMITS.books} books, enough to
            start with the shelf you lend from most, and as many friends as you
            like. Stacks Plus lifts the book limit for $
            {PLUS_PRICES.monthly} a month or ${PLUS_PRICES.yearly} a year;{" "}
            <Link to="/pricing" className={link}>
              see pricing
            </Link>
            . Stacks is also{" "}
            <a
              href="https://github.com/grahamhagenah/bookshelf"
              target="_blank"
              rel="noreferrer"
              className={link}
            >
              open source
            </a>
            . Book details and covers come from{" "}
            <a
              href="https://openlibrary.org"
              target="_blank"
              rel="noreferrer"
              className={link}
            >
              Open Library
            </a>
            , the Internet Archive&apos;s catalog.
          </>
        ),
      },
    ],
  },
  {
    heading: "Borrowing and lending",
    items: [
      {
        q: "How does borrowing work?",
        a: (
          <>
            Search for a book and you&apos;ll see which friends have it. Ask to
            borrow it; the owner gets a notification and lends it to you with a
            due date (four weeks by default). You&apos;ll both see it on your
            home page, with reminders as the date gets close. When you hand it
            back, either of you marks it returned. Owners can also hand a book
            straight to a friend without being asked.
          </>
        ),
      },
      {
        q: "What if someone else has the book I want?",
        a: (
          <>
            Get in line. When the book comes back, Stacks asks the owner on your
            behalf and lets you know. Lines are first come, first served.
          </>
        ),
      },
      {
        q: "What do my friends see?",
        a: (
          <>
            Your shelf: every book you own, whether it&apos;s in or out, and the
            notes on each copy. Nobody else sees anything unless you make a{" "}
            <Link to="/account" className={link}>
              share link
            </Link>
            , which gives you a public page to send to anyone. Your want-to-read
            list and email settings are yours alone.
          </>
        ),
      },
      {
        q: "Can I add books I don't own?",
        a: (
          <>
            Not to your shelf, since a friend might ask to borrow it. Put them
            on your{" "}
            <Link to="/want-to-read" className={link}>
              want-to-read list
            </Link>{" "}
            instead: Stacks tells you when a friend has one and lets you ask for
            it.
          </>
        ),
      },
    ],
  },
  {
    heading: "Notes and reading",
    items: [
      {
        q: "What's a reader note?",
        a: (
          <>
            A heart, or a line or two, left on a copy by someone who has read
            it. Only readers of that copy can leave one: the owner,
            whoever&apos;s borrowing it, and anyone who has borrowed it before.
            Notes stay with the copy, so the next reader finds them.
          </>
        ),
      },
      {
        q: "Can I keep track of what I've read?",
        a: (
          <>
            Yes, for your own shelf: mark a book read on its page, and filter
            your shelf by read and not read. It&apos;s personal, so two people
            sharing a shelf each have their own marks.
          </>
        ),
      },
    ],
  },
  {
    heading: "Sharing a shelf",
    items: [
      {
        q: "We're a couple and our books are one shelf. Do we need two accounts?",
        a: (
          <>
            One each, sharing a shelf. From{" "}
            <Link to="/account" className={link}>
              Account
            </Link>
            , make an invite link and send it to the other person. Once they
            join, you both see and lend everything, and each of you keeps your
            own notes, hearts, read marks, want-to-read list and friends. Books
            show who added them. Either of you can leave later and take your own
            books with you.
          </>
        ),
      },
      {
        q: "Who approves a borrow request on a shared shelf?",
        a: (
          <>
            Requests go to whoever added the book, but either of you can lend it
            to a friend directly, and either can mark it returned, extend a loan
            or send a reminder.
          </>
        ),
      },
    ],
  },
  {
    heading: "Getting books in",
    items: [
      {
        q: "What's the fastest way to add a lot of books?",
        a: (
          <>
            On a phone, open{" "}
            <Link to="/search" className={link}>
              Search
            </Link>{" "}
            and tap Scan: point the camera at each barcode and the books add
            themselves. If you already keep a list on Goodreads or StoryGraph,{" "}
            <Link to="/import" className={link}>
              import their export file
            </Link>{" "}
            and choose what goes on your shelf and what goes on your
            want-to-read list.
          </>
        ),
      },
      {
        q: "A book has the wrong cover or details. Can I fix it?",
        a: (
          <>
            Yes. On the book page, Edit details or cover lets you change
            anything, pick another cover from Open Library, or refresh the
            details from there.
          </>
        ),
      },
    ],
  },
];

export default function Faq() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 md:px-8 md:py-14">
      <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
        Questions and answers
      </h1>
      <p className="mt-3 text-lg text-stone-600 dark:text-stone-300">
        What Stacks is, what it isn&apos;t, and how the lending works.
      </p>

      <nav
        aria-label="Sections"
        className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm"
      >
        {sections.map((section) => (
          <a
            key={section.heading}
            href={`#${section.heading.toLowerCase().replace(/[^a-z]+/g, "-")}`}
            className="text-stone-500 dark:text-stone-400 underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:underline"
          >
            {section.heading}
          </a>
        ))}
      </nav>

      {sections.map((section) => (
        <section
          key={section.heading}
          id={section.heading.toLowerCase().replace(/[^a-z]+/g, "-")}
          className="mt-12 border-t border-stone-200 dark:border-stone-800 pt-8"
        >
          <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400">
            {section.heading}
          </h2>
          <dl className="mt-4 space-y-8">
            {section.items.map((item) => (
              <div key={item.q}>
                <dt className={sectionHeading}>
                  {item.q}
                </dt>
                <dd className="mt-2 text-pretty leading-relaxed text-stone-700 dark:text-stone-300">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <p className="mt-12 border-t border-stone-200 dark:border-stone-800 pt-8 text-sm text-stone-500 dark:text-stone-400">
        Something missing?{" "}
        <Link to="/feedback?from=/faq" className={link}>
          Send feedback
        </Link>
        , or find the code and an issue tracker on{" "}
        <a
          href="https://github.com/grahamhagenah/bookshelf"
          target="_blank"
          rel="noreferrer"
          className={link}
        >
          GitHub
        </a>
        .
      </p>
    </main>
  );
}
