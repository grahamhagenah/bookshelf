
import { data, Link, redirect, useActionData, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import { pageUrl } from "~/page-url";
import { seo } from "~/seo";
import { getUserId, requireUserId } from "~/session.server";
import { confirmEmail, sendVerification } from "~/verify-email.server";

export const meta: MetaFunction = () =>
  seo({ title: "Confirm your email", path: "/verify-email", noindex: true });

// The link from the confirmation email lands here. It redirects once
// confirmed, since the banner is read alongside this loader and would
// still show on the same request.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = pageUrl(request);
  const token = url.searchParams.get("token");
  if (token) {
    const confirmed = await confirmEmail(token);
    return redirect(`/verify-email?result=${confirmed ? "confirmed" : "failed"}`);
  }
  return data({
    confirmed: url.searchParams.get("result") === "confirmed",
    loggedIn: Boolean(await getUserId(request)),
  });
};

// The banner's "Resend" button
export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  return data(await sendVerification(userId));
};

export default function VerifyEmail() {
  const { confirmed, loggedIn } = useLoaderData<typeof loader>();
  // Resend posted here before the page's script loaded
  const resent = useActionData<typeof action>();
  const heading = resent
    ? "Check your inbox"
    : confirmed
      ? "Email confirmed"
      : "That link didn't work";
  const body = resent
    ? resent.sent
      ? "We've sent a fresh confirmation link."
      : "A link went out a moment ago. Give it a minute or two to arrive."
    : confirmed
      ? "Thanks. Stacks can now email you about requests and your week."
      : "It may have expired or been replaced by a newer one. Log in and use Resend on the banner to get a fresh link.";
  return (
    <div className="flex flex-col justify-center py-12 md:py-20">
      <div className="mx-auto w-full max-w-md px-8 text-center">
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          {heading}
        </h1>
        <p className="mt-2 text-stone-600 dark:text-stone-300">{body}</p>
        <Link
          to={loggedIn ? "/" : "/login"}
          className="mt-6 inline-block rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200 transition-colors"
        >
          {loggedIn ? "Go to your shelf" : "Log in"}
        </Link>
      </div>
    </div>
  );
}
