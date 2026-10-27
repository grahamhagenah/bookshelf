import { data, Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import invariant from "tiny-invariant";

import BookCover from "~/components/book-cover";
import { primaryButton, textField } from "~/components/ui";
import { notifyAdminsOfSignup } from "~/models/admin.server";
import { claimInvite, getInvite } from "~/models/loan-invite.server";
import { seo } from "~/seo";
import { createUserSession, getUserId } from "~/session.server";

// Where the email lands when someone not on Stacks is lent a book: what
// they have and whose it is, and a form to make the waiting account
// theirs. The link came to their inbox, so that's proof enough.

export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  seo({
    title: loaderData?.loan ? `${loaderData.loan.lender} lent you ${loaderData.loan.title}` : "Your loan",
    description: "Borrow and lend books with friends.",
    noindex: true,
  });

const dueWords = (date: string | Date | null) =>
  date
    ? `Due back ${new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}`
    : null;

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.token, "token not found");
  const invite = await getInvite(params.token);
  // Already set up: sign in and go straight to the book
  if (invite === "claimed") return redirect("/login");
  if (!invite) return data({ person: null, loan: null, others: [], signedIn: false });
  const [loan, ...others] = invite.borrowedBooks.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    cover: book.cover,
    due: dueWords(book.dueDate),
    lender: book.user.firstname,
  }));
  return data({
    person: { firstname: invite.firstname, surname: invite.surname, email: invite.email },
    loan: loan ?? null,
    others,
    signedIn: Boolean(await getUserId(request)),
  });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  invariant(params.token, "token not found");
  const formData = await request.formData();
  const firstname = String(formData.get("firstname") ?? "").trim();
  const surname = String(formData.get("surname") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!firstname) return data({ error: "Add your first name." }, { status: 400 });
  if (password.length < 8) {
    return data({ error: "Use at least 8 characters for your password." }, { status: 400 });
  }
  const claimed = await claimInvite(params.token, { firstname, surname, password });
  if (!claimed) {
    return data({ error: "This link has expired or was already used." }, { status: 400 });
  }
  void notifyAdminsOfSignup(
    { id: claimed.userId, firstname, surname, email: claimed.email },
    { lentBy: claimed.lenderName },
  ).catch((error) => console.error("Couldn't email admins about a sign-up:", error));
  return createUserSession({
    request,
    userId: claimed.userId,
    remember: true,
    redirectTo: claimed.bookId ? `/books/${claimed.bookId}` : "/",
  });
};

const labelClass = "block text-sm font-medium text-stone-700 dark:text-stone-300";

export default function Lent() {
  const { person, loan, others, signedIn } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const saving = useNavigation().state !== "idle";

  if (!person) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
          That link didn&apos;t work
        </h1>
        <p className="mt-3 text-stone-600 dark:text-stone-300">
          Links in loan emails work for two months. If you&apos;ve set up your
          account already, sign in to see what you&apos;ve borrowed.
        </p>
        <Link
          to="/login"
          className={`${primaryButton("lg")} mt-6 inline-block`}
        >
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12 md:py-16">
      {loan ? (
        <div className="flex items-center gap-4">
          <div className="w-20 flex-shrink-0">
            <BookCover
              cover={loan.cover}
              title={loan.title}
              author={loan.author}
              alt=""
              className="aspect-[2/3]"
              eager
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-balance text-2xl font-semibold text-stone-900 dark:text-stone-50">
              {loan.lender} lent you {loan.title}
            </h1>
            <p className="mt-1 text-stone-600 dark:text-stone-300">
              {loan.author}
              {loan.due ? ` · ${loan.due}` : null}
            </p>
          </div>
        </div>
      ) : (
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">
          Set up your Stacks account
        </h1>
      )}
      {others.length > 0 ? (
        <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">
          You also have{" "}
          {others.map((other) => `${other.title} from ${other.lender}`).join(", ")}.
        </p>
      ) : null}

      <p className="mt-6 text-stone-600 dark:text-stone-300">
        Stacks is a lending library for the books you and your friends own.
        Choose a password to see your loans, ask for more time
        {loan ? `, and borrow from ${loan.lender}'s shelf` : ""}.
      </p>

      {signedIn ? (
        <p className="mt-4 rounded-lg bg-stone-100 dark:bg-stone-900 px-4 py-3 text-sm text-stone-700 dark:text-stone-200">
          You&apos;re signed in to another account. Setting this one up signs
          you in as {person.email} instead.
        </p>
      ) : null}

      <Form method="post" className="mt-8 space-y-5">
        <div>
          <span className={labelClass}>Email</span>
          <p className="mt-1 text-stone-900 dark:text-stone-100">{person.email}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstname" className={labelClass}>
              First name
            </label>
            <input
              id="firstname"
              name="firstname"
              required
              defaultValue={person.firstname}
              autoComplete="given-name"
              className={`mt-1 ${textField}`}
            />
          </div>
          <div>
            <label htmlFor="surname" className={labelClass}>
              Last name
            </label>
            <input
              id="surname"
              name="surname"
              defaultValue={person.surname}
              autoComplete="family-name"
              className={`mt-1 ${textField}`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>
            Choose a password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            aria-describedby="lent-error"
            className={`mt-1 ${textField}`}
          />
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">At least 8 characters.</p>
        </div>
        {actionData?.error ? (
          <p id="lent-error" role="alert" className="text-stone-900 dark:text-stone-100">
            {actionData.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-forest-600 px-4 py-2.5 font-medium text-white hover:bg-forest-700 transition-colors disabled:opacity-60"
        >
          {saving ? "Setting up…" : "See my loan"}
        </button>
        <p className="text-center text-xs text-stone-500 dark:text-stone-400">
          By creating an account you agree to the{" "}
          <Link to="/terms" className="underline underline-offset-2">terms</Link> and{" "}
          <Link to="/privacy" className="underline underline-offset-2">privacy policy</Link>.
        </p>
      </Form>
    </main>
  );
}
