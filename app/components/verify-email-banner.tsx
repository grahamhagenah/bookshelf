import { useFetcher } from "@remix-run/react";

// Shown until the address is confirmed; Stacks sends no email before then
export default function VerifyEmailBanner({ email }: { email: string }) {
  const fetcher = useFetcher<{ sent: boolean; wait?: boolean }>();
  const result = fetcher.data;
  return (
    <div className="w-full bg-stone-50 dark:bg-stone-950/40 border-b border-stone-200 dark:border-stone-900 py-2 text-sm">
      <div className="mx-auto max-w-5xl px-4 md:px-8 flex items-center justify-between gap-3">
        <p className="min-w-0 text-stone-900 dark:text-stone-200">
          <strong>Confirm your email.</strong>
          <span className="hidden sm:inline">
            {" "}
            We sent a link to {email}.
          </span>
        </p>
        {result?.sent ? (
          <p className="flex-shrink-0 text-stone-600 dark:text-stone-400">Sent. Check your inbox.</p>
        ) : result?.wait ? (
          <p className="flex-shrink-0 text-stone-600 dark:text-stone-400">Just sent. Try again in a minute or two.</p>
        ) : (
          <fetcher.Form action="/verify-email" method="post" className="flex-shrink-0">
            <button
              type="submit"
              disabled={fetcher.state !== "idle"}
              className="rounded-md border border-stone-300 dark:border-stone-700 px-2.5 sm:px-3 py-1 text-stone-900 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 hover:bg-white/60 dark:hover:bg-stone-900/50 transition-colors disabled:opacity-60"
            >
              Resend
            </button>
          </fetcher.Form>
        )}
      </div>
    </div>
  );
}
