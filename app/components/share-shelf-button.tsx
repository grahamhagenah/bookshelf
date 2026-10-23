import { useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

import { shelfPath } from "~/profile";
import { useOptionalUser } from "~/utils";

import { LinkIcon } from "./icons";

// Copies the link to your public shelf. Without one yet, the first click
// makes it (as the share prompt and Settings do) and copies that. On a
// phone it opens the share sheet instead, which has Copy among its choices.
export default function ShareShelfButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const user = useOptionalUser();
  // Same key as the share prompt, so both see a newly made link
  const fetcher = useFetcher<{ url?: string }>({ key: "share-link" });
  const [copied, setCopied] = useState(false);
  // Whether this button asked for the link, since others share the fetcher
  const asked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const path = user ? shelfPath(user) : null;
  const making = fetcher.state !== "idle";

  const hand = async (url: string) => {
    if (typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches) {
      // Closing the share sheet isn't an error worth showing
      await navigator.share({ title: "My bookshelf on Stacks", url }).catch(() => undefined);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; Settings shows the link to select
    }
  };

  // A link made just now: hand it on once it arrives
  const made = fetcher.data?.url;
  useEffect(() => {
    if (!made || !asked.current) return;
    asked.current = false;
    void hand(made);
  }, [made]);

  if (!user) return null;

  const onClick = () => {
    if (path) {
      void hand(new URL(path, window.location.origin).href);
      return;
    }
    asked.current = true;
    fetcher.submit({ intent: "create" }, { method: "post", action: "/share-link" });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={making}
      aria-label={iconOnly ? (copied ? "Link copied" : "Share my shelf") : undefined}
      title="Copy a link anyone can open to see your books"
      className={`inline-flex h-8 flex-shrink-0 items-center justify-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors disabled:cursor-wait disabled:opacity-60 ${
        iconOnly ? "w-8" : "px-2.5"
      }`}
    >
      {iconOnly && copied ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <LinkIcon size={16} />
      )}
      {iconOnly ? null : (
        // Both labels share one cell, so the button keeps its width
        <span className="grid" aria-live="polite">
          <span className={`col-start-1 row-start-1 ${copied ? "invisible" : ""}`}>Share my shelf</span>
          <span className={`col-start-1 row-start-1 ${copied ? "" : "invisible"}`}>Copied</span>
        </span>
      )}
    </button>
  );
}
