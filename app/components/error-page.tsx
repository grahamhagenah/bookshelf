import { Link, isRouteErrorResponse, useRouteError } from "@remix-run/react";

// What a page shows when it can't: a plain word on what happened and the
// two ways out, in the app's own clothes. `what` names the thing that
// wasn't found ("book", "page").
export default function ErrorPage({ what = "page" }: { what?: string }) {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const detail =
    error instanceof Error ? error.message : isRouteErrorResponse(error) ? error.statusText || null : null;

  const { title, body } =
    status === 404
      ? {
          title: `That ${what} isn't here`,
          body: `It may have been removed, or the link may be off by a letter.`,
        }
      : status === 403
        ? {
            title: "Not yours to see",
            body: "This belongs to someone who hasn't shared it with you.",
          }
        : {
            title: "Something went wrong",
            body: "Stacks hit a snag on this page. It's been noted. Trying again usually does it; if it keeps happening, say so with Send feedback.",
          };

  const button =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8 md:py-24">
      <div className="max-w-md">
        <p className="text-sm text-stone-400 dark:text-stone-500">{status}</p>
        <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          {title}
        </h1>
        <p className="mt-3 text-pretty leading-relaxed text-stone-600 dark:text-stone-300">{body}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {status === 404 ? (
            <Link to="/" className={`${button} bg-forest-600 text-white hover:bg-forest-700`}>
              Go home
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`${button} bg-forest-600 text-white hover:bg-forest-700`}
              >
                Try again
              </button>
              <Link
                to="/"
                className={`${button} border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500`}
              >
                Go home
              </Link>
            </>
          )}
        </div>
        {/* The message itself, for whoever is fixing it */}
        {detail && process.env.NODE_ENV === "development" ? (
          <pre className="mt-8 overflow-x-auto rounded-md bg-stone-100 dark:bg-stone-800 p-3 text-xs text-stone-600 dark:text-stone-300">
            {detail}
          </pre>
        ) : null}
      </div>
    </main>
  );
}
