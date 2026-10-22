import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, Form, useActionData, useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

import Avatar, {
  AVATAR_ICONS,
  AvatarGlyph,
  isAvatarIcon,
} from "~/components/avatar";
import {
  BookIcon,
  BorrowedIcon,
  CheckCircleIcon,
  GroupIcon,
  ImportIcon,
  LentIcon,
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
  toggleDarkMode,
  toggleEmailNotifications,
} from "~/models/user.server";
import { publicOrigin } from "~/origin.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

export const meta: MetaFunction = () =>
  seo({ title: "Account", noindex: true });

export const handle = {
  breadcrumb: () => <span>Account</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [user, bookStats, household] = await Promise.all([
    getUserById(userId),
    getBookStats(userId, await shelfIds(userId)),
    getHousehold(userId),
  ]);
  return {
    user,
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

  // Handle dark mode toggle
  if (intent === "toggleDarkMode") {
    const enabled = formData.get("darkMode") === "true";
    await toggleDarkMode(userId, enabled);
    return json({
      errors: null,
      passwordErrors: null,
      success: false,
      passwordSuccess: false,
      emojiSuccess: false,
    });
  }

  // Handle email notifications toggle
  if (intent === "toggleEmailNotifications") {
    const enabled = formData.get("emailNotifications") === "true";
    await toggleEmailNotifications(userId, enabled);
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

  await updateUser(userId, {
    firstname: (firstname as string).trim(),
    surname: (surname as string).trim(),
    email: isDemo ? undefined : (email as string).trim(),
  });

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
  "rounded-md bg-forest-600 dark:bg-forest-500 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700 dark:hover:bg-forest-400 transition-colors";
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

      <Section title="Preferences" description="How Stacks looks, and what it emails you.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            intent="toggleDarkMode"
            name="darkMode"
            on={Boolean(user?.darkMode)}
            label="Dark mode"
            hint="On every device you sign in on"
          />
          <Toggle
            intent="toggleEmailNotifications"
            name="emailNotifications"
            on={Boolean(user?.emailNotifications)}
            label="Email me"
            hint="Borrow requests and a weekly roundup"
          />
        </div>
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
        title="Import"
        description="Bring your shelf over from Goodreads or StoryGraph in one go."
      >
        <Link to="/import" className={`inline-flex items-center gap-2 ${quietButton}`}>
          <ImportIcon size={16} />
          Import from a file
        </Link>
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
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-5 md:grid-cols-3 md:gap-10">
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
        className="flex w-full items-center gap-3 rounded-lg border border-stone-200 dark:border-stone-800 px-4 py-3 text-left hover:border-stone-300 dark:hover:border-stone-700 transition-colors"
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
            checked ? "bg-forest-600 dark:bg-forest-500" : "bg-stone-300 dark:bg-stone-700"
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
