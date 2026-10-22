import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";

import { FEEDBACK_MAX_LENGTH, saveFeedback } from "~/models/feedback.server";
import { seo } from "~/seo";
import { getUserId } from "~/session.server";
import { safeRedirect, validateEmail } from "~/utils";

// A plain way to tell whoever runs Stacks what's working, what isn't and
// what's missing. Open to anyone; signed out, you can leave an email to
// hear back.

export const meta: MetaFunction = () =>
  seo({ title: "Send feedback", description: "Tell us what's working and what isn't.", path: "/feedback" });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  // The page they came from, to go back to and to say where it was about
  const from = safeRedirect(new URL(request.url).searchParams.get("from"), "/");
  return json({ signedIn: Boolean(userId), from });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = (await getUserId(request)) ?? null;
  const form = await request.formData();
  // Bots fill in every field; people never see this one
  if (form.get("website")) return json({ sent: true, error: null });

  const body = String(form.get("body") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  if (!body) return json({ sent: false, error: "Write a few words first." }, { status: 400 });
  if (body.length > FEEDBACK_MAX_LENGTH) {
    return json({ sent: false, error: `Keep it under ${FEEDBACK_MAX_LENGTH} characters.` }, { status: 400 });
  }
  if (!userId && email && !validateEmail(email)) {
    return json({ sent: false, error: "That email address doesn't look right." }, { status: 400 });
  }

  await saveFeedback({
    userId,
    body,
    page: safeRedirect(form.get("from"), "/"),
    email: userId ? null : email || null,
  });
  return json({ sent: true, error: null });
};

export default function Feedback() {
  const { signedIn, from } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const sending = useNavigation().state === "submitting";

  if (actionData?.sent) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">Thank you</h1>
        <p className="mt-3 text-stone-600 dark:text-stone-300">
          Every message gets read. It&apos;s a small app run by one person, so this really
          does shape what happens next.
        </p>
        <Link
          to={from}
          className="mt-6 inline-block text-stone-700 dark:text-stone-200 underline underline-offset-2"
        >
          Back to where you were
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12 md:py-16">
      <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">Send feedback</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-300">
        Something confusing, broken, or missing? An idea for what Stacks should do next? Tell
        me, in as many or as few words as you like.
      </p>

      <Form method="post" className="mt-6 space-y-4">
        <input type="hidden" name="from" value={from} />
        {/* Hidden from people, irresistible to bots */}
        <div className="hidden" aria-hidden="true">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <div>
          <label htmlFor="body" className="sr-only">
            Your feedback
          </label>
          <textarea
            id="body"
            name="body"
            rows={6}
            required
            maxLength={FEEDBACK_MAX_LENGTH}
            placeholder="What's on your mind?"
            aria-invalid={actionData?.error ? true : undefined}
            aria-describedby="feedback-error"
            className="w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 leading-relaxed text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10"
          />
        </div>
        {signedIn ? null : (
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              Your email <span className="font-normal text-stone-400">(optional, if you&apos;d like a reply)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10"
            />
          </div>
        )}
        {actionData?.error ? (
          <p id="feedback-error" className="text-sm text-rose-700 dark:text-rose-400">
            {actionData.error}
          </p>
        ) : null}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={sending}
            className="rounded-md bg-forest-600 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700 transition-colors disabled:cursor-wait"
          >
            {sending ? "Sending…" : "Send feedback"}
          </button>
          <Link to={from} className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100">
            Cancel
          </Link>
        </div>
        {signedIn ? (
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Sent with your name, so I can follow up if I have questions.
          </p>
        ) : null}
      </Form>
    </main>
  );
}
