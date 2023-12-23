import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import { useLoaderData } from "@remix-run/react";
import { redirect } from "@remix-run/node";
import { getUserById } from "~/models/user.server";
import { Form, useActionData, useSearchParams } from "@remix-run/react";
import { useEffect, useRef } from "react";
import { createNotification } from "~/models/user.server";
import { getUserId } from "~/session.server";
import { getUserByEmail } from "~/models/user.server";
import Layout from "~/components / Layout/Layout";


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

  await createNotification(senderId, receiver.id, senderName);

  return redirect(`/books`);
};


export default function Friends() {
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
    <Layout title="Friends">
      <section className="p-4">
        {data.user.following.length > 1 ? 
          <h2>You have <span className="font-semibold pb-16">{data.user.following.length}</span> friends</h2>
          : null }
          <ul className="friend-list my-5 text-xl mt-16">
          {data.user.following.length > 0 ? 
            data.user.following.map((user, index) => 
              <li key={index} className="first:pt-0 border-b-2 py-4 last:border-none">
                <a href={`/friends/${user.id}`}>
                  <h3 className="text-xl font-medium mb-1">{user.firstname + " " + user.surname}</h3>
                  <p className="font-regular">{user.email}</p>
                </a>
              </li>
            )
          : 
            <li>
              <h3 className="text-3xl font-regular mb-8">You have no friends :(</h3>
              <p className="font-regular">You're missing out if you go it alone. Add friends from this page if you know the email addresses associated with their accounts.</p>
            </li> 
          }
          </ul>
        </section>
        <section className="p-4">
          <Form method="post" className="w-3/4 space-y-6 border shadow-sm rounded-lg p-8 md:p-12 w-full mb-16">
            <h2 className="text-3xl font-semibold mb-5">Add friends by email</h2>
            <p className="pb-8">Once a friend accepts your request, you can view their library, and they can view yours. You'll be allowed to request their books dependent on availability.</p>
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
              Send friend request
            </button>
          </Form>
        </section>
    </Layout>
  );
}
