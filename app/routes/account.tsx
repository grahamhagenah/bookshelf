import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
  SerializeFrom,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Link,
  useLoaderData,
  Form,
  useActionData,
  useFetcher,
  useNavigation,
} from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";

import { billingEnabled, confirmCheckout } from "~/billing.server";
import Avatar, {
  AVATAR_ICONS,
  AvatarGlyph,
  Bookplate,
  iconTone,
  isPicture,
  PLATE,
  PLATE_COLORS,
  pictureOf,
} from "~/components/avatar";
import type { PlateColor } from "~/components/avatar";
import BookCover from "~/components/book-cover";
import CopyButton from "~/components/copy-button";
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
import { joinNames } from "~/components/shared-with";
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
  deleteUsers,
  setDiscoverable,
} from "~/models/user.server";
import { publicOrigin } from "~/origin.server";
import { FREE_LIMITS, PLUS_PRICES } from "~/plan";
import { getPlanUsage } from "~/plan.server";
import { BIO_MAX, HANDLE_MAX, PIN_MAX } from "~/profile";
import { getPins, movePin, saveProfile, unpinBook } from "~/profile.server";
import { seo } from "~/seo";
import { getSession, requireUserId, sessionStorage } from "~/session.server";
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
  const [user, bookStats, household, plan, pins] = await Promise.all([
    getUserById(userId),
    getBookStats(userId, await shelfIds(userId)),
    getHousehold(userId),
    getPlanUsage(userId),
    getPins(userId),
  ]);
  return {
    user,
    // The books pinned to the top of their public page, in order
    pins,
    plan,
    billing: billingEnabled(),
    upgraded: new URL(request.url).searchParams.has("upgraded"),
    billingFailed:
      new URL(request.url).searchParams.get("billing") === "failed",
    origin: publicOrigin(request),
    bookStats,
    household: household
      ? {
          members: household.members.map(
            ({ id, firstname, surname, profileEmoji }) => ({
              id,
              firstname,
              surname,
              profileEmoji,
            }),
          ),
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

  // The public page's handle and bio
  // Reordering and unpinning the public page's favorites
  if (intent === "movePin" || intent === "unpinFromPage") {
    const bookId = formData.get("bookId");
    if (typeof bookId !== "string") return null;
    if (intent === "unpinFromPage") await unpinBook(userId, bookId);
    else
      await movePin(
        userId,
        bookId,
        formData.get("direction") === "earlier" ? "earlier" : "later",
      );
    return null;
  }

  if (intent === "saveProfile") {
    const result = await saveProfile(userId, {
      handle: String(formData.get("handle") ?? ""),
      bio: String(formData.get("bio") ?? ""),
    });
    return json(
      {
        errors: null,
        passwordErrors: null,
        success: false,
        passwordSuccess: false,
        emojiSuccess: false,
        profileSaved: result.ok,
        profileError: result.ok ? undefined : result.error,
      },
      { status: result.ok ? 200 : 400 },
    );
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
  if (
    intent === "toggleEmailNotifications" ||
    intent === "toggleWeeklyDigest"
  ) {
    const requests = intent === "toggleEmailNotifications";
    const on =
      formData.get(requests ? "emailNotifications" : "weeklyDigest") === "true";
    await setEmailSetting(userId, requests ? "requests" : "weekly", on);
    return json({
      errors: null,
      passwordErrors: null,
      success: false,
      passwordSuccess: false,
      emojiSuccess: false,
    });
  }

  // Whether other people can find you
  if (intent === "toggleDiscoverable") {
    await setDiscoverable(userId, formData.get("discoverable") === "true");
    return json({
      errors: null,
      passwordErrors: null,
      success: false,
      passwordSuccess: false,
      emojiSuccess: false,
    });
  }

  // The picture: an icon, a bookplate in a chosen color, or (empty) a
  // bookplate in the color that comes from your name
  if (intent === "updateProfileEmoji") {
    const emoji = formData.get("emoji");
    await updateUser(userId, {
      profileEmoji: isPicture(emoji) ? String(emoji) : null,
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
  // Deleting your own account: everything goes, any subscription is
  // canceled, and you're signed out. The demo resets on its own instead.
  if (intent === "deleteAccount" && !isDemo) {
    await deleteUsers([userId]);
    const session = await getSession(request);
    return redirect("/?deleted=1", {
      headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
    });
  }

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

  const shareUrl = user?.shareToken
    ? `${data.origin}/share/${user.shareToken}`
    : null;

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
    {
      label: "Borrowed",
      value: data.bookStats.borrowedBooks,
      Icon: BorrowedIcon,
    },
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
              <dd className="text-xl font-semibold text-stone-900 dark:text-stone-100">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Section
        title="Profile"
        description="Your name and picture are what friends see beside your books and notes."
      >
        <Form method="post" className="grid gap-4 sm:grid-cols-2">
          <Field
            label="First name"
            id="firstname"
            error={actionData?.errors?.firstname}
          >
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
          <Field
            label="Last name"
            id="surname"
            error={actionData?.errors?.surname}
          >
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
          <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300">
            Picture
          </h3>
          <Form method="post" className="mt-3 space-y-3">
            <input type="hidden" name="intent" value="updateProfileEmoji" />
            <IconPicker
              current={user?.profileEmoji ?? null}
              firstname={user?.firstname ?? null}
              surname={user?.surname ?? null}
            />
          </Form>
        </div>
      </Section>

      <Section
        id="plan"
        title="Plan"
        description={`Free holds ${FREE_LIMITS.books} books and ${FREE_LIMITS.friends} friends. Stacks Plus has no limits.`}
      >
        {data.billingFailed ? (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-stone-100 dark:bg-stone-900 px-4 py-3 text-sm text-stone-700 dark:text-stone-200"
          >
            Stripe couldn&apos;t open just now. Nothing was charged; try again
            in a minute.
          </p>
        ) : null}
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
            label="Shelf view"
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
        id="emails"
        title="Email"
        description="What Stacks emails you. Every email also has a link at the bottom to turn it off."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            intent="toggleEmailNotifications"
            name="emailNotifications"
            on={Boolean(user?.emailNotifications)}
            label="Borrow requests and news"
            hint="When a friend asks to borrow one of your books, and the occasional word from Stacks"
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
        id="privacy"
        title="Privacy"
        description="Who can find you. Your shelf itself is seen by your friends, and by anyone you give your public link to."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            intent="toggleDiscoverable"
            name="discoverable"
            on={user?.discoverable ?? true}
            label="Let people find me"
            hint="In search by name or email, and among new people on Stacks. Off, friends reach you by your invite link only."
          />
        </div>
      </Section>

      <Section
        id="sharing"
        title="Sharing"
        description="Show your shelf to anyone with a link, or share one shelf with someone you live with."
      >
        <div className="space-y-8">
          <PublicPage
            handle={user?.handle ?? null}
            bio={user?.bio ?? null}
            origin={data.origin}
            shareUrl={shareUrl}
            pins={data.pins}
          />

          <div>
            <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300">
              Share a shelf
            </h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Live with someone whose books are your books? You both see and
              lend everything, and keep your own notes, hearts and friends.
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
          <Link
            to="/import"
            className={`inline-flex items-center gap-2 ${quietButton}`}
          >
            <ImportIcon size={16} />
            Import from a file
          </Link>
          <a
            href="/export"
            download
            className={`inline-flex items-center gap-2 ${quietButton}`}
          >
            <ExportIcon size={16} />
            Export as CSV
          </a>
        </div>
        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
          Uses Goodreads&apos; columns, so Goodreads, StoryGraph and Stacks can
          all read it back.
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
                aria-invalid={
                  actionData?.passwordErrors?.currentPassword ? true : undefined
                }
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
                aria-invalid={
                  actionData?.passwordErrors?.newPassword ? true : undefined
                }
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
                aria-invalid={
                  actionData?.passwordErrors?.confirmPassword ? true : undefined
                }
                aria-describedby="confirmPassword-error"
                className={inputClass}
              />
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button type="submit" className={primaryButton}>
                Change password
              </button>
              {actionData?.passwordSuccess ? (
                <Saved>Password changed</Saved>
              ) : null}
            </div>
          </Form>
        </Section>
      ) : null}

      {!user?.demoGroup ? (
        <Section
          title="Delete account"
          description="Gone for good, with nothing left to bill."
        >
          <DeleteAccount
            plus={Boolean(data.plan.own?.paid)}
            shared={data.plan.shared}
          />
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
    <section
      id={id}
      className="grid scroll-mt-24 gap-5 md:grid-cols-3 md:gap-10"
    >
      <div>
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
          {title}
        </h2>
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
      <label
        htmlFor={id}
        className="block text-sm font-medium text-stone-700 dark:text-stone-300"
      >
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p
          className="mt-1 text-sm text-rose-700 dark:text-rose-400"
          id={`${id}-error`}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Saved({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400"
    >
      <CheckCircleIcon
        size={16}
        className="text-forest-600 dark:text-forest-400"
      />
      {children}
    </span>
  );
}

// Your picture: your initials as a bookplate, or an icon, in a color of
// your choosing. Picking a color recolors what you have and saves it. Ink
// is the grey for both. Until a color's picked, initials wear the one
// your name gives, and icons are plain grey.
function IconPicker({
  current,
  firstname,
  surname,
}: {
  current: string | null;
  firstname: string | null;
  surname: string | null;
}) {
  const picture = pictureOf(current);
  const [color, setColor] = useState<PlateColor | null>(picture.color);
  const ring = (on: boolean) =>
    `ring-offset-2 ring-offset-white dark:ring-offset-stone-950 transition-shadow ${
      on
        ? "ring-2 ring-forest-600 dark:ring-forest-400"
        : "ring-1 ring-stone-200 dark:ring-stone-700 hover:ring-stone-400 dark:hover:ring-stone-500"
    }`;
  const choices = Object.keys(PLATE_COLORS) as PlateColor[];
  // What a picture with this icon (or none, for initials) and color saves as
  const value = (icon: string | null, tone: PlateColor | null) =>
    icon ? (tone ? `${icon}:${tone}` : icon) : tone ? `${PLATE}${tone}` : "";
  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2.5 pt-1"
        role="group"
        aria-label="Color"
      >
        <span className="mr-1 text-sm text-stone-500 dark:text-stone-400">
          Color
        </span>
        {choices.map((choice) => (
          <button
            key={choice}
            type="submit"
            name="emoji"
            value={value(picture.icon, choice)}
            onClick={() => setColor(choice)}
            aria-label={`Use ${choice === "ink" ? "grey" : choice}`}
            aria-pressed={color === choice}
            className={`flex h-7 w-7 items-center justify-center rounded-full ${iconTone(choice)} ${ring(color === choice)}`}
          >
            {/* The ink as a dot, since the tints alone look much alike */}
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-full bg-current"
            />
          </button>
        ))}
      </div>
      <div className="!mt-6 grid w-fit grid-cols-5 gap-3 sm:grid-cols-9">
        {/* Your initials first, then the icons: 45 in all, so five or
            nine across leaves no stragglers */}
        <button
          type="submit"
          name="emoji"
          value={value(null, color)}
          aria-label="Use your initials"
          aria-pressed={!picture.icon}
          className={`rounded-full ${ring(!picture.icon)}`}
        >
          <Bookplate
            firstname={firstname}
            surname={surname}
            color={color}
            box="h-11 w-11 text-sm"
            framed
          />
        </button>
        {AVATAR_ICONS.map((icon) => {
          const chosen = picture.icon === icon;
          return (
            <button
              key={icon}
              type="submit"
              name="emoji"
              value={value(icon, color)}
              aria-label={`Use the ${icon} icon`}
              aria-pressed={chosen}
              className={`flex h-11 w-11 items-center justify-center rounded-full ${iconTone(color)} ${ring(chosen)}`}
            >
              <AvatarGlyph icon={icon} size={27} />
            </button>
          );
        })}
      </div>
    </>
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
          <span className="block text-sm text-stone-500 dark:text-stone-400">
            {hint}
          </span>
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
      <p
        id={id}
        className="text-sm font-medium text-stone-900 dark:text-stone-100"
      >
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
                fetcher.submit(
                  { intent: "appearance", [name]: option },
                  { method: "post" },
                )
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
      <CopyButton value={value} className={`flex-shrink-0 ${quietButton}`} />
    </div>
  );
}

// Who's on the shelf, the invite link to add someone, and the way out
function HouseholdPanel({
  household,
}: {
  household: {
    members: {
      id: string;
      firstname: string;
      surname: string;
      profileEmoji: string | null;
    }[];
    inviteUrl: string | null;
  } | null;
}) {
  const others = household?.members.length ?? 0;

  const invite = household?.inviteUrl ? (
    <div className="space-y-2">
      <p className="text-sm text-stone-600 dark:text-stone-300">
        Send this to the person you share with. They&apos;ll join your shelf
        when they open it.
      </p>
      <CopyField
        value={household.inviteUrl}
        label="Invite link for your shelf"
      />
      <Form method="post">
        <input type="hidden" name="intent" value="householdRevoke" />
        <button type="submit" className={textButton}>
          Turn this link off
        </button>
      </Form>
    </div>
  ) : others > 1 ? (
    // In the shared shelf's card, under a line saying what it's for, like
    // the choices on a loan
    <Form method="post">
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Anyone else live with you?
      </p>
      <input type="hidden" name="intent" value="householdInvite" />
      <button type="submit" className={`mt-2 ${quietButton}`}>
        Invite them to this shelf
      </button>
    </Form>
  ) : (
    <Form method="post">
      <input type="hidden" name="intent" value="householdInvite" />
      <button type="submit" className={quietButton}>
        Make an invite link
      </button>
    </Form>
  );

  if (!household || others < 2) return invite;

  // Everyone on the shelf as one unit, laid out like a loan on a book's
  // page: who, then what you can do, then the way out
  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-800 text-sm">
      <div className="flex items-center gap-3 p-4">
        <ul aria-hidden="true" className="flex flex-shrink-0 -space-x-2.5">
          {household.members.map((member) => (
            <li
              key={member.id}
              className="rounded-full ring-2 ring-white dark:ring-stone-950"
            >
              <Avatar
                firstname={member.firstname}
                surname={member.surname}
                icon={member.profileEmoji}
              />
            </li>
          ))}
        </ul>
        <div className="min-w-0">
          <p className="text-base text-stone-900 dark:text-stone-100">
            <span className="font-semibold">
              {joinNames(household.members.map((member) => member.firstname))}
            </span>{" "}
            share this shelf
          </p>
          <p className="truncate text-stone-500 dark:text-stone-400">
            {joinNames(
              household.members.map(
                (member) => `${member.firstname} ${member.surname}`,
              ),
            )}
          </p>
        </div>
      </div>
      <div className="border-t border-stone-100 dark:border-stone-800 p-4">
        {invite}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-stone-100 dark:border-stone-800 px-4 py-3">
        <p className="text-stone-500 dark:text-stone-400">Moving out?</p>
        <Form
          method="post"
          onSubmit={(event) => {
            if (
              !confirm(
                "Leave this shelf? Your own books come with you; theirs stay with them.",
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="householdLeave" />
          <button
            type="submit"
            className="rounded-md border border-stone-200 dark:border-stone-700 px-2 py-1.5 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
          >
            Leave this shelf
          </button>
        </Form>
      </div>
    </div>
  );
}

const longDate = (date: string | Date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

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
            ? `Canceled. Plus stays on until ${longDate(own.endsAt)}.`
            : own?.renewsAt
              ? `Renews ${longDate(own.renewsAt)}. ${usage}`
              : own && !own.paid
                ? `A gift from Stacks. ${usage}`
                : usage;
    return (
      <div className="rounded-lg border border-stone-200 dark:border-stone-800 px-4 py-3">
        {upgraded ? (
          <p
            className="mb-2 text-sm font-medium text-forest-700 dark:text-forest-400"
            role="status"
          >
            Welcome to Stacks Plus. Thank you!
          </p>
        ) : null}
        <p className="font-medium text-stone-900 dark:text-stone-100">
          {demo ? "The demo has no limits" : "You're on Stacks Plus"}
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {detail}
        </p>
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
        <Meter
          label="Friends"
          used={plan.friends}
          limit={FREE_LIMITS.friends}
        />
      </div>
      <div className="rounded-lg border border-stone-200 dark:border-stone-800 px-4 py-3">
        <p className="font-medium text-stone-900 dark:text-stone-100">
          Stacks Plus
        </p>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
          Unlimited books and friends, for everyone on your shelf. Cancel any
          time.
        </p>
        {demo ? (
          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
            The demo already has everything; sign up to subscribe.
          </p>
        ) : billing ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <BillingButton
              intent="checkout"
              interval="monthly"
              className={primaryButton}
            >
              ${PLUS_PRICES.monthly} a month
            </BillingButton>
            <BillingButton
              intent="checkout"
              interval="yearly"
              className={quietButton}
            >
              ${PLUS_PRICES.yearly} a year
            </BillingButton>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled
              className={`${primaryButton} disabled:opacity-60`}
            >
              Upgrade
            </button>
            <span className="text-sm text-stone-500 dark:text-stone-400">
              Coming soon
            </span>
          </div>
        )}
        {plan.canManage ? (
          <BillingButton
            intent="portal"
            className="mt-3 text-sm text-stone-500 dark:text-stone-400 underline underline-offset-2"
          >
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
    <Form
      method="post"
      action="/api/billing"
      reloadDocument
      onSubmit={() => setGoing(true)}
    >
      <input type="hidden" name="intent" value={intent} />
      {interval ? (
        <input type="hidden" name="interval" value={interval} />
      ) : null}
      <button type="submit" className={className}>
        {going ? "Opening Stripe…" : children}
      </button>
    </Form>
  );
}

function Meter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const full = used >= limit;
  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-800 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-stone-700 dark:text-stone-300">{label}</span>
        <span className="tabular-nums text-stone-500 dark:text-stone-400">
          <span className="font-medium text-stone-900 dark:text-stone-100">
            {used}
          </span>{" "}
          of {limit}
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
      {/* From before the limit was lower: nothing is taken away */}
      {used > limit ? (
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          Over the free limit. You keep everything you have; adding more needs
          Plus.
        </p>
      ) : null}
    </div>
  );
}

// Two clicks: the first arms it and says what goes, the second deletes.
// It disarms on its own, or when focus moves away.
function DeleteAccount({ plus, shared }: { plus: boolean; shared: boolean }) {
  const [armed, setArmed] = useState(false);
  const navigation = useNavigation();
  const deleting =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "deleteAccount";

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <div className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
      <p>
        This deletes your account with your books, notes, hearts, friendships
        and lending history.
        {shared
          ? " The books you added leave the shared shelf; everyone else keeps theirs."
          : ""}
        {plus
          ? " Your Stacks Plus subscription is canceled, so you won't be billed again."
          : ""}{" "}
        It can&apos;t be undone, so you might{" "}
        <a href="/export" download className="underline underline-offset-2">
          download your shelf
        </a>{" "}
        first.
      </p>
      <Form
        method="post"
        onSubmit={(event) => {
          if (!armed) {
            event.preventDefault();
            setArmed(true);
          }
        }}
      >
        <input type="hidden" name="intent" value="deleteAccount" />
        <button
          type="submit"
          disabled={deleting}
          onBlur={() => setArmed(false)}
          // Same width either way, so nothing moves
          className={`w-48 rounded-md px-4 py-2 text-sm font-medium ring-1 ring-inset transition-colors disabled:opacity-60 ${
            armed || deleting
              ? "bg-red-600 text-white ring-red-600 hover:bg-red-700"
              : "text-red-700 ring-red-200 hover:bg-red-50 dark:text-red-400 dark:ring-red-900 dark:hover:bg-red-950/40"
          }`}
        >
          {deleting
            ? "Deleting…"
            : armed
              ? "Click again to delete"
              : "Delete my account"}
        </button>
      </Form>
    </div>
  );
}

// Your public page in one place: whether there is one, its address to
// pick and copy, and the line at its top. Before you pick a handle, the
// share link is the address.
interface PinItem {
  id: string;
  note: string | null;
  // A friend's book, borrowed, rather than one from their shelf
  borrowed: boolean;
  book: {
    id: string;
    title: string;
    author: string;
    cover: string;
    hiddenFromPage: boolean;
  };
}

// The books pinned to the top of the public page: their order here is the
// page's, and pins are made from each book's own page
function PinnedFavorites({ pins }: { pins: PinItem[] }) {
  const fetcher = useFetcher({ key: "pins" });
  const arrow =
    "flex h-7 w-7 items-center justify-center rounded-md text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div id="pinned" className="mt-6 scroll-mt-24">
      <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
        Favorites on your page{" "}
        <span className="font-normal text-stone-400 dark:text-stone-500">
          {pins.length}/{PIN_MAX}
        </span>
      </p>
      <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
        {pins.length === 0
          ? "Pin books from their pages, yours or ones you've borrowed; your note on each shows with it. Until you do, your page shows the books you've hearted."
          : "In the order they appear, each with your note on it if you've written one. Pin more from a book's page."}
      </p>
      {pins.length > 0 ? (
        <ol className="mt-2 divide-y divide-stone-100 dark:divide-stone-800 rounded-md border border-stone-200 dark:border-stone-700">
          {pins.map((pin, index) => (
            <li key={pin.id} className="flex items-center gap-3 px-3 py-2">
              <BookCover
                cover={pin.book.cover}
                title={pin.book.title}
                compact
                className="h-12 w-8 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <Link
                  to={`/books/${pin.book.id}`}
                  className="block truncate text-sm font-medium text-stone-900 dark:text-stone-100 hover:underline underline-offset-2"
                >
                  {pin.book.title}
                </Link>
                <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                  {pin.book.hiddenFromPage
                    ? pin.borrowed
                      ? "Its owner keeps it off public pages, so not shown"
                      : "Kept off your page, so not shown"
                    : pin.note
                      ? `“${pin.note}”`
                      : pin.borrowed
                        ? `Borrowed · ${pin.book.author}`
                        : pin.book.author}
                </p>
              </div>
              <fetcher.Form method="post" className="flex items-center gap-0.5">
                <input type="hidden" name="intent" value="movePin" />
                <input type="hidden" name="bookId" value={pin.book.id} />
                <button
                  type="submit"
                  name="direction"
                  value="earlier"
                  disabled={index === 0}
                  aria-label={`Move ${pin.book.title} earlier`}
                  className={arrow}
                >
                  ↑
                </button>
                <button
                  type="submit"
                  name="direction"
                  value="later"
                  disabled={index === pins.length - 1}
                  aria-label={`Move ${pin.book.title} later`}
                  className={arrow}
                >
                  ↓
                </button>
              </fetcher.Form>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="unpinFromPage" />
                <input type="hidden" name="bookId" value={pin.book.id} />
                <button
                  type="submit"
                  className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 underline-offset-2 hover:underline"
                >
                  Unpin
                </button>
              </fetcher.Form>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function PublicPage({
  handle,
  bio,
  origin,
  shareUrl,
  pins,
}: {
  handle: string | null;
  bio: string | null;
  origin: string;
  shareUrl: string | null;
  pins: PinItem[];
}) {
  const fetcher = useFetcher<{
    profileSaved?: boolean;
    profileError?: string;
  }>();
  const [bioText, setBioText] = useState(bio ?? "");
  const [copied, setCopied] = useState(false);
  const saving = fetcher.state !== "idle";
  const error = fetcher.data?.profileError;
  const saved = fetcher.state === "idle" && fetcher.data?.profileSaved;
  const host = origin.replace(/^https?:\/\//, "");

  const heading = (
    <h3 className="text-sm font-medium text-stone-700 dark:text-stone-300">
      Public page
    </h3>
  );

  if (!shareUrl) {
    return (
      <div>
        {heading}
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          A page anyone can open to see your shelf, no sign-in needed.
        </p>
        <Form method="post" className="mt-3">
          <input type="hidden" name="intent" value="generateShareToken" />
          <button type="submit" className={quietButton}>
            Make my shelf public
          </button>
        </Form>
      </div>
    );
  }

  // The saved address, not whatever's being typed
  const link = handle ? `${origin}/@${handle}` : shareUrl;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the address is right there to select
    }
  };

  return (
    <div>
      {heading}
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Anyone with the link can see your shelf without signing in, apart from
        any book you keep off it from that book&apos;s page.
      </p>
      <fetcher.Form method="post" className="mt-3 grid grid-cols-1 gap-3">
        <input type="hidden" name="intent" value="saveProfile" />
        <div>
          <label
            htmlFor="handle"
            className="block text-sm text-stone-700 dark:text-stone-300"
          >
            Address
          </label>
          <div className="mt-1 flex gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 focus-within:border-stone-400 dark:focus-within:border-stone-500">
              <span className="select-none pl-3 text-stone-400 dark:text-stone-500">
                {host}/@
              </span>
              <input
                id="handle"
                name="handle"
                defaultValue={handle ?? ""}
                placeholder="yourname"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={HANDLE_MAX + 1}
                aria-invalid={error ? true : undefined}
                aria-describedby={handle ? undefined : "handle-hint"}
                className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-stone-900 dark:text-stone-100 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={copy}
              aria-label={`Copy ${link}`}
              className={`flex-shrink-0 ${quietButton}`}
            >
              {/* Both labels share one cell, so the button keeps its width */}
              <span className="grid">
                <span
                  className={`col-start-1 row-start-1 ${copied ? "invisible" : ""}`}
                >
                  Copy
                </span>
                <span
                  className={`col-start-1 row-start-1 ${copied ? "" : "invisible"}`}
                >
                  Copied
                </span>
              </span>
            </button>
          </div>
          {handle ? null : (
            <p
              id="handle-hint"
              className="mt-1.5 text-sm text-stone-500 dark:text-stone-400"
            >
              Pick a handle for a link that&apos;s easy to share. Until then,
              Copy gives you a longer link that works just the same.
            </p>
          )}
        </div>
        <label className="block text-sm text-stone-700 dark:text-stone-300">
          <span className="flex justify-between">
            Bio
            <span className="tabular-nums text-stone-400 dark:text-stone-500">
              {bioText.length}/{BIO_MAX}
            </span>
          </span>
          <textarea
            name="bio"
            rows={2}
            maxLength={BIO_MAX}
            value={bioText}
            onChange={(event) => setBioText(event.target.value)}
            placeholder="Sci-fi, slow mornings, always happy to lend"
            className={`mt-1 resize-none ${inputClass}`}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className={`${quietButton} disabled:opacity-60`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <span role="status" className="text-sm">
            {error ? (
              <span className="text-red-700 dark:text-red-400">{error}</span>
            ) : saved ? (
              <span className="text-forest-700 dark:text-forest-400">
                Saved
              </span>
            ) : null}
          </span>
        </div>
      </fetcher.Form>
      <PinnedFavorites pins={pins} />
      {/* Its own form, since forms can't nest */}
      <Form method="post" className="mt-4">
        <input type="hidden" name="intent" value="revokeShareToken" />
        <button type="submit" className={textButton}>
          Turn off public page
        </button>
      </Form>
    </div>
  );
}
