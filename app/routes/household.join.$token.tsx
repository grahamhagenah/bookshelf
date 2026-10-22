import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import Layout from "~/components / Layout/Layout";
import { joinHousehold } from "~/models/household.server";
import { seo } from "~/seo";
import { getUserId } from "~/session.server";

// The link someone sends to share their shelf. Signed in, you join on the
// spot; otherwise you make an account (or sign in) and come back here.

export const meta: MetaFunction = () => seo({ title: "Join a shelf", noindex: true });

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.token, "token not found");
  const userId = await getUserId(request);
  if (!userId) {
    const here = `/household/join/${params.token}`;
    return redirect(`/join?household=${params.token}&redirectTo=${encodeURIComponent(here)}`);
  }
  const result = await joinHousehold(userId, params.token);
  if (result.ok) return redirect("/books?joined=1");
  return json({ reason: result.reason });
};

export default function JoinHousehold() {
  const { reason } = useLoaderData<typeof loader>();
  const message =
    reason === "already-in-one"
      ? "You're already sharing a shelf with someone. Leave that one first, from your Account page, then open this link again."
      : reason === "demo-boundary"
        ? "Demo accounts can't join real shelves, or the other way round."
        : "That invite isn't valid any more. Ask for a fresh link.";
  return (
    <Layout title="Join a shelf">
      <section>
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
          Couldn&apos;t join that shelf
        </h2>
        <p className="mt-2 max-w-prose text-stone-600 dark:text-stone-300">{message}</p>
        <Link
          to="/account"
          className="mt-4 inline-block text-sm text-stone-700 dark:text-stone-200 underline underline-offset-2"
        >
          Go to your account
        </Link>
      </section>
    </Layout>
  );
}
