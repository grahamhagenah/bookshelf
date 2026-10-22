import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
  SerializeFrom,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link, useLoaderData, Form, useActionData, useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";

import { billingEnabled, confirmCheckout } from "~/billing.server";
import Avatar, {
  AVATAR_ICONS,
  AvatarGlyph,
  isAvatarIcon,
} from "~/components/avatar";
import {
  BookIcon,
  BorrowedIcon,
  CheckCircleIcon,
  ExportIcon,
  GridViewIcon,
  GroupIcon,
  ImportIcon,
  LentIcon,
  ListViewIcon,
} from "~/components/icons";
import Layout from "~/components / Layout/Layout";
import { getBookStats } from "~/models/book.server";
import { getDemoGroup } from "~/models/demo.server";
import {
  createHouseholdInvite,
  getHousehold,
  leaveHousehold,
  revokeHouseholdInvite,
  shelfIds,
} from "~/models/household.server";
import {
  getUserById,
  getUserByEmail,
  updateUser,
  generateShareToken,
  revokeShareToken,
  changePassword,
  setAppearance,
  setEmailSetting,
} from "~/models/user.server";
import { publicOrigin } from "~/origin.server";
import { FREE_LIMITS, PLUS_PRICES } from "~/plan";
import { getPlanUsage } from "~/plan.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import {
  coverSizeOf,
  isCoverSize,
  isLibraryView,
  isTheme,
  libraryViewOf,
  themeOf,
} from "~/utils";
import { sendVerification } from "~/verify-email.server";

export const meta: MetaFunction = () =>
  seo({ title: "Account", noindex: true });

export const handle = {
  breadcrumb: () => <span>Account</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  // Back from Stripe's checkout: confirm the upgrade now, then tidy the URL
  const checkout = new URL(request.url).searchParams.get("checkout");
  if (checkout && billingEnabled()) {
    try {
      await confirmCheckout(userId, checkout);
    } catch (error) {
      console.error("Couldn't confirm a checkout; the webhook will", error);
    }
    return redirect("/account?upgraded=1#plan");
  }
  const [user, bookStats, household, plan] = await Promise.all([
    getUserById(userId),
    getBookStats(userId, await shelfIds(userId)),
    getHousehold(userId),
    getPlanUsage(userId),
  ]);
  return {
    user,
    plan,
    billing: billingEnabled(),
    upgraded: new URL(request.url).searchParams.has("upgraded"),
    origin: publicOrigin(request),
    bookStats,
    household: household
      ? {
          members: household.members.map(({ id, firstname, surname, profileEmoji }) => ({
            id,
            firstname,
            surname,
            profileEmoji,
          })),
          inviteUrl: household.inviteToken
            ? `${publicOrigin(request)}/household/join/${household.inviteToken}`
            : null,
        }
      : null,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  // Demo accounts keep their placeholder email and have no password
  const isDemo = (await getDemoGroup(userId)) !== null;

  // Sharing the shelf with someone
  if (intent === "householdInvite") {
    await createHouseholdInvite(userId);
    return json({
      errors: null,
      passwordErrors: null,
      success: false,
      passwordSuccess: false,
      emojiSuccess: false,
    });
  }
  if (intent === "householdRevoke") {
    await revokeHouseholdInvite(userId);
    return json({
      errors: null,
      passwordErrors: null,
      success: false,
      passwordSuccess: false,
      emojiSuccess: false,
    });
  }
  if (intent === "householdLeave") {
    await leaveHousehold(userId);
    return json({
      errors: null,
      passwordErrors: null,
      success: false,
      passwordSuccess: false,
      emojiSuccess: false,
    });
  }

  // Handle share token actions
  if (intent === "generateShareToken") {
    await generateShareToken(userId);
    return json({
      errors: null,
      passwordErrors: null,
      success: false,
      passwordSuccess: false,
      emojiSuccess: false,
      shareAction: "generated",
    });
  }

  if (intent === "revokeShareToken") {
    await revokeShareToken(userId);
    return json({
      errors: null,
      passwordErrors: null,
      success: false,
      passwordSuccess: false,
      emojiSuccess: false,
      shareAction: "revoked",
    });
  }

  // Theme, library view and cover size: one at a time, whichever was sent
  if (intent === "appearance") {
    const theme = formData.get("theme");
    const libraryView = formData.get("libraryView");
    const coverSize = formData.get("coverSize");
    await setAppearance(userId, {
      theme: isTheme(theme) ? theme : undefined,
      libraryView: isLibraryView(libraryView) ? libraryView : undefined,
      coverSize: isCoverSize(coverSize) ? coverSize : undefined,
    });
    return json({
      errors: null,
      passwordErrors: null,
      success: false,
      passwordSuccess: false,
      emojiSuccess: false,
    });
  }

  // The two email switches: borrow requests, and the weekly roundup
  if (intent === "toggleEmailNotifications" || intent === "toggleWeeklyDigest") {
    const requests = intent === "toggleEmailNotifications";
    const on = formData.get(requests ? "emailNotifications" : "weeklyDigest") === "true";
    await setEmailSetting(userId, requests ? "requests" : "weekly", on);
    return json({
      errors: null,
      passwordErrors: null,
      success: false,
      passwordSuccess: false,
      emojiSuccess: false,
    });
  }

  // Handle profile emoji update
  if (intent === "updateProfileEmoji") {
    const emoji = formData.get("emoji");
    await updateUser(userId, {
      profileEmoji: isAvatarIcon(emoji) ? emoji : null,
    });
    return json({
      errors: null,
      passwordErrors: null,
      success: false,
      passwordSuccess: false,
      emojiSuccess: true,
    });
  }

  // Handle password change
  if (intent === "changePassword" && !isDemo) {
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    const passwordErrors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (typeof currentPassword !== "string" || currentPassword.length === 0) {
      passwordErrors.currentPassword = "Current password is required";
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      passwordErrors.newPassword = "New password must be at least 8 characters";
    }

    if (newPassword !== confirmPassword) {
      passwordErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(passwordErrors).length > 0) {
      return json(
        {
          errors: null,
          passwordErrors,
          success: false,
          passwordSuccess: false,
          emojiSuccess: false,
        },
        { status: 400 },
      );
    }

    const result = await changePassword(
      userId,
      currentPassword as string,
      newPassword as string,
    );

    if (!result.success) {
      passwordErrors.currentPassword = result.error;
      return json(
        {
          errors: null,
          passwordErrors,
          success: false,
          passwordSuccess: false,
          emojiSuccess: false,
        },
        { status: 400 },
      );
    }

    return json({
      errors: null,
      passwordErrors: null,
      success: false,
      passwordSuccess: true,
      emojiSuccess: false,
    });
  }

  // Handle profile update
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
    return json(
      {
        errors,
        passwordErrors: null,
        success: false,
        passwordSuccess: false,
        emojiSuccess: false,
      },
      { status: 400 },
    );
  }

  // Check if email is already taken by another user
  const existingUser = isDemo ? null : await getUserByEmail(email as string);
  if (existingUser && existingUser.id !== userId) {
    errors.email = "This email is already in use";
    return json(
      {
        errors,
        passwordErrors: null,
        success: false,
        passwordSuccess: false,
        emojiSuccess: false,
      },
      { status: 400 },
    );
  }

  const updated = await updateUser(userId, {
    firstname: (firstname as string).trim(),
    surname: (surname as string).trim(),
    email: isDemo ? undefined : (email as string).trim(),
  });
  // A changed address gets its own confirmation link
  if (updated.emailChanged) await sendVerification(userId);

  return json({
    errors: null,
    passwordErrors: null,
    success: true,
    passwordSuccess: false,
    emojiSuccess: false,
  });
};

const inputClass =
  "w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors";
const primaryButton =
  "rounded-md bg-forest-600 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700 transition-colors";
const quietButton =
  "rounded-md border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";
const textButton =
  "text-sm text-stone-500 dark:text-stone-400 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-800 dark:hover:text-stone-200";

export default function Account() {
  const data = useLoaderData<typeof loader>();
  const { household, user } = data;
  const actionData = useActionData<typeof action>();

  const firstnameRef = useRef<HTMLInputElement>(null);
  const surnameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const shareUrl = user?.shareToken ? `${data.origin}/share/${user.shareToken}` : null;

  useEffect(() => {
    if (actionData?.errors?.firstname) {
      firstnameRef.current?.focus();
    } else if (actionData?.errors?.surname) {
      surnameRef.current?.focus();
    } else if (actionData?.errors?.email) {
      emailRef.current?.focus();
    }
  }, [actionData]);

  const stats = [
    { label: "Friends", value: user?.following.length ?? 0, Icon: GroupIcon },
    { label: "Books", value: data.bookStats.totalBooks, Icon: BookIcon },
    { label: "Borrowed", value: data.bookStats.borrowedBooks, Icon: BorrowedIcon },
    { label: "Lent out", value: data.bookStats.lentBooks, Icon: LentIcon },
  ];

  return (
    <Layout title="Account">
      {/* Who you are, at a glance */}
      <section className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar
            firstname={user?.firstname}
            surname={user?.surname}
            icon={user?.profileEmoji}
            size="lg"
          />
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold text-stone-900 dark:text-stone-50">
              {user?.firstname} {user?.surname}
            </p>
            <p className="truncate text-stone-500 dark:text-stone-400">
              {user?.demoGroup ? "Demo account" : user?.email}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-2 sm:gap-3">
          {stats.map(({ label, value, Icon }) => (
            // Number above its label, though the label comes first in the markup
            <div
              key={label}
              className="flex flex-col-reverse items-center rounded-lg bg-stone-50 dark:bg-stone-900 px-2 py-2.5 sm:px-4"
            >
              <dt className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                <Icon size={12} />
                {label}
              </dt>
              <dd className="text-xl font-semibold text-stone-900 dark:text-stone-100">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Section
        title="Profile"
        description="Your name and picture are what friends see beside your books and notes."
      >
        <Form method="post" className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" id="firstname" error={actionData?.errors?.firstname}>
            <input
              ref={firstnameRef}
              id="firstname"
              name="firstname"
              type="text"
              autoComplete="given-name"
              defaultValue={user?.firstname}
              aria-invalid={actionData?.errors?.firstname ? true : undefined}
              aria-describedby="firstname-error"
              className={inputClass}
            />
          </Field>
          <Field label="Last name" id="surname" error={actionData?.errors?.surname}>
            <input
              ref={surnameRef}
              id="surname"
              name="surname"
              type="text"
              autoComplete="family-name"
              defaultValue={user?.surname}
              aria-invalid={actionData?.errors?.surname ? true : undefined}
              aria-describedby="surname-error"
              className={inputClass}
            />
          </Field>
          {/* A demo account's address is a placeholder, so it's sent but not shown */}
          {user?.demoGroup ? (
            <input type="hidden" name="email" value={user.email} />
          ) : (
            <Field
              label="Email address"
              id="email"
              error={actionData?.errors?.email}
              className="sm:col-span-2"
            >
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={user?.email}
                aria-invalid={actionData?.errors?.email ? true : undefined}
                aria-describedby="email-error"
                className={inputClass}
              />
            </Field>
          )}
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" className={primaryButton}>
              Save changes
            </button>
            {actionData?.success ? <Saved>Saved</Saved> : null}
          </div>
        </Form>

        <div className="mt-8 border-t border-stone-100 dark:border-stone-800 pt-6">
          <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300">Picture</h3>
          <Form method="post" className="mt-3 flex flex-wrap gap-2">
            <input type="hidden" name="intent" value="updateProfileEmoji" />
            {/* Initials first, then the icons */}
            {[null, ...AVATAR_ICONS].map((icon) => {
              const chosen = icon
                ? user?.profileEmoji === icon
                : !isAvatarIcon(user?.profileEmoji);
              return (
                <button
                  key={icon ?? "initials"}
                  type="submit"
                  name="emoji"
                  value={icon ?? ""}
                  aria-label={icon ? `Use the ${icon} icon` : "Use my initials"}
                  aria-pressed={chosen}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border text-stone-700 dark:text-stone-200 transition-colors ${
                    chosen
                      ? "border-forest-600 dark:border-forest-400 ring-1 ring-forest-600 dark:ring-forest-400 bg-stone-50 dark:bg-stone-800"
                      : "border-stone-200 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-500"
                  }`}
                >
                  {icon ? (
                    <AvatarGlyph icon={icon} size={22} />
                  ) : (
                    <span className="text-xs font-semibold">
                      {user?.firstname?.[0]}
                      {user?.surname?.[0]}
                    </span>
                  )}
                </button>
              );
            })}
          </Form>
        </div>
      </Section>

      <Section
        id="plan"
        title="Plan"
        description={`Free holds ${FREE_LIMITS.books} books and ${FREE_LIMITS.friends} friends. Stacks Plus has no limits.`}
      >
        <PlanPanel
          plan={data.plan}
          demo={Boolean(user?.demoGroup)}
          billing={data.billing}
          upgraded={data.upgraded}
        />
      </Section>

      <Section
        title="Preferences"
        description="How Stacks looks. These follow you to every device you sign in on."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Choice
            name="theme"
            value={themeOf(user)}
            label="Theme"
            hint="Auto matches your phone or computer"
            options={[
              ["light", "Light"],
              ["dark", "Dark"],
              ["system", "Auto"],
            ]}
          />
          <Choice
            name="libraryView"
            value={libraryViewOf(user)}
            label="Library view"
            hint="For your shelf and your friends'"
            options={[
              ["cover", "Covers", GridViewIcon],
              ["list", "List", ListViewIcon],
            ]}
          />
          <Choice
            name="coverSize"
            value={coverSizeOf(user)}
            label="Cover size"
            hint="Small fits more on a row"
            options={[
              ["large", "Large"],
              ["small", "Small"],
            ]}
          />
        </div>
      </Section>

      <Section
        title="Email"
        description="What Stacks emails you. Every email also has a link at the bottom to turn it off."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            intent="toggleEmailNotifications"
            name="emailNotifications"
            on={Boolean(user?.emailNotifications)}
            label="Borrow requests"
            hint="When a friend asks to borrow one of your books"
          />
          <Toggle
            intent="toggleWeeklyDigest"
            name="weeklyDigest"
            on={Boolean(user?.weeklyDigest)}
            label="Weekly roundup"
            hint="What's due back, and what friends added and read"
          />
        </div>
        {user && !user.emailVerifiedAt && !user.demoGroup ? (
          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
            Nothing is sent until you confirm your email address.
          </p>
        ) : null}
      </Section>

      <Section
        title="Sharing"
        description="Show your shelf to anyone with a link, or share one shelf with someone you live with."
      >
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300">Public link</h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Anyone with it can see your bookshelf without signing in.
            </p>
            <div className="mt-3">
              {shareUrl ? (
                <>
                  <CopyField value={shareUrl} label="Public link to your shelf" />
                  <Form method="post" className="mt-2">
                    <input type="hidden" name="intent" value="revokeShareToken" />
                    <button type="submit" className={textButton}>
                      Turn this link off
                    </button>
                  </Form>
                </>
              ) : (
                <Form method="post">
                  <input type="hidden" name="intent" value="generateShareToken" />
                  <button type="submit" className={quietButton}>
                    Make a link
                  </button>
                </Form>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Share a shelf
            </h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Live with someone whose books are your books? You both see and lend everything,
              and keep your own notes, hearts and friends.
            </p>
            <div className="mt-3">
              <HouseholdPanel household={household} />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Import and export"
        description="Bring your shelf over from Goodreads or StoryGraph in one go, or take a copy of it with you."
      >
        <div className="flex flex-wrap gap-3">
          <Link to="/import" className={`inline-flex items-center gap-2 ${quietButton}`}>
            <ImportIcon size={16} />
            Import from a file
          </Link>
          <a href="/export" download className={`inline-flex items-center gap-2 ${quietButton}`}>
            <ExportIcon size={16} />
            Export as CSV
          </a>
        </div>
        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
          Uses Goodreads&apos; columns, so Goodreads, StoryGraph and Stacks can all read it back.
        </p>
      </Section>

      {!user?.demoGroup ? (
        <Section title="Password" description="At least 8 characters.">
          <Form method="post" className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="intent" value="changePassword" />
            <Field
              label="Current password"
              id="currentPassword"
              error={actionData?.passwordErrors?.currentPassword}
            >
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                aria-invalid={actionData?.passwordErrors?.currentPassword ? true : undefined}
                aria-describedby="currentPassword-error"
                className={inputClass}
              />
            </Field>
            <Field
              label="New password"
              id="newPassword"
              error={actionData?.passwordErrors?.newPassword}
              className="sm:col-start-1"
            >
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={actionData?.passwordErrors?.newPassword ? true : undefined}
                aria-describedby="newPassword-error"
                className={inputClass}
              />
            </Field>
            <Field
              label="Confirm new password"
              id="confirmPassword"
              error={actionData?.passwordErrors?.confirmPassword}
            >
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={actionData?.passwordErrors?.confirmPassword ? true : undefined}
                aria-describedby="confirmPassword-error"
                className={inputClass}
              />
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button type="submit" className={primaryButton}>
                Change password
              </button>
              {actionData?.passwordSuccess ? <Saved>Password changed</Saved> : null}
            </div>
          </Form>
        </Section>
      ) : null}
    </Layout>
  );
}

// A settings group: its name and a line about it on the left, the
// controls on the right (stacked on a phone)
function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    // Clear of the sticky header when linked to
    <section id={id} className="grid scroll-mt-24 gap-5 md:grid-cols-3 md:gap-10">
      <div>
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">{title}</h2>
        <p className="mt-1 text-pretty text-sm text-stone-500 dark:text-stone-400">
          {description}
        </p>
      </div>
      <div className="max-w-xl md:col-span-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  id,
  error,
  className = "",
  children,
}: {
  label: string;
  id: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p className="mt-1 text-sm text-rose-700 dark:text-rose-400" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Saved({ children }: { children: React.ReactNode }) {
  return (
    <span role="status" className="inline-flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400">
      <CheckCircleIcon size={16} className="text-forest-600 dark:text-forest-400" />
      {children}
    </span>
  );
}

// A switch with its label right beside it; flips straight away and
// saves in the background
function Toggle({
  intent,
  name,
  on,
  label,
  hint,
}: {
  intent: string;
  name: string;
  on: boolean;
  label: string;
  hint: string;
}) {
  const fetcher = useFetcher();
  const checked = fetcher.formData ? fetcher.formData.get(name) === "true" : on;
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name={name} value={checked ? "false" : "true"} />
      <button
        type="submit"
        role="switch"
        aria-checked={checked}
        className="flex h-full w-full items-center gap-3 rounded-lg border border-stone-200 dark:border-stone-800 px-4 py-3 text-left hover:border-stone-300 dark:hover:border-stone-700 transition-colors"
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
            checked ? "bg-forest-600" : "bg-stone-300 dark:bg-stone-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-stone-900 dark:text-stone-100">
            {label}
          </span>
          <span className="block text-sm text-stone-500 dark:text-stone-400">{hint}</span>
        </span>
      </button>
    </fetcher.Form>
  );
}

// A setting with a few options, side by side like segments of one
// button; saved as soon as one is picked
function Choice({
  name,
  value,
  label,
  hint,
  options,
}: {
  name: string;
  value: string;
  label: string;
  hint: string;
  options: [string, string, ComponentType<{ size?: number }>?][];
}) {
  const fetcher = useFetcher();
  const current = (fetcher.formData?.get(name) as string | undefined) ?? value;
  const id = `choice-${name}`;
  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-800 px-4 py-3">
      <p id={id} className="text-sm font-medium text-stone-900 dark:text-stone-100">
        {label}
      </p>
      <p className="text-sm text-stone-500 dark:text-stone-400">{hint}</p>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className="mt-3 grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-stone-100 dark:bg-stone-800 p-1"
      >
        {options.map(([option, text, Icon]) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center justify-center gap-1.5 rounded px-2 py-1 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-stone-400 ${
              current === option
                ? "bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-50 shadow-sm"
                : "text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={current === option}
              onChange={() =>
                fetcher.submit({ intent: "appearance", [name]: option }, { method: "post" })
              }
              className="sr-only"
            />
            {Icon ? <Icon size={14} /> : null}
            {text}
          </label>
        ))}
      </div>
    </div>
  );
}

// A link to hand on, with a button to copy it
function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the link is right there to select
    }
  };
  return (
    <div className="flex gap-2">
      <input
        type="text"
        readOnly
        value={value}
        aria-label={label}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 py-2 text-sm text-stone-700 dark:text-stone-300"
      />
      <button type="button" onClick={copy} className={`flex-shrink-0 ${quietButton}`}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

// Who's on the shelf, the invite link to add someone, and the way out
function HouseholdPanel({
  household,
}: {
  household: {
    members: { id: string; firstname: string; surname: string; profileEmoji: string | null }[];
    inviteUrl: string | null;
  } | null;
}) {
  const others = household?.members.length ?? 0;

  return (
    <div className="space-y-3">
      {household && others > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {household.members.map((member) => (
            <li key={member.id} className="flex items-center gap-2 text-sm text-stone-800 dark:text-stone-200">
              <Avatar
                firstname={member.firstname}
                surname={member.surname}
                icon={member.profileEmoji}
                size="sm"
              />
              {member.firstname} {member.surname}
            </li>
          ))}
        </ul>
      ) : null}

      {household?.inviteUrl ? (
        <div className="space-y-2">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Send this to the person you share with. They&apos;ll join your shelf when they open it.
          </p>
          <CopyField value={household.inviteUrl} label="Invite link for your shelf" />
          <Form method="post">
            <input type="hidden" name="intent" value="householdRevoke" />
            <button type="submit" className={textButton}>
              Turn this link off
            </button>
          </Form>
        </div>
      ) : (
        <Form method="post">
          <input type="hidden" name="intent" value="householdInvite" />
          <button type="submit" className={quietButton}>
            {others > 1 ? "Invite someone else" : "Make an invite link"}
          </button>
        </Form>
      )}

      {household && others > 1 ? (
        <Form
          method="post"
          onSubmit={(event) => {
            if (!confirm("Leave this shelf? Your own books come with you; theirs stay with them.")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="householdLeave" />
          <button type="submit" className={textButton}>
            Leave this shelf
          </button>
        </Form>
      ) : null}
    </div>
  );
}

const longDate = (date: string | Date) =>
  new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// How full the free plan is and what Plus costs, or where their Plus comes
// from and how to manage it
function PlanPanel({
  plan,
  demo,
  billing,
  upgraded,
}: {
  plan: SerializeFrom<typeof loader>["plan"];
  demo: boolean;
  billing: boolean;
  upgraded: boolean;
}) {
  const usage = `${plan.books} ${plan.books === 1 ? "book" : "books"} · ${plan.friends} ${
    plan.friends === 1 ? "friend" : "friends"
  }`;

  if (plan.plus) {
    const own = plan.own;
    const detail = demo
      ? usage
      : plan.coveredBy
        ? `Covered by ${plan.coveredBy}'s Plus, for everyone on your shared shelf. ${usage}`
        : own?.pastDue
          ? "Your last payment didn't go through. Stripe will try again; you can update your card below."
          : own?.endsAt
            ? `Cancelled. Plus stays on until ${longDate(own.endsAt)}.`
            : own?.renewsAt
              ? `Renews ${longDate(own.renewsAt)}. ${usage}`
              : own && !own.paid
                ? `A gift from Stacks. ${usage}`
                : usage;
    return (
      <div className="rounded-lg border border-stone-200 dark:border-stone-800 px-4 py-3">
        {upgraded ? (
          <p className="mb-2 text-sm font-medium text-forest-700 dark:text-forest-400" role="status">
            Welcome to Stacks Plus. Thank you!
          </p>
        ) : null}
        <p className="font-medium text-stone-900 dark:text-stone-100">
          {demo ? "The demo has no limits" : "You're on Stacks Plus"}
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{detail}</p>
        {billing && plan.canManage && !demo ? (
          <BillingButton intent="portal" className={`mt-3 ${quietButton}`}>
            Manage subscription
          </BillingButton>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Meter
          label={plan.shared ? "Books on your shared shelf" : "Books"}
          used={plan.books}
          limit={FREE_LIMITS.books}
        />
        <Meter label="Friends" used={plan.friends} limit={FREE_LIMITS.friends} />
      </div>
      <div className="rounded-lg border border-stone-200 dark:border-stone-800 px-4 py-3">
        <p className="font-medium text-stone-900 dark:text-stone-100">Stacks Plus</p>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          Unlimited books and friends, for everyone on your shelf. Cancel any time.
        </p>
        {demo ? (
          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
            The demo already has everything; sign up to subscribe.
          </p>
        ) : billing ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <BillingButton intent="checkout" interval="monthly" className={primaryButton}>
              ${PLUS_PRICES.monthly} a month
            </BillingButton>
            <BillingButton intent="checkout" interval="yearly" className={quietButton}>
              ${PLUS_PRICES.yearly} a year
            </BillingButton>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled className={`${primaryButton} disabled:opacity-60`}>
              Upgrade
            </button>
            <span className="text-sm text-stone-500 dark:text-stone-400">Coming soon</span>
          </div>
        )}
        {plan.canManage ? (
          <BillingButton intent="portal" className="mt-3 text-sm text-stone-500 dark:text-stone-400 underline underline-offset-2">
            Billing history
          </BillingButton>
        ) : null}
      </div>
    </div>
  );
}

// Off to Stripe: a full page post, since Stripe's pages aren't ours
function BillingButton({
  intent,
  interval,
  className,
  children,
}: {
  intent: "checkout" | "portal";
  interval?: "monthly" | "yearly";
  className: string;
  children: React.ReactNode;
}) {
  const [going, setGoing] = useState(false);
  // Coming back with the browser's Back button shows the button again
  useEffect(() => {
    const reset = () => setGoing(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  return (
    <Form method="post" action="/api/billing" reloadDocument onSubmit={() => setGoing(true)}>
      <input type="hidden" name="intent" value={intent} />
      {interval ? <input type="hidden" name="interval" value={interval} /> : null}
      <button type="submit" className={className}>
        {going ? "Opening Stripe…" : children}
      </button>
    </Form>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const full = used >= limit;
  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-800 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-stone-700 dark:text-stone-300">{label}</span>
        <span className="tabular-nums text-stone-500 dark:text-stone-400">
          <span className="font-medium text-stone-900 dark:text-stone-100">{used}</span> of {limit}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 rounded-full bg-stone-100 dark:bg-stone-800"
        role="meter"
        aria-label={label}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
      >
        <div
          className={`h-full rounded-full ${full ? "bg-amber-500" : "bg-forest-600 dark:bg-forest-400"}`}
          style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
        />
      </div>
    </div>
  );
}
