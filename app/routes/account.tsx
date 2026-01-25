import { useLoaderData } from "@remix-run/react";
import { requireUserId } from "~/session.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { getUserById, getUserByEmail, updateUser } from "~/models/user.server";
import Layout from "~/components / Layout/Layout";
import { Form, useActionData } from "@remix-run/react";
import { useEffect, useRef } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return { user };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();

  const firstname = formData.get("firstname");
  const surname = formData.get("surname");
  const email = formData.get("email");

  const errors: { firstname?: string; surname?: string; email?: string } = {};

  if (typeof firstname !== "string" || firstname.trim().length === 0) {
    errors.firstname = "First name is required";
  }

  if (typeof surname !== "string" || surname.trim().length === 0) {
    errors.surname = "Last name is required";
  }

  if (typeof email !== "string" || email.trim().length === 0) {
    errors.email = "Email is required";
  } else if (!email.includes("@")) {
    errors.email = "Please enter a valid email address";
  }

  if (Object.keys(errors).length > 0) {
    return json({ errors, success: false }, { status: 400 });
  }

  // Check if email is already taken by another user
  const existingUser = await getUserByEmail(email as string);
  if (existingUser && existingUser.id !== userId) {
    errors.email = "This email is already in use";
    return json({ errors, success: false }, { status: 400 });
  }

  await updateUser(userId, {
    firstname: (firstname as string).trim(),
    surname: (surname as string).trim(),
    email: (email as string).trim(),
  });

  return json({ errors: null, success: true });
};

export default function Account() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const firstnameRef = useRef<HTMLInputElement>(null);
  const surnameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (actionData?.errors?.firstname) {
      firstnameRef.current?.focus();
    } else if (actionData?.errors?.surname) {
      surnameRef.current?.focus();
    } else if (actionData?.errors?.email) {
      emailRef.current?.focus();
    }
  }, [actionData]);

  return (
    <Layout title="Account Settings">
      <section className="p-4 m-4">
        <div className="border shadow-sm rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6">Account Details</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Name</dt>
              <dd className="text-lg">{data.user?.firstname} {data.user?.surname}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="text-lg">{data.user?.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Friends</dt>
              <dd className="text-lg">{data.user?.following.length || 0}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="p-4 m-4">
        <Form method="post" className="space-y-6 border shadow-sm rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-semibold mb-2">Update Profile</h2>
          <p className="text-gray-600 pb-4">Change your name or email address below.</p>

          {actionData?.success && (
            <div className="p-3 rounded bg-green-100 text-green-800">
              Your profile has been updated successfully.
            </div>
          )}

          <div>
            <label
              htmlFor="firstname"
              className="block text-sm font-medium text-gray-700"
            >
              First name
            </label>
            <div className="mt-1">
              <input
                ref={firstnameRef}
                id="firstname"
                name="firstname"
                type="text"
                defaultValue={data.user?.firstname}
                aria-invalid={actionData?.errors?.firstname ? true : undefined}
                aria-describedby="firstname-error"
                className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
              />
              {actionData?.errors?.firstname && (
                <div className="pt-1 text-red-700" id="firstname-error">
                  {actionData.errors.firstname}
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="surname"
              className="block text-sm font-medium text-gray-700"
            >
              Last name
            </label>
            <div className="mt-1">
              <input
                ref={surnameRef}
                id="surname"
                name="surname"
                type="text"
                defaultValue={data.user?.surname}
                aria-invalid={actionData?.errors?.surname ? true : undefined}
                aria-describedby="surname-error"
                className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
              />
              {actionData?.errors?.surname && (
                <div className="pt-1 text-red-700" id="surname-error">
                  {actionData.errors.surname}
                </div>
              )}
            </div>
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
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={data.user?.email}
                aria-invalid={actionData?.errors?.email ? true : undefined}
                aria-describedby="email-error"
                className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
              />
              {actionData?.errors?.email && (
                <div className="pt-1 text-red-700" id="email-error">
                  {actionData.errors.email}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
          >
            Save changes
          </button>
        </Form>
      </section>
    </Layout>
  );
}
