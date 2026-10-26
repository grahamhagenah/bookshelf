
import { Link } from "react-router";

import DemoButton from "./demo-button";

// The pieces of the public guide pages (Goodreads alternative, lending
// books to friends): a readable column, section headings, and a closing
// invitation to try Stacks

export const proseLink =
  "text-stone-900 dark:text-stone-100 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:decoration-stone-500";

export function GuidePage({
  eyebrow,
  title,
  intro,
  children,
  cta = true,
}: {
  eyebrow: string;
  title: string;
  intro: React.ReactNode;
  children: React.ReactNode;
  // The closing invitation; the legal pages leave it off
  cta?: boolean;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 md:px-8 md:py-14">
      <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">{eyebrow}</p>
      <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-pretty text-lg leading-relaxed text-stone-600 dark:text-stone-300">
        {intro}
      </p>
      <div className="mt-10 space-y-10">{children}</div>
      {cta ? <GuideCta /> : null}
    </main>
  );
}

export function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-balance text-xl font-semibold text-stone-900 dark:text-stone-100">
        {title}
      </h2>
      <div className="mt-3 space-y-4 text-pretty leading-relaxed text-stone-700 dark:text-stone-300">
        {children}
      </div>
    </section>
  );
}

function GuideCta() {
  return (
    <aside className="mt-14 rounded-xl border border-stone-200 dark:border-stone-800 px-6 py-8 text-center">
      <p className="text-xl font-semibold text-stone-900 dark:text-stone-50">
        Start your shelf
      </p>
      <p className="mt-2 text-stone-600 dark:text-stone-300">
        Free to start, no ads, and it takes a minute. Or look around a demo library first.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          to="/join"
          className="inline-flex items-center justify-center rounded-md bg-forest-600 px-5 py-2.5 font-medium text-white hover:bg-forest-700 transition-colors"
        >
          Create an account
        </Link>
        <DemoButton className="px-4 py-2.5 font-medium text-stone-700 dark:text-stone-200 underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:underline">
          Try the demo →
        </DemoButton>
      </div>
      <p className="mt-6 text-sm text-stone-500 dark:text-stone-400">
        More questions? <Link to="/faq" className={proseLink}>Read the FAQ</Link>.
      </p>
    </aside>
  );
}
