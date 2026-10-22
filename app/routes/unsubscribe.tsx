import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";

import { prisma } from "~/db.server";
import type { EmailKind } from "~/models/user.server";
import { setEmailSetting } from "~/models/user.server";
import { seo } from "~/seo";
import { getUserId } from "~/session.server";
import { readUnsubscribe } from "~/unsubscribe.server";

export const meta: MetaFunction = () => seo({ title: "Email settings", noindex: true });

// The link at the bottom of an email lands here, signed in or not. Opening
// it only asks: mail scanners open links on their own, and shouldn't turn
// anyone's email off. Inboxes' own Unsubscribe button posts straight here.

const NAMES: Record<EmailKind, string> = {
  requests: "borrow request emails",
  weekly: "the weekly roundup",
};

async function isOn(userId: string, kind: EmailKind) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailNotifications: true, weeklyDigest: true },
  });
  if (!user) return null;
  return kind === "requests" ? user.emailNotifications : user.weeklyDigest;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const link = readUnsubscribe(new URL(request.url).searchParams);
  const on = link ? await isOn(link.userId, link.kind) : null;
  const loggedIn = Boolean(await getUserId(request));
  if (!link || on === null) return json({ valid: false as const, loggedIn });
  return json({ valid: true as const, kind: link.kind, on, loggedIn });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const link = readUnsubscribe(new URL(request.url).searchParams);
  if (!link || (await isOn(link.userId, link.kind)) === null) {
    return json({ error: "That link didn't work" }, { status: 400 });
  }
  const form = await request.formData();
  // One-click unsubscribe from the inbox (RFC 8058) turns it off; the page's
  // own button can also turn it back on
  const on = form.get("List-Unsubscribe") === "One-Click" ? false : form.get("on") === "true";
  await setEmailSetting(link.userId, link.kind, on);
  return json({ on });
};

export default function Unsubscribe() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  if (!data.valid) {
    return (
      <Message heading="That link didn't work">
        It may have been copied only partly. You can change your email in Settings once you&apos;re
        signed in.
        <SettingsLink loggedIn={data.loggedIn} />
      </Message>
    );
  }

  const pending = fetcher.formData ? fetcher.formData.get("on") === "true" : null;
  const savedOn = fetcher.data && "on" in fetcher.data ? fetcher.data.on : null;
  const on = pending ?? savedOn ?? data.on;
  const name = NAMES[data.kind];

  return (
    <Message heading={on ? `Turn off ${name}?` : `You won't get ${name} any more`}>
      {on
        ? "Everything else stays as it is. You can turn it back on any time in Settings."
        : "Other email from Stacks stays as it is."}
      <fetcher.Form method="post" className="mt-6">
        <input type="hidden" name="on" value={on ? "false" : "true"} />
        <button
          type="submit"
          className={
            on
              ? "rounded-md bg-forest-600 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700 transition-colors"
              : "rounded-md border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
          }
        >
          {on ? `Turn off ${name}` : "Undo"}
        </button>
      </fetcher.Form>
      <SettingsLink loggedIn={data.loggedIn} />
    </Message>
  );
}

function Message({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-center py-12 md:py-20">
      <div className="mx-auto w-full max-w-md px-8 text-center">
        <h1 className="text-balance text-xl font-semibold text-stone-900 dark:text-stone-100">{heading}</h1>
        <div className="mt-2 text-stone-600 dark:text-stone-300">{children}</div>
      </div>
    </div>
  );
}

function SettingsLink({ loggedIn }: { loggedIn: boolean }) {
  return (
    <p className="mt-6 text-sm">
      <Link
        to={loggedIn ? "/account" : "/login?redirectTo=/account"}
        className="text-stone-500 dark:text-stone-400 underline underline-offset-2 hover:text-stone-800 dark:hover:text-stone-200"
      >
        All email settings
      </Link>
    </p>
  );
}
