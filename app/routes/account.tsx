import { useLoaderData } from "@remix-run/react";
import { requireUserId } from "~/session.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { getUserById } from "~/models/user.server";
import Layout from "~/components / Layout/Layout";
import { Form, useActionData, useSearchParams } from "@remix-run/react";
import { useEffect, useRef } from "react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { getUserId } from "~/session.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return {user};
}

export const action = async ({ request }: ActionFunctionArgs) => {

  const senderId = await getUserId(request);
  const user = await getUserById(senderId);
  const senderName = user.firstname + " " + user.surname 
  const formData = await request.formData();
  const email = formData.get("email");
  const receiver = await getUserByEmail(email)

  return null
};


export default function Account() {

  const data = useLoaderData<typeof loader>();

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
    <Layout title="Account Settings">
      <section className="p-4 m-4">
        To do: Add account details here and get form working
      </section>
      <section className="p-4">
        <Form method="post" className="space-y-6 border shadow-sm rounded-lg p-8 mb-12">
          <h2 className="text-3xl font-semibold mb-5">Update your email address</h2>
          <p className="pb-8">Your email address is your primary identifier. It is your login credential and allows friends to find you.</p>
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
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button
            type="submit"
            name="_action" 
            value="ADD"
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
          >
            Update information
          </button>
        </Form>
      </section>
    </Layout>
  )
}