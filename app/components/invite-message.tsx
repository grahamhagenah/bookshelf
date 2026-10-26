import { useEffect, useState } from "react";

import CopyButton from "~/components/copy-button";

// A message ready to send, with your personal invite link in it: whoever
// opens the link and signs up is your friend straight away. Sent from your
// own phone or email, so Stacks never writes to people who didn't ask.

export const inviteText = (url: string) =>
  `I put my bookshelf on Stacks. Want to borrow anything? Join me here and we'll be friends straight away: ${url}`;

const SUBJECT = "Borrow my books on Stacks";

export const mailtoInvite = (
  url: string,
  to: string[] = [],
  text = inviteText(url),
  subject = SUBJECT,
) =>
  `mailto:${to.map(encodeURIComponent).join(",")}?${new URLSearchParams({
    subject,
    body: text,
  })
    .toString()
    .replace(/\+/g, "%20")}`;

const button =
  "inline-flex h-8 items-center rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";
const primary =
  "inline-flex h-8 items-center rounded-md bg-forest-600 px-3 text-sm font-medium text-white hover:bg-forest-700 transition-colors";

// The ways to send it: the phone's share sheet where there is one, else
// email; copying works everywhere
export function InviteButtons({
  url,
  text = inviteText(url),
  subject = SUBJECT,
}: {
  url: string;
  // A message of its own, such as a group's
  text?: string;
  subject?: string;
}) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const share = () =>
    navigator.share({ title: subject, text }).catch(() => {
      // Closing the share sheet isn't an error worth showing
    });
  return (
    <span className="flex flex-wrap items-center gap-2">
      {canShare ? (
        <button type="button" onClick={share} className={primary}>
          Send invite
        </button>
      ) : (
        <a href={mailtoInvite(url, [], text, subject)} className={primary}>
          Email it
        </a>
      )}
      <CopyButton value={text} label="Copy message" className={button} />
    </span>
  );
}

// The message itself, to read before sending
export default function InviteMessage({
  url,
  title = "Invite friends",
  intro = "Most friends aren't on Stacks yet. Send them this, and they'll join as your friend.",
  text = inviteText(url),
  subject = SUBJECT,
  className = "",
}: {
  url: string;
  title?: string;
  intro?: string;
  text?: string;
  subject?: string;
  className?: string;
}) {
  return (
    <div className={`max-w-xl rounded-xl border border-stone-200 dark:border-stone-800 p-4 ${className}`}>
      <h3 className="font-medium text-stone-900 dark:text-stone-100">{title}</h3>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{intro}</p>
      <blockquote className="mt-3 break-words rounded-lg bg-stone-50 dark:bg-stone-900 px-3 py-2.5 text-sm text-stone-700 dark:text-stone-300">
        {text}
      </blockquote>
      <div className="mt-3">
        <InviteButtons url={url} text={text} subject={subject} />
      </div>
    </div>
  );
}
