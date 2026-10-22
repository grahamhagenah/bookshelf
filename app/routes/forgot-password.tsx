import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData } from "@remix-run/react";
import { useEffect, useRef } from "react";

import { sendPasswordResetEmail } from "~/email.server";
import { resetPassword } from "~/models/user.server";
import { seo } from "~/seo";
import { validateEmail } from "~/utils";

export const meta: MetaFunction = () =>
  seo({ title: "Reset your password", path: "/forgot-password", noindex: true });

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const email = formData.get("email");

  if (!validateEmail(email)) {
    return json(
      {
        errors: { email: "Please enter a valid email address" },
        success: false,
      },
      { status: 400 },
    );
  }

  // Normalize email for consistent lookup
  const normalizedEmail = email.toLowerCase().trim();
  const result = await resetPassword(normalizedEmail);

  if (!result.success || !result.tempPassword || !result.userName) {
    // Don't reveal whether the email exists or not for security
    return json({ errors: null, success: true });
  }

  // Send the temporary password via email
  await sendPasswordResetEmail({
    toEmail: normalizedEmail,
    toName: result.userName,
    tempPassword: result.tempPassword,
  });

  return json({ errors: null, success: true });
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
            <div className="rounded-lg bg-stone-100 p-6 text-center">
              <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100 mb-2">
                Check your email
              </h2>
              <p className="text-stone-900 dark:text-stone-100">
                If an account exists with that email address, we&apos;ve sent a
                temporary password you can use to log in.
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
              <p className="text-stone-600">
                Enter your email address and we&apos;ll send you a temporary
                password.
              </p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-stone-700"
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
                  className="w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors"
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
              className="w-full rounded-md bg-forest-600 dark:bg-forest-500 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700 dark:hover:bg-forest-400 transition-colors"
            >
              Send temporary password
            </button>

            <div className="text-center text-sm text-stone-500">
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
