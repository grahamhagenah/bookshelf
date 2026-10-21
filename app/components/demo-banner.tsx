import { Form } from "@remix-run/react";

export default function DemoBanner() {
  return (
    <div className="w-full bg-stone-50 dark:bg-stone-950/40 border-b border-stone-200 dark:border-stone-900 py-2 text-sm">
      <div className="mx-auto max-w-4xl px-4 md:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-stone-900 dark:text-stone-200">
          <strong>You&apos;re in a demo.</strong> Try anything — it resets in 24 hours.
        </p>
        <Form action="/demo" method="post" className="flex gap-2 flex-shrink-0">
          <button
            type="submit"
            name="intent"
            value="reset"
            className="rounded px-3 py-1 text-stone-900 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-900/50 transition-colors"
          >
            Start over
          </button>
          <button
            type="submit"
            name="intent"
            value="exit"
            className="rounded bg-accent-500 px-3 py-1 text-white hover:bg-accent-600 transition-colors"
          >
            Sign up
          </button>
        </Form>
      </div>
    </div>
  );
}
