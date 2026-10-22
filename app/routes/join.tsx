import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useSearchParams,
} from "@remix-run/react";
import { useEffect, useRef } from "react";

import { getHouseholdByInvite } from "~/models/household.server";
import {
  createNotification,
  createUser,
  getUserByEmail,
  getUserByShareToken,
} from "~/models/user.server";
import { seo } from "~/seo";
import { createUserSession, getUserId } from "~/session.server";
import { safeRedirect, validateEmail } from "~/utils";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  // Arriving from someone's shared shelf: say whose, so the form has a point
  const url = new URL(request.url);
  const invite = url.searchParams.get("invite");
  const inviter = invite ? await getUserByShareToken(invite) : null;
  // Or from a shared-shelf invite: name the people on it
  const household = url.searchParams.get("household");
  const shelf = household ? await getHouseholdByInvite(household) : null;
  return json({
    inviterName: inviter ? `${inviter.firstname} ${inviter.surname}` : null,
    shelfNames: shelf ? shelf.members.map((m) => m.firstname) : null,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const firstname = formData.get("firstname");
  const surname = formData.get("surname");
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = safeRedirect(formData.get("redirectTo"), "/");

  if (typeof firstname !== "string" || firstname.length === 0) {
    return json(
      {
        errors: {
          firstname: "First name is required",
          surname: null,
          email: null,
          password: null,
        },
      },
      { status: 400 },
    );
  }

  if (typeof surname !== "string" || surname.length === 0) {
    return json(
      {
        errors: {
          firstname: null,
          surname: "Last name is required",
          email: null,
          password: null,
        },
      },
      { status: 400 },
    );
  }

  if (!validateEmail(email)) {
    return json(
      {
        errors: {
          firstname: null,
          surname: null,
          email: "Email is invalid",
          password: null,
        },
      },
      { status: 400 },
    );
  }

  if (typeof password !== "string" || password.length === 0) {
    return json(
      {
        errors: {
          firstname: null,
          surname: null,
          email: null,
          password: "Password is required",
        },
      },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return json(
      {
        errors: {
          firstname: null,
          surname: null,
          email: null,
          password: "Password is too short",
        },
      },
      { status: 400 },
    );
  }

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    return json(
      {
        errors: {
          firstname: null,
          surname: null,
          email: "A user already exists with this email",
          password: null,
        },
      },
      { status: 400 },
    );
  }

  const user = await createUser(email, password, firstname, surname);

  // Joined from a shared shelf: ask its owner to be friends straight away.
  // Demo shelves are left out, since demo and real accounts can't mix.
  const invite = formData.get("invite");
  const inviter =
    typeof invite === "string" ? await getUserByShareToken(invite) : null;
  if (inviter && !inviter.demoGroup) {
    await createNotification(user.id, inviter.id, `${firstname} ${surname}`);
  }

  return createUserSession({
    redirectTo,
    remember: false,
    request,
    userId: user.id,
  });
};

export const meta: MetaFunction = () =>
  seo({
    title: "Sign up",
    description:
      "Create a free Stacks account to catalog your books, lend them to friends and borrow theirs.",
    path: "/join",
  });

export default function Join() {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? undefined;
  const invite = searchParams.get("invite") ?? undefined;
  const { inviterName, shelfNames } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const firstnameRef = useRef<HTMLInputElement>(null);
  const surnameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (actionData?.errors?.email) {
      emailRef.current?.focus();
    } else if (actionData?.errors?.password) {
      passwordRef.current?.focus();
    }
  }, [actionData]);

  return (
    <div className="flex flex-col justify-center py-12 md:py-20">
      <div className="mx-auto w-full max-w-md px-8">
        {shelfNames ? (
          <p className="mb-8 text-stone-600 dark:text-stone-300">
            Create an account to share a shelf with{" "}
            <strong className="font-semibold text-stone-900 dark:text-stone-100">
              {shelfNames.join(" and ")}
            </strong>
            . You&apos;ll see and lend each other&apos;s books, with your own notes and hearts.
          </p>
        ) : null}
        {inviterName ? (
          <p className="mb-8 text-stone-600 dark:text-stone-300">
            Create an account to borrow from{" "}
            <strong className="font-semibold text-stone-900 dark:text-stone-100">
              {inviterName}
            </strong>
            . We&apos;ll send them a friend request for you.
          </p>
        ) : null}
        <Form method="post" className="space-y-6">
          <div>
            <label
              htmlFor="firstname"
              className="block text-sm font-medium text-stone-700"
            >
              First Name
            </label>
            <div className="mt-1">
              <input
                ref={firstnameRef}
                id="firstname"
                required
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={true}
                name="firstname"
                type="text"
                aria-invalid={actionData?.errors?.firstname ? true : undefined}
                aria-describedby="firstname-error"
                className="w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors"
              />
              {actionData?.errors?.firstname ? (
                <div
                  className="pt-1 text-stone-900 dark:text-stone-100"
                  id="firstname-error"
                >
                  {actionData.errors.firstname}
                </div>
              ) : null}
            </div>
          </div>
          <div>
            <label
              htmlFor="surname"
              className="block text-sm font-medium text-stone-700"
            >
              Last Name
            </label>
            <div className="mt-1">
              <input
                ref={surnameRef}
                id="surname"
                required
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={true}
                name="surname"
                type="text"
                aria-invalid={actionData?.errors?.surname ? true : undefined}
                aria-describedby="surname-error"
                className="w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors"
              />
              {actionData?.errors?.surname ? (
                <div
                  className="pt-1 text-stone-900 dark:text-stone-100"
                  id="surname-error"
                >
                  {actionData.errors.surname}
                </div>
              ) : null}
            </div>
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

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-stone-700"
            >
              Password
            </label>
            <div className="mt-1">
              <input
                id="password"
                ref={passwordRef}
                name="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={actionData?.errors?.password ? true : undefined}
                aria-describedby="password-error"
                className="w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors"
              />
              {actionData?.errors?.password ? (
                <div
                  className="pt-1 text-stone-900 dark:text-stone-100"
                  id="password-error"
                >
                  {actionData.errors.password}
                </div>
              ) : null}
            </div>
          </div>

          <input type="hidden" name="redirectTo" value={redirectTo} />
          {invite ? <input type="hidden" name="invite" value={invite} /> : null}
          <button
            type="submit"
            className="w-full rounded-md bg-stone-700 dark:bg-stone-200 px-4 py-2 text-sm font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors"
          >
            Create Account
          </button>
          <div className="flex items-center justify-center">
            <div className="text-center text-sm text-stone-500">
              Already have an account?{" "}
              <Link
                className="text-stone-900 dark:text-stone-100 underline"
                to={{
                  pathname: "/login",
                  search: searchParams.toString(),
                }}
              >
                Log in
              </Link>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
