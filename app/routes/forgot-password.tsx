import { useEffect, useRef } from "react";
import { data, Form, Link, useActionData } from "react-router";
import type { ActionFunctionArgs, MetaFunction } from "react-router";

import { primaryButton, textField } from "~/components/ui";
import { requestPasswordReset } from "~/reset-password.server";
import { seo } from "~/seo";
import { validateEmail } from "~/utils";

export const meta: MetaFunction = () =>
  seo({ title: "Reset your password", path: "/forgot-password", noindex: true });

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const email = formData.get("email");

  if (!validateEmail(email)) {
    return data(
      {
        errors: { email: "Please enter a valid email address" },
        success: false,
      },
      { status: 400 },
    );
  }

  // The same answer whether or not the address has an account, so the
  // form can't be used to find out who's on Stacks
  await requestPasswordReset(email);
  return data({ errors: null, success: true });
};

export default function ForgotPasswordPage() {
  const actionData = useActionData<typeof action>();
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (actionData?.errors?.email) {
      emailRef.current?.focus();
    }
  }, [actionData]);

  return (
    <div className="flex flex-col justify-center py-12 md:py-20">
      <div className="mx-auto w-full max-w-md px-8">
        {actionData?.success ? (
          <div className="space-y-6">
            <div className="rounded-lg bg-stone-100 dark:bg-stone-800 p-6 text-center">
              <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100 mb-2">
                Check your email
              </h2>
              <p className="text-stone-900 dark:text-stone-100">
                If an account exists with that email address, we&apos;ve sent a
                link to choose a new password. It works for an hour.
              </p>
            </div>
            <div className="text-center">
              <Link
                to="/login"
                className="text-stone-900 dark:text-stone-100 underline"
              >
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <Form method="post" className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-2">
                Forgot your password?
              </h1>
              <p className="text-stone-600 dark:text-stone-300">
                Enter your email address and we&apos;ll send you a link to
                choose a new one.
              </p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-stone-700 dark:text-stone-200"
              >
                Email address
              </label>
              <div className="mt-1">
                <input
                  ref={emailRef}
                  id="email"
                  required
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus={true}
                  name="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={actionData?.errors?.email ? true : undefined}
                  aria-describedby="email-error"
                  className={textField}
                />
                {actionData?.errors?.email ? (
                  <div
                    className="pt-1 text-stone-900 dark:text-stone-100"
                    id="email-error"
                  >
                    {actionData.errors.email}
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="submit"
              className={`${primaryButton("lg")} w-full`}
            >
              Send reset link
            </button>

            <div className="text-center text-sm text-stone-500 dark:text-stone-400">
              Remember your password?{" "}
              <Link
                className="text-stone-900 dark:text-stone-100 underline"
                to="/login"
              >
                Log in
              </Link>
            </div>
          </Form>
        )}
      </div>
    </div>
  );
}
