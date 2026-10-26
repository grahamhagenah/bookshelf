
import { data, Form, Link, useActionData, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import { primaryButton, textField } from "~/components/ui";
import { checkResetToken, resetPasswordWithToken } from "~/reset-password.server";
import { seo } from "~/seo";
import { createUserSession } from "~/session.server";

export const meta: MetaFunction = () =>
  seo({ title: "Choose a new password", path: "/reset-password", noindex: true });

// The link from the reset email lands here
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  return data({ token, valid: token ? Boolean(await checkResetToken(token)) : false });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const token = formData.get("token");
  const password = formData.get("password");
  const confirm = formData.get("confirm");
  if (typeof token !== "string" || typeof password !== "string" || typeof confirm !== "string") {
    return data({ error: "Something went wrong. Please try again." }, { status: 400 });
  }
  if (password.length < 8) {
    return data({ error: "Use at least 8 characters." }, { status: 400 });
  }
  if (password !== confirm) {
    return data({ error: "Those passwords don't match." }, { status: 400 });
  }
  const userId = await resetPasswordWithToken(token, password);
  if (!userId) {
    return data(
      { error: "This link has expired or was already used. Ask for a new one." },
      { status: 400 },
    );
  }
  // Signed straight in with the new password
  return createUserSession({ request, userId, remember: false, redirectTo: "/" });
};


export default function ResetPassword() {
  const { token, valid } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="flex flex-col justify-center py-12 md:py-20">
      <div className="mx-auto w-full max-w-md px-8">
        {valid ? (
          <Form method="post" className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-2">Choose a new password</h1>
              <p className="text-stone-600 dark:text-stone-300">At least 8 characters.</p>
            </div>
            <input type="hidden" name="token" value={token} />
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700 dark:text-stone-200">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                aria-describedby="reset-error"
                className={`mt-1 ${textField}`}
              />
            </div>
            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-stone-700 dark:text-stone-200">
                Type it again
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                aria-describedby="reset-error"
                className={`mt-1 ${textField}`}
              />
            </div>
            {actionData?.error ? (
              <p id="reset-error" role="alert" className="text-stone-900 dark:text-stone-100">
                {actionData.error}
              </p>
            ) : null}
            <button
              type="submit"
              className={`${primaryButton("lg")} w-full`}
            >
              Save and sign in
            </button>
          </Form>
        ) : (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
              That link didn&apos;t work
            </h1>
            <p className="mt-2 text-stone-600 dark:text-stone-300">
              Reset links work for an hour, and only once. Ask for a new one and use the latest
              email.
            </p>
            <Link
              to="/forgot-password"
              className={`${primaryButton("lg")} mt-6 inline-block`}
            >
              Send a new link
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
