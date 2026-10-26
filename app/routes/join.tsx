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

import { primaryButton, textField } from "~/components/ui";
import { notifyAdminsOfSignup } from "~/models/admin.server";
import { getInviter } from "~/models/friend.server";
import { getGroupByToken } from "~/models/group.server";
import { getHouseholdByInvite } from "~/models/household.server";
import { sendLoanInvite } from "~/models/loan-invite.server";
import {
  createNotification,
  createUser,
  getUserByEmail,
  getUserByShareToken,
} from "~/models/user.server";
import { seo } from "~/seo";
import { createUserSession, getUserId } from "~/session.server";
import {
  HONEYPOT_FIELD,
  looksLikeBot,
  safeRedirect,
  validateEmail,
} from "~/utils";
import { sendVerification } from "~/verify-email.server";

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
  // Or from someone's personal invite link: you'll be friends once you're in
  const friend = url.searchParams.get("friend");
  const friendInviter = friend ? await getInviter(friend) : null;
  // Or from a group's link: you'll be in it once you're in
  const groupToken = url.searchParams.get("group");
  const group = groupToken ? await getGroupByToken(groupToken) : null;
  return json({
    inviterName: inviter ? `${inviter.firstname} ${inviter.surname}` : null,
    shelfNames: shelf ? shelf.members.map((m) => m.firstname) : null,
    friendName: friendInviter ? friendInviter.firstname : null,
    groupName: group ? group.name : null,
    renderedAt: Date.now(),
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const firstname = formData.get("firstname");
  const surname = formData.get("surname");
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = safeRedirect(formData.get("redirectTo"), "/");

  // A filled honeypot is a bot: send it away as if it had worked, so it
  // has nothing to learn. A form sent too fast may be a person with
  // autofill, so ask them to try again instead.
  const bot = looksLikeBot(formData);
  if (bot === "honeypot") return redirect("/");
  if (bot === "too-fast") {
    return json(
      {
        errors: {
          firstname: null,
          surname: null,
          email: null,
          password: "Something went wrong. Please try again.",
        },
      },
      { status: 400 },
    );
  }

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
  // Someone lent them a book before they joined: the account is waiting,
  // and the link that claims it goes to their inbox, which proves it's them
  if (existingUser?.invitedAt) {
    await sendLoanInvite(existingUser.id);
    return json(
      {
        errors: {
          firstname: null,
          surname: null,
          email:
            "Someone lent you a book at this address, so your account is waiting. We've emailed you a link to finish setting it up.",
          password: null,
        },
      },
      { status: 400 },
    );
  }
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
  await sendVerification(user.id);

  // Joined from a shared shelf: ask its owner to be friends straight away.
  // Demo shelves are left out, since demo and real accounts can't mix.
  const invite = formData.get("invite");
  const inviter =
    typeof invite === "string" ? await getUserByShareToken(invite) : null;
  if (inviter && !inviter.demoGroup) {
    await createNotification(user.id, inviter.id, `${firstname} ${surname}`);
  }

  // Not awaited, so a slow or failing email never holds up signing up
  void notifyAdminsOfSignup(user, {
    invitedBy:
      inviter && !inviter.demoGroup
        ? `${inviter.firstname} ${inviter.surname}`
        : null,
  }).catch((error) => console.error("Couldn't email admins about a sign-up:", error));

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
  const { inviterName, shelfNames, friendName, groupName, renderedAt } =
    useLoaderData<typeof loader>();
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
        {friendName ? (
          <p className="mb-8 text-stone-600 dark:text-stone-300">
            Create an account and you&apos;ll be friends with{" "}
            <strong className="font-semibold text-stone-900 dark:text-stone-100">
              {friendName}
            </strong>{" "}
            straight away, free to borrow from their shelf.
          </p>
        ) : null}
        {groupName ? (
          <p className="mb-8 text-stone-600 dark:text-stone-300">
            Create an account to join{" "}
            <strong className="font-semibold text-stone-900 dark:text-stone-100">
              {groupName}
            </strong>
            . You&apos;ll be friends with everyone in it straight away.
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
              className="block text-sm font-medium text-stone-700 dark:text-stone-200"
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
                className={textField}
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
              className="block text-sm font-medium text-stone-700 dark:text-stone-200"
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
                className={textField}
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

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-stone-700 dark:text-stone-200"
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
                className={textField}
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

          {/* Hidden from people and screen readers; bots fill it in */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor={HONEYPOT_FIELD}>Website</label>
            <input
              id={HONEYPOT_FIELD}
              name={HONEYPOT_FIELD}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>
          <input type="hidden" name="renderedAt" value={renderedAt} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          {invite ? <input type="hidden" name="invite" value={invite} /> : null}
          <button
            type="submit"
            className={`${primaryButton("lg")} w-full`}
          >
            Create Account
          </button>
          <p className="text-center text-xs text-stone-500 dark:text-stone-400">
            By creating an account you agree to the{" "}
            <Link to="/terms" className="underline underline-offset-2">terms</Link> and{" "}
            <Link to="/privacy" className="underline underline-offset-2">privacy policy</Link>.
          </p>
          <div className="flex items-center justify-center">
            <div className="text-center text-sm text-stone-500 dark:text-stone-400">
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
