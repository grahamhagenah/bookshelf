import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { resetPassword } from "~/models/user.server";
import { sendPasswordResetEmail } from "~/email.server";
import { validateEmail } from "~/utils";

export const meta: MetaFunction = () => [{ title: "Forgot Password" }];

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const email = formData.get("email");

  if (!validateEmail(email)) {
    return json(
      { errors: { email: "Please enter a valid email address" }, success: false },
      { status: 400 }
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
    <div className="flex h-5/6 flex-col justify-center">
      <div className="mx-auto w-full max-w-md px-8">
        {actionData?.success ? (
          <div className="space-y-6">
            <div className="rounded-lg bg-green-50 p-6 text-center">
              <h2 className="text-xl font-semibold text-green-800 mb-2">Check your email</h2>
              <p className="text-green-700">
                If an account exists with that email address, we've sent a temporary password you can use to log in.
              </p>
            </div>
            <div className="text-center">
              <Link
                to="/login"
                className="text-blue-500 underline"
              >
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <Form method="post" className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold mb-2">Forgot your password?</h1>
              <p className="text-gray-600">
                Enter your email address and we'll send you a temporary password.
              </p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <div className="mt-1">
                <input
                  ref={emailRef}
                  id="email"
                  required
                  autoFocus={true}
                  name="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={actionData?.errors?.email ? true : undefined}
                  aria-describedby="email-error"
                  className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
                />
                {actionData?.errors?.email ? (
                  <div className="pt-1 text-red-700" id="email-error">
                    {actionData.errors.email}
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
            >
              Send temporary password
            </button>

            <div className="text-center text-sm text-gray-500">
              Remember your password?{" "}
              <Link
                className="text-blue-500 underline"
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
