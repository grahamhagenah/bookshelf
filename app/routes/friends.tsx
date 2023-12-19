import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useSearchParams } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { getUserByEmail, createNotification } from "~/models/user.server";

import { verifyLogin } from "~/models/user.server";
import { createUserSession, getUserId } from "~/session.server";
import { safeRedirect, validateEmail } from "~/utils";

export const action = async ({ request }: ActionFunctionArgs) => {

  const senderId = await getUserId(request);

  const formData = await request.formData();
  const email = formData.get("email");
  const receiverId = formData.get("id");
  
  await createNotification(senderId, receiverId);

  return redirect(`/books`);
};

export default function Friends() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/books";
  const actionData = useActionData<typeof action>();
  const emailRef = useRef<HTMLInputElement>(null);
  const IdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (actionData?.errors?.email) {
      emailRef.current?.focus();
    } else if (actionData?.errors?.password) {
      passwordRef.current?.focus();
    }
  }, [actionData]);

  return (
    <div className="flex h-4/6 flex-col justify-center">
      <div className="mx-auto w-full max-w-md px-8">
        <h1 className="text-4xl mb-5">Friends</h1>
        <Form method="post" className="space-y-6">
          <div>
          <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              ID
            </label>
            <div className="mt-1">
              <input
                ref={IdRef}
                id="id"
                required
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={true}
                name="id"
                type="text"
                className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
              />
              {actionData?.errors?.email ? (
                <div className="pt-1 text-red-700" id="email-error">
                  {actionData.errors.email}
                </div>
              ) : null}
            </div>
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
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={true}
                name="email"
                type="text"
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
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button
            type="submit"
            className="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
          >
            Add Friend
          </button>
        </Form>
      </div>
    </div>
  );
}
