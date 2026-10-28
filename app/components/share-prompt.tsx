
import { useFetcher } from "react-router";

import CopyButton from "./copy-button";

// A quiet strip under the header inviting people to make their shelf's
// public link. Once made, it shows the link to copy; dismissing it puts it
// away for good (remembered in a cookie by /share-link).

const buttonClass =
  "rounded-md border border-stone-300 dark:border-stone-700 px-2.5 sm:px-3 py-1 text-stone-900 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 hover:bg-white/60 dark:hover:bg-stone-900/50 transition-colors";

export default function SharePrompt({ show }: { show: boolean }) {
  // Keyed, so the link stays on screen after the root reloads and sees
  // that a link now exists
  const fetcher = useFetcher<{ url?: string; dismissed?: boolean }>({
    key: "share-link",
  });

  const url = fetcher.data?.url;
  const dismissing = fetcher.formData?.get("intent") === "dismiss";
  const creating = fetcher.formData?.get("intent") === "create";
  if (dismissing || fetcher.data?.dismissed || (!show && !url)) return null;

  return (
    // A shade of its own in dark mode, so it doesn't run together with the
    // confirm-email bar above it (bg-stone-50 turns stone-900 in dark mode)
    <div className="w-full bg-[var(--color-stone-50)] dark:bg-stone-900/50 border-b border-stone-200 dark:border-stone-900 py-2 text-sm">
      <fetcher.Form
        method="post"
        action="/share-link"
        className="mx-auto max-w-[var(--page-max,64rem)] px-4 md:px-8 flex items-center gap-3"
      >
        {url ? (
          <>
            <p className="hidden sm:block flex-shrink-0 font-semibold text-stone-900 dark:text-stone-200">
              Your shelf&apos;s link:
            </p>
            {/* The link as plain text, not a box that looks like it takes
                typing: open it to see the page, or copy it beside */}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open your shared shelf"
              className="min-w-0 flex-1 truncate text-stone-600 dark:text-stone-300 underline-offset-2 hover:underline hover:text-stone-900 dark:hover:text-stone-100"
            >
              {url.replace(/^https?:\/\//, "")}
            </a>
            <CopyButton value={url} className={`${buttonClass} flex-shrink-0`} />
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 text-stone-900 dark:text-stone-200">
              <strong>Share your shelf.</strong>
              <span className="hidden sm:inline">
                {" "}
                Make a link anyone can open to browse your books.
              </span>
            </p>
            <button
              type="submit"
              name="intent"
              value="create"
              disabled={creating}
              className={`${buttonClass} flex-shrink-0 ${creating ? "opacity-60 cursor-wait" : ""}`}
            >
              {creating ? "Creating…" : "Create link"}
            </button>
          </>
        )}
        <button
          type="submit"
          name="intent"
          value="dismiss"
          aria-label={url ? "Done" : "Dismiss"}
          title={url ? "Done" : "Dismiss"}
          className="flex-shrink-0 -mr-1 flex h-7 w-7 items-center justify-center rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </fetcher.Form>
    </div>
  );
}
