import { useLoaderData } from "@remix-run/react";
import { requireUserId } from "~/session.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { getUserById, getUserByEmail, updateUser, generateShareToken, revokeShareToken, changePassword, toggleDarkMode, toggleEmailNotifications } from "~/models/user.server";
import { getBookStats } from "~/models/book.server";
import Layout from "~/components / Layout/Layout";
import Breadcrumbs from "~/components/breadcrumbs";
import { Form, useActionData } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

export const handle = {
  breadcrumb: () => <span>Account</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [user, bookStats] = await Promise.all([
    getUserById(userId),
    getBookStats(userId),
  ]);
  const url = new URL(request.url);
  const origin = url.origin;
  return { user, origin, bookStats };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Handle share token actions
  if (intent === "generateShareToken") {
    await generateShareToken(userId);
    return json({ errors: null, passwordErrors: null, success: false, passwordSuccess: false, emojiSuccess: false, shareAction: "generated" });
  }

  if (intent === "revokeShareToken") {
    await revokeShareToken(userId);
    return json({ errors: null, passwordErrors: null, success: false, passwordSuccess: false, emojiSuccess: false, shareAction: "revoked" });
  }

  // Handle dark mode toggle
  if (intent === "toggleDarkMode") {
    const enabled = formData.get("darkMode") === "true";
    await toggleDarkMode(userId, enabled);
    return json({ errors: null, passwordErrors: null, success: false, passwordSuccess: false, emojiSuccess: false });
  }

  // Handle email notifications toggle
  if (intent === "toggleEmailNotifications") {
    const enabled = formData.get("emailNotifications") === "true";
    await toggleEmailNotifications(userId, enabled);
    return json({ errors: null, passwordErrors: null, success: false, passwordSuccess: false, emojiSuccess: false });
  }

  // Handle profile emoji update
  if (intent === "updateProfileEmoji") {
    const emoji = formData.get("emoji");
    await updateUser(userId, {
      profileEmoji: emoji === "" ? null : (emoji as string),
    });
    return json({ errors: null, passwordErrors: null, success: false, passwordSuccess: false, emojiSuccess: true });
  }

  // Handle password change
  if (intent === "changePassword") {
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const confirmPassword = formData.get("confirmPassword");

    const passwordErrors: { currentPassword?: string; newPassword?: string; confirmPassword?: string } = {};

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
      return json({ errors: null, passwordErrors, success: false, passwordSuccess: false, emojiSuccess: false }, { status: 400 });
    }

    const result = await changePassword(userId, currentPassword as string, newPassword as string);

    if (!result.success) {
      passwordErrors.currentPassword = result.error;
      return json({ errors: null, passwordErrors, success: false, passwordSuccess: false, emojiSuccess: false }, { status: 400 });
    }

    return json({ errors: null, passwordErrors: null, success: false, passwordSuccess: true, emojiSuccess: false });
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
    return json({ errors, passwordErrors: null, success: false, passwordSuccess: false, emojiSuccess: false }, { status: 400 });
  }

  // Check if email is already taken by another user
  const existingUser = await getUserByEmail(email as string);
  if (existingUser && existingUser.id !== userId) {
    errors.email = "This email is already in use";
    return json({ errors, passwordErrors: null, success: false, passwordSuccess: false, emojiSuccess: false }, { status: 400 });
  }

  await updateUser(userId, {
    firstname: (firstname as string).trim(),
    surname: (surname as string).trim(),
    email: (email as string).trim(),
  });

  return json({ errors: null, passwordErrors: null, success: true, passwordSuccess: false, emojiSuccess: false });
};

export default function Account() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [copied, setCopied] = useState(false);

  const firstnameRef = useRef<HTMLInputElement>(null);
  const surnameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const shareUrl = data.user?.shareToken
    ? `${data.origin}/share/${data.user.shareToken}`
    : null;

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
    <>
    <Breadcrumbs />
    <Layout title="Account">
      <section className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Account Details</h2>
        <dl className="space-y-3">
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

        <div className="mt-6 pt-6 border-t">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Library Stats</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <dd className="text-2xl font-semibold text-gray-900">{data.bookStats.totalBooks}</dd>
              <dt className="text-sm text-gray-500">Books</dt>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <dd className="text-2xl font-semibold text-blue-600">{data.bookStats.borrowedBooks}</dd>
              <dt className="text-sm text-gray-500">Borrowed</dt>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <dd className="text-2xl font-semibold text-amber-600">{data.bookStats.lentBooks}</dd>
              <dt className="text-sm text-gray-500">Lent Out</dt>
            </div>
          </div>
        </div>
      </section>

      <section className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Appearance</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Customize how Stacks looks on your device.
        </p>
        <Form method="post" className="flex items-center justify-between">
          <input type="hidden" name="intent" value="toggleDarkMode" />
          <input type="hidden" name="darkMode" value={data.user?.darkMode ? "false" : "true"} />
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Dark Mode</span>
          </div>
          <button
            type="submit"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              data.user?.darkMode ? "bg-blue-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                data.user?.darkMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </Form>
      </section>

      <section className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Notifications</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Control how you receive notifications.
        </p>
        <Form method="post" className="flex items-center justify-between">
          <input type="hidden" name="intent" value="toggleEmailNotifications" />
          <input type="hidden" name="emailNotifications" value={data.user?.emailNotifications ? "false" : "true"} />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Email Notifications</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Receive emails for book requests</span>
          </div>
          <button
            type="submit"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              data.user?.emailNotifications ? "bg-blue-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                data.user?.emailNotifications ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </Form>
      </section>

      <section className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Profile Picture</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Choose an emoji to represent you, or use your initials.
        </p>

        {actionData?.emojiSuccess && (
          <div className="p-3 rounded bg-green-100 text-green-800 mb-4">
            Profile picture updated successfully.
          </div>
        )}

        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold text-xl flex-shrink-0">
            {data.user?.profileEmoji ? (
              <span className="text-3xl">{data.user.profileEmoji}</span>
            ) : (
              <>
                {(data.user?.firstname?.[0] || "").toUpperCase()}
                {(data.user?.surname?.[0] || "").toUpperCase()}
              </>
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {data.user?.profileEmoji ? "Current emoji" : "Using initials"}
          </div>
        </div>

        <Form method="post">
          <input type="hidden" name="intent" value="updateProfileEmoji" />
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-2 mb-4">
            {["😀", "😎", "🤓", "🧐", "🤔", "😊", "🥳", "🤩", "😇", "🙂",
              "👤", "👩", "👨", "🧑", "👧", "👦", "🧔", "👴", "👵", "🧓",
              "🦊", "🐱", "🐶", "🐼", "🐨", "🦁", "🐯", "🐮", "🐷", "🐸",
              "📚", "📖", "📕", "📗", "📘", "📙", "🎓", "✏️", "🖊️", "📝",
              "🌟", "⭐", "🌈", "🔥", "💡", "💎", "🎨", "🎭", "🎪", "🎯"
            ].map((emoji) => (
              <button
                key={emoji}
                type="submit"
                name="emoji"
                value={emoji}
                className={`w-10 h-10 text-2xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center ${
                  data.user?.profileEmoji === emoji ? "bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
          {data.user?.profileEmoji && (
            <button
              type="submit"
              name="emoji"
              value=""
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
            >
              Remove emoji and use initials
            </button>
          )}
        </Form>
      </section>

      <section className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Share Your Bookshelf</h2>
        <p className="text-gray-600 mb-4">
          Anyone with this link can view your bookshelf without logging in.
        </p>

        {shareUrl ? (
          <div className="space-y-4">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <Form method="post">
                <input type="hidden" name="intent" value="revokeShareToken" />
                <button
                  type="submit"
                  className="rounded border border-red-500 px-4 py-2 text-red-500 hover:bg-red-50"
                >
                  Revoke Access
                </button>
              </Form>
            </div>
          </div>
        ) : (
          <Form method="post">
            <input type="hidden" name="intent" value="generateShareToken" />
            <button
              type="submit"
              className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
            >
              Generate Share Link
            </button>
          </Form>
        )}
      </section>

      <section className="border rounded-lg p-6">
        <Form method="post" className="space-y-4">
          <h2 className="text-xl font-semibold mb-2">Update Profile</h2>
          <p className="text-gray-600">Change your name or email address below.</p>

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

      <section className="border rounded-lg p-6">
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="changePassword" />
          <h2 className="text-xl font-semibold mb-2">Change Password</h2>
          <p className="text-gray-600">Update your password to keep your account secure.</p>

          {actionData?.passwordSuccess && (
            <div className="p-3 rounded bg-green-100 text-green-800">
              Your password has been changed successfully.
            </div>
          )}

          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Current password
            </label>
            <div className="mt-1">
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                aria-invalid={actionData?.passwordErrors?.currentPassword ? true : undefined}
                aria-describedby="currentPassword-error"
                className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
              />
              {actionData?.passwordErrors?.currentPassword && (
                <div className="pt-1 text-red-700" id="currentPassword-error">
                  {actionData.passwordErrors.currentPassword}
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-gray-700"
            >
              New password
            </label>
            <div className="mt-1">
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={actionData?.passwordErrors?.newPassword ? true : undefined}
                aria-describedby="newPassword-error"
                className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
              />
              {actionData?.passwordErrors?.newPassword && (
                <div className="pt-1 text-red-700" id="newPassword-error">
                  {actionData.passwordErrors.newPassword}
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Confirm new password
            </label>
            <div className="mt-1">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={actionData?.passwordErrors?.confirmPassword ? true : undefined}
                aria-describedby="confirmPassword-error"
                className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
              />
              {actionData?.passwordErrors?.confirmPassword && (
                <div className="pt-1 text-red-700" id="confirmPassword-error">
                  {actionData.passwordErrors.confirmPassword}
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
          >
            Change Password
          </button>
        </Form>
      </section>
    </Layout>
    </>
  );
}
