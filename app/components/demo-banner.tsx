import { Form } from "react-router";

export default function DemoBanner() {
  return (
    <div className="w-full bg-stone-50 dark:bg-stone-950/40 border-b border-stone-200 dark:border-stone-900 py-2 text-sm">
      <div className="mx-auto max-w-[var(--page-max,64rem)] px-4 md:px-8 flex items-center justify-between gap-3">
        <p className="min-w-0 text-stone-900 dark:text-stone-200">
          <strong>You&apos;re in a demo.</strong>
          {/* Too long to share a line with the buttons on phones */}
          <span className="hidden sm:inline">
            {" "}
            Try anything — it resets in 24 hours.
          </span>
        </p>
        <Form action="/demo" method="post" className="flex gap-2 flex-shrink-0">
          <button
            type="submit"
            name="intent"
            value="reset"
            className="rounded-md border border-stone-300 dark:border-stone-700 px-2.5 sm:px-3 py-1 text-stone-900 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 hover:bg-white/60 dark:hover:bg-stone-900/50 transition-colors"
          >
            Start over
          </button>
          <button
            type="submit"
            name="intent"
            value="exit"
            className="rounded-md border border-transparent bg-forest-600 px-2.5 sm:px-3 py-1 text-white hover:bg-forest-700 transition-colors"
          >
            Sign up
          </button>
        </Form>
      </div>
    </div>
  );
}
