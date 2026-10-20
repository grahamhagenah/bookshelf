import { Form } from "@remix-run/react";

export default function DemoBanner() {
  return (
    <div className="w-full bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 md:px-8 py-2 text-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-amber-900 dark:text-amber-200">
          <strong>Demo library.</strong> Approve a request, borrow from a friend, add a book — it&apos;s all yours to try. Nothing is shared, and it resets after 24 hours.
        </p>
        <Form action="/demo" method="post" className="flex gap-2 flex-shrink-0">
          <button
            type="submit"
            name="intent"
            value="reset"
            className="rounded px-3 py-1 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          >
            Start over
          </button>
          <button
            type="submit"
            name="intent"
            value="exit"
            className="rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600 transition-colors"
          >
            Create your own account
          </button>
        </Form>
      </div>
    </div>
  );
}
